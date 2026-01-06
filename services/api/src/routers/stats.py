"""Stats API endpoint for dashboard metrics."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db, RepoMetrics, Repository
from ..cache import cache_get, cache_set, make_cache_key

router = APIRouter(prefix="/api", tags=["stats"])


class StatsResponse(BaseModel):
    """Response model matching frontend expectations."""

    total_events: int
    active_repos: int
    top_language: str | None
    events_per_min: int
    star_events: int
    fork_events: int
    push_events: int
    pr_events: int
    event_breakdown: dict[str, int]
    timestamp: str


@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)) -> StatsResponse:
    """Get dashboard statistics from PostgreSQL.

    Returns aggregated metrics for the last hour, matching
    the frontend's expected response shape.
    """
    # Check cache first
    cache_key = make_cache_key("stats")
    cached = await cache_get(cache_key)
    if cached:
        return StatsResponse(**cached)

    now = datetime.utcnow()
    cutoff_1h = now - timedelta(hours=1)
    cutoff_1m = now - timedelta(minutes=1)

    # Total events in last hour
    total_query = select(func.count(RepoMetrics.id)).where(
        RepoMetrics.timestamp >= cutoff_1h
    )
    total_result = await db.execute(total_query)
    total_events = total_result.scalar() or 0

    # Active repos in last hour
    active_query = select(func.count(func.distinct(RepoMetrics.repo_id))).where(
        RepoMetrics.timestamp >= cutoff_1h
    )
    active_result = await db.execute(active_query)
    active_repos = active_result.scalar() or 0

    # Events per minute (events in last minute)
    epm_query = select(func.count(RepoMetrics.id)).where(
        RepoMetrics.timestamp >= cutoff_1m
    )
    epm_result = await db.execute(epm_query)
    events_per_min = epm_result.scalar() or 0

    # Top language
    lang_query = (
        select(Repository.language, func.count(RepoMetrics.id).label("count"))
        .join(Repository, Repository.repo_id == RepoMetrics.repo_id)
        .where(
            and_(
                RepoMetrics.timestamp >= cutoff_1h,
                Repository.language.isnot(None),
            )
        )
        .group_by(Repository.language)
        .order_by(desc("count"))
        .limit(1)
    )
    lang_result = await db.execute(lang_query)
    lang_row = lang_result.first()
    top_language = lang_row.language if lang_row else None

    # Event breakdown by type
    breakdown_query = (
        select(RepoMetrics.event_type, func.count(RepoMetrics.id).label("count"))
        .where(RepoMetrics.timestamp >= cutoff_1h)
        .group_by(RepoMetrics.event_type)
    )
    breakdown_result = await db.execute(breakdown_query)
    event_breakdown = {row.event_type: row.count for row in breakdown_result.all()}

    # Extract specific event counts
    star_events = event_breakdown.get("WatchEvent", 0)
    fork_events = event_breakdown.get("ForkEvent", 0)
    push_events = event_breakdown.get("PushEvent", 0)
    pr_events = event_breakdown.get("PullRequestEvent", 0)

    response = StatsResponse(
        total_events=total_events,
        active_repos=active_repos,
        top_language=top_language,
        events_per_min=events_per_min,
        star_events=star_events,
        fork_events=fork_events,
        push_events=push_events,
        pr_events=pr_events,
        event_breakdown=event_breakdown,
        timestamp=now.isoformat(),
    )

    # Cache for 10 seconds
    await cache_set(cache_key, response.model_dump(), ttl=10)

    return response
