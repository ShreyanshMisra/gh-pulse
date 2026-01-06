"""Trending repositories API endpoints."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db, RepoMetrics, Repository
from ..cache import cache_get, cache_set, make_cache_key, CacheTTL

router = APIRouter(prefix="/api", tags=["trending"])


class RepoOwner(BaseModel):
    """Owner info for trending repos."""

    login: str
    avatar_url: str


class TrendingRepo(BaseModel):
    """Response model for trending repositories."""

    repo_id: int
    repo_name: str
    language: str | None
    description: str | None
    total_stars: int
    stars_gained: int
    velocity_score: float
    event_count: int
    owner: RepoOwner | None = None  # Optional owner info (not stored in DB)


class TrendingResponse(BaseModel):
    """Response model for trending endpoint."""

    data: list[TrendingRepo]
    window: str
    timestamp: datetime
    total: int


def parse_window(window: str) -> timedelta:
    """Parse window string to timedelta."""
    window_map = {
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "12h": timedelta(hours=12),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    if window not in window_map:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid window. Must be one of: {', '.join(window_map.keys())}",
        )
    return window_map[window]


@router.get("/trending", response_model=TrendingResponse)
async def get_trending(
    language: str | None = Query(None, description="Filter by programming language"),
    window: Literal["1h", "6h", "12h", "24h", "7d", "30d"] = Query(
        "24h", description="Time window for trending calculation"
    ),
    limit: int = Query(50, ge=1, le=100, description="Number of results to return"),
    db: AsyncSession = Depends(get_db),
) -> TrendingResponse:
    """Get trending repositories.

    Calculates trending repos based on star velocity and event activity
    within the specified time window.
    """
    # Check cache first
    cache_key = make_cache_key("trending", window, language or "all", str(limit))
    cached = await cache_get(cache_key)
    if cached:
        return TrendingResponse(**cached)

    time_window = parse_window(window)
    cutoff_time = datetime.utcnow() - time_window

    # Build query for trending repos
    # Aggregate metrics from repo_metrics and join with repositories
    metrics_query = (
        select(
            RepoMetrics.repo_id,
            RepoMetrics.repo_name,
            func.sum(RepoMetrics.stars_delta).label("stars_gained"),
            func.avg(RepoMetrics.velocity_score).label("velocity_score"),
            func.count(RepoMetrics.id).label("event_count"),
        )
        .where(RepoMetrics.timestamp >= cutoff_time)
        .group_by(RepoMetrics.repo_id, RepoMetrics.repo_name)
        .order_by(desc("velocity_score"))
        .limit(limit * 2)  # Get extra to filter by language if needed
    )

    result = await db.execute(metrics_query)
    metrics = result.all()

    if not metrics:
        return TrendingResponse(
            data=[],
            window=window,
            timestamp=datetime.utcnow(),
            total=0,
        )

    # Get repository details
    repo_ids = [m.repo_id for m in metrics]
    repos_query = select(Repository).where(Repository.repo_id.in_(repo_ids))
    repos_result = await db.execute(repos_query)
    repos_map = {r.repo_id: r for r in repos_result.scalars().all()}

    # Build response
    trending_repos = []
    for m in metrics:
        repo = repos_map.get(m.repo_id)

        # Filter by language if specified
        if language and repo and repo.language:
            if repo.language.lower() != language.lower():
                continue

        trending_repos.append(
            TrendingRepo(
                repo_id=m.repo_id,
                repo_name=m.repo_name,
                language=repo.language if repo else None,
                description=repo.description if repo else None,
                total_stars=repo.total_stars if repo else 0,
                stars_gained=m.stars_gained or 0,
                velocity_score=round(m.velocity_score or 0.0, 4),
                event_count=m.event_count,
            )
        )

        if len(trending_repos) >= limit:
            break

    response = TrendingResponse(
        data=trending_repos,
        window=window,
        timestamp=datetime.utcnow(),
        total=len(trending_repos),
    )

    # Cache the response
    await cache_set(cache_key, response.model_dump(), CacheTTL.TRENDING)

    return response


@router.get("/repos/{owner}/{repo}/metrics")
async def get_repo_metrics(
    owner: str,
    repo: str,
    window: Literal["1h", "6h", "12h", "24h", "7d", "30d"] = Query("24h"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get metrics for a specific repository."""
    full_name = f"{owner}/{repo}"
    time_window = parse_window(window)
    cutoff_time = datetime.utcnow() - time_window

    # Get metrics
    query = (
        select(
            RepoMetrics.event_type,
            func.count(RepoMetrics.id).label("count"),
            func.sum(RepoMetrics.stars_delta).label("stars_delta"),
        )
        .where(
            and_(
                RepoMetrics.repo_name == full_name,
                RepoMetrics.timestamp >= cutoff_time,
            )
        )
        .group_by(RepoMetrics.event_type)
    )

    result = await db.execute(query)
    metrics = result.all()

    if not metrics:
        raise HTTPException(status_code=404, detail="Repository not found or no recent activity")

    # Get repository info
    repo_query = select(Repository).where(Repository.full_name == full_name)
    repo_result = await db.execute(repo_query)
    repo_info = repo_result.scalar_one_or_none()

    return {
        "repository": {
            "full_name": full_name,
            "language": repo_info.language if repo_info else None,
            "description": repo_info.description if repo_info else None,
            "total_stars": repo_info.total_stars if repo_info else 0,
        },
        "metrics": [
            {
                "event_type": m.event_type,
                "count": m.count,
                "stars_delta": m.stars_delta or 0,
            }
            for m in metrics
        ],
        "window": window,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/languages")
async def get_languages(
    window: Literal["1h", "6h", "12h", "24h", "7d", "30d"] = Query("24h"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get language statistics."""
    # Check cache first
    cache_key = make_cache_key("languages", window, str(limit))
    cached = await cache_get(cache_key)
    if cached:
        return cached

    time_window = parse_window(window)
    cutoff_time = datetime.utcnow() - time_window

    query = (
        select(
            Repository.language,
            func.count(func.distinct(RepoMetrics.repo_id)).label("repo_count"),
            func.sum(RepoMetrics.stars_delta).label("total_stars"),
            func.count(RepoMetrics.id).label("event_count"),
        )
        .join(Repository, Repository.repo_id == RepoMetrics.repo_id)
        .where(
            and_(
                RepoMetrics.timestamp >= cutoff_time,
                Repository.language.isnot(None),
            )
        )
        .group_by(Repository.language)
        .order_by(desc("event_count"))
        .limit(limit)
    )

    result = await db.execute(query)
    languages = result.all()

    response = {
        "data": [
            {
                "language": lang.language,
                "repo_count": lang.repo_count,
                "total_stars_gained": lang.total_stars or 0,  # Renamed to match frontend
                "event_count": lang.event_count,
            }
            for lang in languages
        ],
        "window": window,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Cache the response
    await cache_set(cache_key, response, CacheTTL.LANGUAGES)

    return response
