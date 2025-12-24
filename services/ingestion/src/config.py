"""Configuration management for the ingestion service."""

import os
from dataclasses import dataclass, field
from dotenv import load_dotenv


@dataclass
class Config:
    """Application configuration loaded from environment variables."""

    github_tokens: list[str] = field(default_factory=list)
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic: str = "github-events-raw"
    poll_interval: int = 10
    events_per_page: int = 100
    max_retries: int = 3
    retry_base_delay: float = 1.0
    retry_max_delay: float = 60.0

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        load_dotenv()

        tokens_str = os.getenv("GITHUB_TOKENS", "")
        tokens = [t.strip() for t in tokens_str.split(",") if t.strip()]

        return cls(
            github_tokens=tokens,
            kafka_bootstrap_servers=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
            kafka_topic=os.getenv("KAFKA_TOPIC", "github-events-raw"),
            poll_interval=int(os.getenv("POLL_INTERVAL", "10")),
            events_per_page=int(os.getenv("EVENTS_PER_PAGE", "100")),
            max_retries=int(os.getenv("MAX_RETRIES", "3")),
            retry_base_delay=float(os.getenv("RETRY_BASE_DELAY", "1.0")),
            retry_max_delay=float(os.getenv("RETRY_MAX_DELAY", "60.0")),
        )

    def validate(self) -> None:
        """Validate the configuration."""
        if not self.github_tokens:
            raise ValueError(
                "No GitHub tokens provided. Set GITHUB_TOKENS environment variable."
            )
        if not self.kafka_bootstrap_servers:
            raise ValueError(
                "Kafka bootstrap servers not provided. Set KAFKA_BOOTSTRAP_SERVERS."
            )
