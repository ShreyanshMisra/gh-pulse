#!/usr/bin/env python3
"""
GitHub Events Ingestion Script for GitHub Actions.

Fetches events from GitHub API and writes processed metrics to PostgreSQL.
Designed to run as a scheduled GitHub Action.

Uses shared package for velocity calculation and DB operations.
"""

import os
import sys
from datetime import datetime, timezone

import psycopg2
import requests

# Add shared package to path (for GitHub Actions which pip installs from local)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'services', 'shared', 'src'))

from shared.constants import EVENT_WEIGHTS, STAR_EVENTS
from shared.velocity import calculate_velocity_score
from shared.db_utils import upsert_repositories, insert_metrics


def fetch_github_events(token: str) -> list[dict]:
    """Fetch latest events from GitHub API."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    response = requests.get(
        "https://api.github.com/events",
        headers=headers,
        params={"per_page": 100},
        timeout=30,
    )
    response.raise_for_status()

    remaining = response.headers.get("X-RateLimit-Remaining", "?")
    print(f"Fetched {len(response.json())} events. Rate limit remaining: {remaining}")

    return response.json()


def process_events(events: list[dict]) -> tuple[list[dict], list[dict]]:
    """Process events and return (repos, metrics) tuples."""
    repos = {}
    metrics = []

    for event in events:
        event_type = event.get("type")
        if event_type not in EVENT_WEIGHTS:
            continue

        repo = event.get("repo", {})
        repo_id = repo.get("id")
        repo_name = repo.get("name")

        if not repo_id or not repo_name:
            continue

        # Extract repo info
        payload = event.get("payload", {})
        repo_payload = payload.get("repository", {})
        total_stars = repo_payload.get("stargazers_count", 0)

        repos[repo_id] = {
            "repo_id": repo_id,
            "full_name": repo_name,
            "language": repo_payload.get("language"),
            "description": repo_payload.get("description", "")[:500] if repo_payload.get("description") else None,
            "total_stars": total_stars,
        }

        # Parse timestamp
        created_at = event.get("created_at")
        try:
            timestamp = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except (ValueError, AttributeError, TypeError):
            timestamp = datetime.now(timezone.utc)

        metrics.append({
            "repo_id": repo_id,
            "repo_name": repo_name,
            "event_type": event_type,
            "timestamp": timestamp,
            "stars_delta": 1 if event_type in STAR_EVENTS else 0,
            "velocity_score": calculate_velocity_score(event_type, total_stars),
        })

    return list(repos.values()), metrics


def write_to_database(database_url: str, repos: list[dict], metrics: list[dict]) -> None:
    """Write processed data to PostgreSQL using shared utilities."""
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    try:
        # Use shared DB utilities
        repo_count = upsert_repositories(cursor, repos)
        print(f"Upserted {repo_count} repositories")

        metrics_count = insert_metrics(cursor, metrics)
        print(f"Inserted {metrics_count} metrics records")

        conn.commit()
        print("Database commit successful")

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def main():
    """Main entry point."""
    token = os.environ.get("GITHUB_TOKEN")
    database_url = os.environ.get("DATABASE_URL")

    if not token:
        print("Error: GITHUB_TOKEN environment variable not set")
        sys.exit(1)

    if not database_url:
        print("Error: DATABASE_URL environment variable not set")
        sys.exit(1)

    print(f"Starting ingestion at {datetime.now(timezone.utc).isoformat()}")

    # Fetch events
    events = fetch_github_events(token)

    # Process events
    repos, metrics = process_events(events)
    print(f"Processed {len(metrics)} events from {len(repos)} repositories")

    # Write to database
    write_to_database(database_url, repos, metrics)

    print(f"Ingestion complete at {datetime.now(timezone.utc).isoformat()}")


if __name__ == "__main__":
    main()
