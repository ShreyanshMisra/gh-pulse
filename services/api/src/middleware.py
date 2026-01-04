"""API middleware for rate limiting and other cross-cutting concerns."""

import time
import logging
from typing import Callable
from collections import defaultdict

from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiting middleware.

    Limits requests per IP address within a sliding time window.
    For production, use Redis-based rate limiting for distributed systems.
    """

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        requests_per_second: int = 10,
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests_per_second = requests_per_second
        # Store: {ip: [(timestamp, ...], ...}
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._last_cleanup = time.time()

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        # Check for forwarded headers (behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    def _cleanup_old_requests(self, now: float) -> None:
        """Remove old request timestamps to prevent memory leak."""
        # Only cleanup every 60 seconds
        if now - self._last_cleanup < 60:
            return

        cutoff = now - 60  # Keep last minute of data
        for ip in list(self._requests.keys()):
            self._requests[ip] = [ts for ts in self._requests[ip] if ts > cutoff]
            if not self._requests[ip]:
                del self._requests[ip]

        self._last_cleanup = now

    def _is_rate_limited(self, ip: str, now: float) -> tuple[bool, dict]:
        """Check if an IP is rate limited.

        Returns:
            Tuple of (is_limited, rate_info_dict)
        """
        self._cleanup_old_requests(now)

        requests = self._requests[ip]

        # Count requests in last second
        second_cutoff = now - 1
        requests_last_second = sum(1 for ts in requests if ts > second_cutoff)

        # Count requests in last minute
        minute_cutoff = now - 60
        requests_last_minute = sum(1 for ts in requests if ts > minute_cutoff)

        rate_info = {
            "requests_last_second": requests_last_second,
            "requests_last_minute": requests_last_minute,
            "limit_per_second": self.requests_per_second,
            "limit_per_minute": self.requests_per_minute,
        }

        # Check per-second limit
        if requests_last_second >= self.requests_per_second:
            return True, rate_info

        # Check per-minute limit
        if requests_last_minute >= self.requests_per_minute:
            return True, rate_info

        return False, rate_info

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with rate limiting."""
        # Skip rate limiting for health checks and docs
        if request.url.path in ("/health", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        # Skip WebSocket connections
        if request.url.path == "/ws":
            return await call_next(request)

        ip = self._get_client_ip(request)
        now = time.time()

        is_limited, rate_info = self._is_rate_limited(ip, now)

        if is_limited:
            logger.warning(f"Rate limit exceeded for IP {ip}: {rate_info}")
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "retry_after_seconds": 1,
                    **rate_info,
                },
                headers={
                    "Retry-After": "1",
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                },
            )

        # Record this request
        self._requests[ip].append(now)

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        _, updated_info = self._is_rate_limited(ip, now)
        remaining = self.requests_per_minute - updated_info["requests_last_minute"]
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(now) + 60)

        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging requests and response times."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Log request and measure response time."""
        start_time = time.time()

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Log request (skip health checks to reduce noise)
        if request.url.path != "/health":
            logger.info(
                f"{request.method} {request.url.path} - "
                f"{response.status_code} - {duration_ms:.2f}ms"
            )

        # Add timing header
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

        return response
