"""Tests for API middleware."""

import pytest
import time
from unittest.mock import MagicMock, AsyncMock

from src.middleware import RateLimitMiddleware


class TestRateLimitMiddleware:
    """Tests for rate limiting middleware."""

    @pytest.fixture
    def middleware(self):
        """Create a middleware instance for testing."""
        app = MagicMock()
        return RateLimitMiddleware(
            app,
            requests_per_minute=10,
            requests_per_second=2,
        )

    def test_get_client_ip_direct(self, middleware):
        """Test extracting client IP directly from request."""
        request = MagicMock()
        request.headers.get.return_value = None
        request.client.host = "192.168.1.1"

        ip = middleware._get_client_ip(request)
        assert ip == "192.168.1.1"

    def test_get_client_ip_forwarded(self, middleware):
        """Test extracting client IP from X-Forwarded-For header."""
        request = MagicMock()
        request.headers.get.side_effect = lambda h: (
            "10.0.0.1, 192.168.1.1" if h == "X-Forwarded-For" else None
        )

        ip = middleware._get_client_ip(request)
        assert ip == "10.0.0.1"

    def test_get_client_ip_real_ip(self, middleware):
        """Test extracting client IP from X-Real-IP header."""
        request = MagicMock()
        request.headers.get.side_effect = lambda h: (
            "10.0.0.1" if h == "X-Real-IP" else None
        )

        ip = middleware._get_client_ip(request)
        assert ip == "10.0.0.1"

    def test_is_rate_limited_not_limited(self, middleware):
        """Test rate limiting when not limited."""
        now = time.time()
        is_limited, info = middleware._is_rate_limited("192.168.1.1", now)

        assert is_limited is False
        assert info["requests_last_second"] == 0
        assert info["requests_last_minute"] == 0

    def test_is_rate_limited_per_second(self, middleware):
        """Test rate limiting per second."""
        now = time.time()
        ip = "192.168.1.1"

        # Add requests up to the per-second limit
        for _ in range(2):
            middleware._requests[ip].append(now)

        is_limited, info = middleware._is_rate_limited(ip, now)
        assert is_limited is True
        assert info["requests_last_second"] == 2

    def test_is_rate_limited_per_minute(self, middleware):
        """Test rate limiting per minute."""
        now = time.time()
        ip = "192.168.1.1"

        # Add requests spread over the minute (but over the limit)
        for i in range(10):
            middleware._requests[ip].append(now - i * 5)

        is_limited, info = middleware._is_rate_limited(ip, now)
        assert is_limited is True
        assert info["requests_last_minute"] == 10

    def test_cleanup_old_requests(self, middleware):
        """Test cleanup of old request timestamps."""
        now = time.time()
        ip = "192.168.1.1"

        # Add old requests (older than 60 seconds)
        for i in range(5):
            middleware._requests[ip].append(now - 120 - i)

        # Add recent requests
        middleware._requests[ip].append(now)

        # Force cleanup
        middleware._last_cleanup = now - 120
        middleware._cleanup_old_requests(now)

        # Only recent request should remain
        assert len(middleware._requests[ip]) == 1


class TestRateLimitInfo:
    """Tests for rate limit info in responses."""

    @pytest.fixture
    def middleware(self):
        """Create a middleware instance for testing."""
        app = MagicMock()
        return RateLimitMiddleware(
            app,
            requests_per_minute=60,
            requests_per_second=10,
        )

    def test_rate_info_structure(self, middleware):
        """Test rate info dictionary structure."""
        now = time.time()
        _, info = middleware._is_rate_limited("192.168.1.1", now)

        assert "requests_last_second" in info
        assert "requests_last_minute" in info
        assert "limit_per_second" in info
        assert "limit_per_minute" in info
        assert info["limit_per_second"] == 10
        assert info["limit_per_minute"] == 60
