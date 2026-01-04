"""Tests for Redis caching layer."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json

from src.cache import (
    cache_get,
    cache_set,
    cache_delete,
    make_cache_key,
    CacheTTL,
)


class TestCacheKey:
    """Tests for cache key generation."""

    def test_make_cache_key_single(self):
        """Test making cache key with single part."""
        key = make_cache_key("trending")
        assert key == "trending"

    def test_make_cache_key_multiple(self):
        """Test making cache key with multiple parts."""
        key = make_cache_key("trending", "24h", "javascript")
        assert key == "trending:24h:javascript"

    def test_make_cache_key_with_numbers(self):
        """Test making cache key with numbers."""
        key = make_cache_key("trending", 24, "50")
        assert key == "trending:24:50"


class TestCacheTTL:
    """Tests for cache TTL constants."""

    def test_ttl_values(self):
        """Test TTL constant values."""
        assert CacheTTL.TRENDING == 30
        assert CacheTTL.LANGUAGES == 60
        assert CacheTTL.REPO_METRICS == 30
        assert CacheTTL.SEARCH == 120
        assert CacheTTL.STATS == 15


@pytest.mark.asyncio
async def test_cache_get_no_client():
    """Test cache_get when Redis client is None."""
    with patch("src.cache._redis_client", None):
        result = await cache_get("test_key")
        assert result is None


@pytest.mark.asyncio
async def test_cache_set_no_client():
    """Test cache_set when Redis client is None."""
    with patch("src.cache._redis_client", None):
        result = await cache_set("test_key", {"data": "value"})
        assert result is False


@pytest.mark.asyncio
async def test_cache_delete_no_client():
    """Test cache_delete when Redis client is None."""
    with patch("src.cache._redis_client", None):
        result = await cache_delete("test_key")
        assert result is False


@pytest.mark.asyncio
async def test_cache_get_success():
    """Test successful cache_get."""
    mock_client = AsyncMock()
    mock_client.get.return_value = '{"data": "value"}'

    with patch("src.cache._redis_client", mock_client):
        result = await cache_get("test_key")
        assert result == {"data": "value"}
        mock_client.get.assert_called_once_with("test_key")


@pytest.mark.asyncio
async def test_cache_get_miss():
    """Test cache_get with cache miss."""
    mock_client = AsyncMock()
    mock_client.get.return_value = None

    with patch("src.cache._redis_client", mock_client):
        result = await cache_get("test_key")
        assert result is None


@pytest.mark.asyncio
async def test_cache_set_success():
    """Test successful cache_set."""
    mock_client = AsyncMock()

    with patch("src.cache._redis_client", mock_client):
        result = await cache_set("test_key", {"data": "value"}, 60)
        assert result is True
        mock_client.setex.assert_called_once()


@pytest.mark.asyncio
async def test_cache_delete_success():
    """Test successful cache_delete."""
    mock_client = AsyncMock()

    with patch("src.cache._redis_client", mock_client):
        result = await cache_delete("test_key")
        assert result is True
        mock_client.delete.assert_called_once_with("test_key")
