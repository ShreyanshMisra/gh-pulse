"""Redis caching layer for API responses."""

import json
import logging
from typing import Any
from datetime import timedelta

import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool

from .config import get_settings

logger = logging.getLogger(__name__)

# Global Redis connection pool
_redis_pool: ConnectionPool | None = None
_redis_client: redis.Redis | None = None


async def init_redis() -> None:
    """Initialize Redis connection pool."""
    global _redis_pool, _redis_client

    settings = get_settings()
    try:
        _redis_pool = ConnectionPool.from_url(
            settings.redis_url,
            max_connections=10,
            decode_responses=True,
        )
        _redis_client = redis.Redis(connection_pool=_redis_pool)
        # Test connection
        await _redis_client.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}. Caching disabled.")
        _redis_client = None


async def close_redis() -> None:
    """Close Redis connection pool."""
    global _redis_pool, _redis_client

    if _redis_client:
        await _redis_client.close()
        _redis_client = None
    if _redis_pool:
        await _redis_pool.disconnect()
        _redis_pool = None
    logger.info("Redis connection closed")


def get_redis() -> redis.Redis | None:
    """Get Redis client instance."""
    return _redis_client


async def cache_get(key: str) -> Any | None:
    """Get a value from cache.

    Args:
        key: Cache key

    Returns:
        Cached value or None if not found/error
    """
    if not _redis_client:
        return None

    try:
        value = await _redis_client.get(key)
        if value:
            return json.loads(value)
        return None
    except Exception as e:
        logger.warning(f"Cache get error for key {key}: {e}")
        return None


async def cache_set(
    key: str,
    value: Any,
    ttl: int | timedelta = 60,
) -> bool:
    """Set a value in cache.

    Args:
        key: Cache key
        value: Value to cache (must be JSON serializable)
        ttl: Time to live in seconds or timedelta

    Returns:
        True if successful, False otherwise
    """
    if not _redis_client:
        return False

    try:
        if isinstance(ttl, timedelta):
            ttl = int(ttl.total_seconds())

        serialized = json.dumps(value, default=str)
        await _redis_client.setex(key, ttl, serialized)
        return True
    except Exception as e:
        logger.warning(f"Cache set error for key {key}: {e}")
        return False


async def cache_delete(key: str) -> bool:
    """Delete a key from cache.

    Args:
        key: Cache key

    Returns:
        True if deleted, False otherwise
    """
    if not _redis_client:
        return False

    try:
        await _redis_client.delete(key)
        return True
    except Exception as e:
        logger.warning(f"Cache delete error for key {key}: {e}")
        return False


async def cache_delete_pattern(pattern: str) -> int:
    """Delete all keys matching a pattern.

    Args:
        pattern: Key pattern (e.g., "trending:*")

    Returns:
        Number of keys deleted
    """
    if not _redis_client:
        return 0

    try:
        keys = []
        async for key in _redis_client.scan_iter(match=pattern):
            keys.append(key)

        if keys:
            await _redis_client.delete(*keys)
        return len(keys)
    except Exception as e:
        logger.warning(f"Cache delete pattern error for {pattern}: {e}")
        return 0


def make_cache_key(*parts: str) -> str:
    """Create a cache key from parts.

    Args:
        *parts: Key parts to join

    Returns:
        Cache key string
    """
    return ":".join(str(p) for p in parts)


# Cache TTL constants (in seconds)
class CacheTTL:
    """Cache TTL constants."""

    TRENDING = 30  # Trending data updates frequently
    LANGUAGES = 60  # Language stats can be cached longer
    REPO_METRICS = 30  # Per-repo metrics
    SEARCH = 120  # Search results
    STATS = 15  # Dashboard stats (events/min, etc.)
