"""Database utilities for GitHub event processing."""

from typing import Any
from psycopg2.extras import execute_batch


REPO_UPSERT_SQL = """
    INSERT INTO repositories (repo_id, full_name, language, description, total_stars, last_updated_at)
    VALUES (%s, %s, %s, %s, %s, NOW())
    ON CONFLICT (repo_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        language = COALESCE(EXCLUDED.language, repositories.language),
        description = COALESCE(EXCLUDED.description, repositories.description),
        total_stars = GREATEST(EXCLUDED.total_stars, repositories.total_stars),
        last_updated_at = NOW()
"""

METRICS_INSERT_SQL = """
    INSERT INTO repo_metrics (repo_id, repo_name, event_type, timestamp, stars_delta, velocity_score)
    VALUES (%s, %s, %s, %s, %s, %s)
"""


def upsert_repositories(cursor, repos: list[dict[str, Any]], page_size: int = 100) -> int:
    """Upsert repository records to PostgreSQL.

    Args:
        cursor: Database cursor
        repos: List of repository dicts with keys:
            - repo_id: int
            - full_name: str
            - language: str | None
            - description: str | None
            - total_stars: int
        page_size: Batch size for execute_batch

    Returns:
        Number of repositories upserted
    """
    if not repos:
        return 0

    repo_data = [
        (
            r["repo_id"],
            r["full_name"],
            r["language"],
            r["description"],
            r["total_stars"] or 0,
        )
        for r in repos
    ]

    execute_batch(cursor, REPO_UPSERT_SQL, repo_data, page_size=page_size)
    return len(repo_data)


def insert_metrics(cursor, metrics: list[dict[str, Any]], page_size: int = 100) -> int:
    """Insert metrics records to PostgreSQL.

    Args:
        cursor: Database cursor
        metrics: List of metric dicts with keys:
            - repo_id: int
            - repo_name: str
            - event_type: str
            - timestamp: datetime
            - stars_delta: int
            - velocity_score: float
        page_size: Batch size for execute_batch

    Returns:
        Number of metrics records inserted
    """
    if not metrics:
        return 0

    metrics_data = [
        (
            m["repo_id"],
            m["repo_name"],
            m["event_type"],
            m["timestamp"],
            m["stars_delta"],
            m["velocity_score"],
        )
        for m in metrics
    ]

    execute_batch(cursor, METRICS_INSERT_SQL, metrics_data, page_size=page_size)
    return len(metrics_data)
