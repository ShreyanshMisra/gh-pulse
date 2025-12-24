"""GitHub Events API poller with token rotation and exponential backoff."""

import json
import logging
import time
from datetime import datetime
from typing import Any

import requests
from kafka import KafkaProducer
from kafka.errors import KafkaError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from .config import Config

logger = logging.getLogger(__name__)


class GitHubEventPoller:
    """Polls GitHub Events API and publishes events to Kafka.

    Features:
    - Token rotation on rate limit (403)
    - Exponential backoff on errors
    - ETag caching to reduce API usage
    - Graceful error handling
    """

    GITHUB_EVENTS_URL = "https://api.github.com/events"

    def __init__(self, config: Config):
        self.config = config
        self.tokens = config.github_tokens
        self.current_token_idx = 0
        self.etag: str | None = None
        self.producer: KafkaProducer | None = None
        self.seen_event_ids: set[str] = set()
        self.max_seen_events = 10000  # Prevent unbounded memory growth

    def _get_current_token(self) -> str:
        """Get the current GitHub token."""
        return self.tokens[self.current_token_idx]

    def _rotate_token(self) -> None:
        """Rotate to the next available token."""
        self.current_token_idx = (self.current_token_idx + 1) % len(self.tokens)
        logger.info(f"Rotated to token {self.current_token_idx + 1}/{len(self.tokens)}")

    def _get_headers(self) -> dict[str, str]:
        """Build request headers with authentication and ETag."""
        headers = {
            "Authorization": f"Bearer {self._get_current_token()}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "GitHub-Activity-Stream-Analyzer/1.0",
        }
        if self.etag:
            headers["If-None-Match"] = self.etag
        return headers

    def _init_producer(self) -> None:
        """Initialize Kafka producer with retry logic."""
        if self.producer is not None:
            return

        logger.info(f"Connecting to Kafka at {self.config.kafka_bootstrap_servers}")
        self.producer = KafkaProducer(
            bootstrap_servers=self.config.kafka_bootstrap_servers.split(","),
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            acks="all",
            retries=3,
            max_in_flight_requests_per_connection=1,
        )
        logger.info("Kafka producer initialized successfully")

    def _publish_event(self, event: dict[str, Any]) -> None:
        """Publish a single event to Kafka."""
        if self.producer is None:
            raise RuntimeError("Kafka producer not initialized")

        event_id = event.get("id", "")
        repo_id = str(event.get("repo", {}).get("id", "unknown"))

        # Add ingestion timestamp
        event["ingested_at"] = datetime.utcnow().isoformat()

        try:
            future = self.producer.send(
                self.config.kafka_topic,
                key=repo_id,  # Partition by repo for ordering
                value=event,
            )
            # Don't block on every message, but log errors
            future.add_errback(lambda e: logger.error(f"Failed to send event {event_id}: {e}"))
        except KafkaError as e:
            logger.error(f"Kafka error publishing event {event_id}: {e}")
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=60),
        retry=retry_if_exception_type(requests.RequestException),
    )
    def _fetch_events(self) -> tuple[list[dict[str, Any]], int]:
        """Fetch events from GitHub API with retry logic.

        Returns:
            Tuple of (events list, status code)
        """
        response = requests.get(
            self.GITHUB_EVENTS_URL,
            headers=self._get_headers(),
            params={"per_page": self.config.events_per_page},
            timeout=30,
        )

        # Update ETag for next request
        new_etag = response.headers.get("ETag")
        if new_etag:
            self.etag = new_etag

        # Log rate limit info
        remaining = response.headers.get("X-RateLimit-Remaining", "unknown")
        reset_time = response.headers.get("X-RateLimit-Reset", "unknown")
        logger.debug(f"Rate limit remaining: {remaining}, resets at: {reset_time}")

        if response.status_code == 304:
            # Not modified - no new events
            return [], 304

        if response.status_code == 403:
            # Rate limited
            logger.warning(f"Rate limited on token {self.current_token_idx + 1}")
            self._rotate_token()
            self.etag = None  # Clear ETag on token rotation
            return [], 403

        response.raise_for_status()
        return response.json(), response.status_code

    def _dedupe_events(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Remove duplicate events based on event ID."""
        new_events = []
        for event in events:
            event_id = event.get("id")
            if event_id and event_id not in self.seen_event_ids:
                self.seen_event_ids.add(event_id)
                new_events.append(event)

        # Prevent unbounded memory growth
        if len(self.seen_event_ids) > self.max_seen_events:
            # Keep only the most recent half
            self.seen_event_ids = set(list(self.seen_event_ids)[self.max_seen_events // 2:])

        return new_events

    def poll_once(self) -> int:
        """Poll GitHub API once and publish events.

        Returns:
            Number of events published
        """
        try:
            events, status_code = self._fetch_events()

            if status_code == 304:
                logger.debug("No new events (304 Not Modified)")
                return 0

            if status_code == 403:
                # Token rotated, will retry on next poll
                return 0

            # Deduplicate events
            new_events = self._dedupe_events(events)

            if not new_events:
                logger.debug("No new unique events after deduplication")
                return 0

            # Publish to Kafka
            for event in new_events:
                self._publish_event(event)

            # Flush to ensure events are sent
            if self.producer:
                self.producer.flush(timeout=10)

            logger.info(f"Published {len(new_events)} events to Kafka")
            return len(new_events)

        except requests.RequestException as e:
            logger.error(f"Failed to fetch events: {e}")
            return 0
        except KafkaError as e:
            logger.error(f"Kafka error: {e}")
            return 0

    def run(self) -> None:
        """Main polling loop - runs indefinitely."""
        logger.info("Starting GitHub Event Poller")
        logger.info(f"Using {len(self.tokens)} GitHub token(s)")
        logger.info(f"Poll interval: {self.config.poll_interval}s")
        logger.info(f"Kafka topic: {self.config.kafka_topic}")

        self._init_producer()

        total_events = 0
        poll_count = 0

        try:
            while True:
                poll_count += 1
                events_count = self.poll_once()
                total_events += events_count

                if poll_count % 10 == 0:
                    logger.info(f"Stats: {total_events} total events after {poll_count} polls")

                time.sleep(self.config.poll_interval)

        except KeyboardInterrupt:
            logger.info("Shutting down gracefully...")
        finally:
            if self.producer:
                self.producer.flush()
                self.producer.close()
            logger.info(f"Shutdown complete. Published {total_events} events total.")
