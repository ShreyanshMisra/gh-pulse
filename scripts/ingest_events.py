#!/usr/bin/env python3
"""
GitHub Events Ingestion Script for GitHub Actions.

Fetches events from GitHub API and writes processed metrics to PostgreSQL.
Designed to run as a scheduled GitHub Action.
"""

import json
import math
import os
import sys
from datetime import datetime, timezone

import psycopg2
import requests
from psycopg2.extras import execute_batch


# Event types and their weights for velocity scoring
EVENT_WEIGHTS = {
    "WatchEvent": 1.0,       # Stars are most valuable
    "ForkEvent": 0.8,        # Forks indicate serious interest
    "PullRequestEvent": 0.6, # PRs show active development
    "PushEvent": 0.3,        # Commits are routine
    "IssuesEvent": 0.4,      # Issues show engagement
    "CreateEvent": 0.2,      # Creation events
    "ReleaseEvent": 0.5,     # Releases are significant
    "IssueCommentEvent": 0.1,# Comments are minor
}

STAR_EVENTS = {"WatchEvent"}


def calculate_velocity_score(event_type: str, total_stars: int) -> float:
    """Calculate velocity score for an event."""
    base_weight = EVENT_WEIGHTS.get(event_type, 0.1)
    size_factor = 1.0 / math.log(max(total_stars, 10) + 1)
    velocity = base_weight * size_factor * 10
    return round(velocity, 4)


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
    """Write processed data to PostgreSQL."""
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    try:
        # Upsert repositories
        if repos:
            repo_data = [
                (r["repo_id"], r["full_name"], r["language"], r["description"], r["total_stars"] or 0)
                for r in repos
            ]
            execute_batch(
                cursor,
                """
                INSERT INTO repositories (repo_id, full_name, language, description, total_stars, last_updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (repo_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    language = COALESCE(EXCLUDED.language, repositories.language),
                    description = COALESCE(EXCLUDED.description, repositories.description),
                    total_stars = GREATEST(EXCLUDED.total_stars, repositories.total_stars),
                    last_updated_at = NOW()
                """,
                repo_data,
                page_size=100,
            )
            print(f"Upserted {len(repos)} repositories")

        # Insert metrics
        if metrics:
            metrics_data = [
                (m["repo_id"], m["repo_name"], m["event_type"], m["timestamp"], m["stars_delta"], m["velocity_score"])
                for m in metrics
            ]
            execute_batch(
                cursor,
                """
                INSERT INTO repo_metrics (repo_id, repo_name, event_type, timestamp, stars_delta, velocity_score)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                metrics_data,
                page_size=100,
            )
            print(f"Inserted {len(metrics)} metrics records")

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
