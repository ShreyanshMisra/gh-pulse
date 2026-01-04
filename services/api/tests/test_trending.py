"""Tests for trending API endpoints."""

import pytest
from datetime import datetime


@pytest.mark.asyncio
async def test_health_check(client):
    """Test health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """Test root endpoint."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "GitHub Activity Stream Analyzer"
    assert "endpoints" in data


@pytest.mark.asyncio
async def test_get_trending_empty(client):
    """Test trending endpoint with no data."""
    response = await client.get("/api/trending")
    assert response.status_code == 200
    data = response.json()
    assert data["data"] == []
    assert data["total"] == 0
    assert "window" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_get_trending_with_data(client, sample_repos, sample_metrics):
    """Test trending endpoint with sample data."""
    response = await client.get("/api/trending")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) > 0
    assert data["total"] > 0

    # Check first repo structure
    repo = data["data"][0]
    assert "repo_id" in repo
    assert "repo_name" in repo
    assert "language" in repo
    assert "total_stars" in repo
    assert "stars_gained" in repo
    assert "velocity_score" in repo
    assert "event_count" in repo


@pytest.mark.asyncio
async def test_get_trending_with_language_filter(client, sample_repos, sample_metrics):
    """Test trending endpoint with language filter."""
    response = await client.get("/api/trending?language=JavaScript")
    assert response.status_code == 200
    data = response.json()

    # All results should be JavaScript
    for repo in data["data"]:
        assert repo["language"] == "JavaScript"


@pytest.mark.asyncio
async def test_get_trending_time_windows(client, sample_repos, sample_metrics):
    """Test trending endpoint with different time windows."""
    windows = ["1h", "6h", "12h", "24h", "7d", "30d"]

    for window in windows:
        response = await client.get(f"/api/trending?window={window}")
        assert response.status_code == 200
        data = response.json()
        assert data["window"] == window


@pytest.mark.asyncio
async def test_get_trending_invalid_window(client):
    """Test trending endpoint with invalid time window."""
    response = await client.get("/api/trending?window=invalid")
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_get_trending_limit(client, sample_repos, sample_metrics):
    """Test trending endpoint with limit parameter."""
    response = await client.get("/api/trending?limit=2")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) <= 2


@pytest.mark.asyncio
async def test_get_languages_empty(client):
    """Test languages endpoint with no data."""
    response = await client.get("/api/languages")
    assert response.status_code == 200
    data = response.json()
    assert data["data"] == []


@pytest.mark.asyncio
async def test_get_languages_with_data(client, sample_repos, sample_metrics):
    """Test languages endpoint with sample data."""
    response = await client.get("/api/languages")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) > 0

    # Check language structure
    lang = data["data"][0]
    assert "language" in lang
    assert "repo_count" in lang
    assert "total_stars" in lang
    assert "event_count" in lang


@pytest.mark.asyncio
async def test_get_repo_metrics_not_found(client):
    """Test repo metrics endpoint with non-existent repo."""
    response = await client.get("/api/repos/nonexistent/repo/metrics")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_repo_metrics_with_data(client, sample_repos, sample_metrics):
    """Test repo metrics endpoint with sample data."""
    response = await client.get("/api/repos/facebook/react/metrics")
    assert response.status_code == 200
    data = response.json()

    assert "repository" in data
    assert "metrics" in data
    assert data["repository"]["full_name"] == "facebook/react"
