"""Kafka consumer that processes GitHub events and writes to PostgreSQL."""

import json
import logging
import math
import time
from datetime import datetime, timezone
from typing import Any

import psycopg2
from psycopg2.extras import execute_batch
from kafka import KafkaConsumer
from kafka.errors import KafkaError

from .config import Config

logger = logging.getLogger(__name__)


class GitHubEventProcessor:
    """Processes GitHub events from Kafka and writes to PostgreSQL.

    Features:
    - Batch processing for efficiency
    - Velocity score calculation
    - Repository metadata tracking
    - Graceful error handling
    """

    # Event types that indicate a "star" (WatchEvent is GitHub's star event)
    STAR_EVENTS = {"WatchEvent"}

    # All supported event types
    SUPPORTED_EVENTS = {
        "WatchEvent",      # Stars
        "ForkEvent",       # Forks
        "PushEvent",       # Commits
        "IssuesEvent",     # Issues
        "PullRequestEvent",  # Pull requests
        "CreateEvent",     # Repo/branch/tag creation
        "ReleaseEvent",    # Releases
        "IssueCommentEvent",  # Comments
    }

    def __init__(self, config: Config):
        self.config = config
        self.consumer: KafkaConsumer | None = None
        self.db_conn: psycopg2.extensions.connection | None = None
        self.repo_stars_cache: dict[int, int] = {}  # repo_id -> estimated stars
        self.events_buffer: list[dict[str, Any]] = []
        self.repos_buffer: dict[int, dict[str, Any]] = {}  # repo_id -> repo data

    def _init_consumer(self) -> None:
        """Initialize Kafka consumer."""
        logger.info(f"Connecting to Kafka at {self.config.kafka_bootstrap_servers}")
        self.consumer = KafkaConsumer(
            self.config.kafka_topic,
            bootstrap_servers=self.config.kafka_bootstrap_servers.split(","),
            group_id=self.config.kafka_consumer_group,
            auto_offset_reset=self.config.kafka_auto_offset_reset,
            enable_auto_commit=False,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            consumer_timeout_ms=1000,  # Return from poll after 1 second
        )
        logger.info("Kafka consumer initialized")

    def _init_db(self) -> None:
        """Initialize PostgreSQL connection."""
        logger.info(f"Connecting to PostgreSQL at {self.config.postgres_host}")
        self.db_conn = psycopg2.connect(self.config.postgres_dsn)
        self.db_conn.autocommit = False
        logger.info("PostgreSQL connection established")

    def _calculate_velocity_score(
        self,
        event_type: str,
        repo_id: int,
        total_stars: int,
    ) -> float:
        """Calculate velocity score for an event.

        Velocity Score Formula:
        - Base score depends on event type
        - Normalized by repository size (smaller repos get higher scores for same activity)
        - Star events are weighted highest
        """
        # Base weights by event type
        event_weights = {
            "WatchEvent": 1.0,       # Stars are most valuable
            "ForkEvent": 0.8,        # Forks indicate serious interest
            "PullRequestEvent": 0.6,  # PRs show active development
            "PushEvent": 0.3,        # Commits are routine
            "IssuesEvent": 0.4,      # Issues show engagement
            "CreateEvent": 0.2,      # Creation events
            "ReleaseEvent": 0.5,     # Releases are significant
            "IssueCommentEvent": 0.1,  # Comments are minor
        }

        base_weight = event_weights.get(event_type, 0.1)

        # Size normalization: smaller repos get higher scores
        # Using log scale to prevent extreme values
        size_factor = 1.0 / math.log(max(total_stars, 10) + 1)

        # Final velocity score
        velocity = base_weight * size_factor * 10  # Scale to reasonable range

        return round(velocity, 4)

    def _extract_repo_info(self, event: dict[str, Any]) -> dict[str, Any] | None:
        """Extract repository information from an event."""
        repo = event.get("repo", {})
        repo_id = repo.get("id")
        repo_name = repo.get("name")

        if not repo_id or not repo_name:
            return None

        # Try to get additional info from payload
        payload = event.get("payload", {})
        repo_payload = payload.get("repository", {})

        return {
            "repo_id": repo_id,
            "full_name": repo_name,
            "language": repo_payload.get("language"),
            "description": repo_payload.get("description"),
            "total_stars": repo_payload.get("stargazers_count", 0),
        }

    def _process_event(self, event: dict[str, Any]) -> dict[str, Any] | None:
        """Process a single event and return metrics data."""
        event_type = event.get("type")
        if event_type not in self.SUPPORTED_EVENTS:
            return None

        repo = event.get("repo", {})
        repo_id = repo.get("id")
        repo_name = repo.get("name")

        if not repo_id or not repo_name:
            return None

        # Extract repo info for upsert
        repo_info = self._extract_repo_info(event)
        if repo_info:
            # Update cache with latest star count
            if repo_info["total_stars"]:
                self.repo_stars_cache[repo_id] = repo_info["total_stars"]
            self.repos_buffer[repo_id] = repo_info

        # Get estimated stars for velocity calculation
        total_stars = self.repo_stars_cache.get(repo_id, 0)

        # Calculate stars delta (1 for star events, 0 otherwise)
        stars_delta = 1 if event_type in self.STAR_EVENTS else 0

        # Calculate velocity score
        velocity_score = self._calculate_velocity_score(event_type, repo_id, total_stars)

        # Parse timestamp
        created_at = event.get("created_at")
        if created_at:
            try:
                timestamp = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                timestamp = datetime.now(timezone.utc)
        else:
            timestamp = datetime.now(timezone.utc)

        return {
            "repo_id": repo_id,
            "repo_name": repo_name,
            "event_type": event_type,
            "timestamp": timestamp,
            "stars_delta": stars_delta,
            "velocity_score": velocity_score,
        }

    def _flush_to_db(self) -> int:
        """Flush buffered data to PostgreSQL."""
        if not self.events_buffer and not self.repos_buffer:
            return 0

        if not self.db_conn:
            raise RuntimeError("Database connection not initialized")

        cursor = self.db_conn.cursor()
        records_written = 0

        try:
            # Upsert repositories
            if self.repos_buffer:
                repo_data = [
                    (
                        r["repo_id"],
                        r["full_name"],
                        r["language"],
                        r["description"],
                        r["total_stars"] or 0,
                    )
                    for r in self.repos_buffer.values()
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
                logger.debug(f"Upserted {len(repo_data)} repositories")

            # Insert metrics
            if self.events_buffer:
                metrics_data = [
                    (
                        e["repo_id"],
                        e["repo_name"],
                        e["event_type"],
                        e["timestamp"],
                        e["stars_delta"],
                        e["velocity_score"],
                    )
                    for e in self.events_buffer
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
                records_written = len(metrics_data)
                logger.debug(f"Inserted {records_written} metrics records")

            self.db_conn.commit()

            # Clear buffers
            self.events_buffer.clear()
            self.repos_buffer.clear()

            return records_written

        except Exception as e:
            logger.error(f"Database error: {e}")
            self.db_conn.rollback()
            raise

        finally:
            cursor.close()

    def process_batch(self) -> int:
        """Process a batch of messages from Kafka.

        Returns:
            Number of events processed
        """
        if not self.consumer:
            raise RuntimeError("Consumer not initialized")

        events_processed = 0

        try:
            # Poll for messages
            for message in self.consumer:
                event = message.value

                # Process the event
                metrics = self._process_event(event)
                if metrics:
                    self.events_buffer.append(metrics)
                    events_processed += 1

                # Flush when batch size reached
                if len(self.events_buffer) >= self.config.batch_size:
                    self._flush_to_db()

            # Flush remaining events
            if self.events_buffer:
                self._flush_to_db()

            # Commit Kafka offsets
            if events_processed > 0:
                self.consumer.commit()

        except KafkaError as e:
            logger.error(f"Kafka error: {e}")
            raise

        return events_processed

    def run(self) -> None:
        """Main processing loop."""
        logger.info("Starting GitHub Event Processor")

        self._init_consumer()
        self._init_db()

        total_events = 0
        batch_count = 0
        last_log_time = time.time()

        try:
            while True:
                batch_count += 1
                events_count = self.process_batch()
                total_events += events_count

                # Log stats every 30 seconds
                current_time = time.time()
                if current_time - last_log_time >= 30:
                    logger.info(
                        f"Stats: {total_events} total events processed, "
                        f"{len(self.repo_stars_cache)} repos tracked"
                    )
                    last_log_time = current_time

                # Small sleep to prevent tight loop when no messages
                if events_count == 0:
                    time.sleep(0.1)

        except KeyboardInterrupt:
            logger.info("Shutting down gracefully...")
        finally:
            # Final flush
            if self.events_buffer:
                try:
                    self._flush_to_db()
                except Exception as e:
                    logger.error(f"Error during final flush: {e}")

            # Cleanup
            if self.consumer:
                self.consumer.close()
            if self.db_conn:
                self.db_conn.close()

            logger.info(f"Shutdown complete. Processed {total_events} events total.")
