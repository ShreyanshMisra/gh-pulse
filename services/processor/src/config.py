"""Configuration management for the processor service."""

import os
from dataclasses import dataclass
from dotenv import load_dotenv


@dataclass
class Config:
    """Application configuration loaded from environment variables."""

    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic: str = "github-events-raw"
    kafka_consumer_group: str = "github-processor"
    kafka_auto_offset_reset: str = "earliest"

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "github_analytics"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"

    # Redis (for caching repo metadata)
    redis_url: str = "redis://localhost:6379"

    # Elasticsearch (optional)
    elasticsearch_url: str = "http://localhost:9200"
    elasticsearch_enabled: bool = False

    # Processing
    batch_size: int = 100
    commit_interval: int = 5  # seconds

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        load_dotenv()

        return cls(
            kafka_bootstrap_servers=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
            kafka_topic=os.getenv("KAFKA_TOPIC", "github-events-raw"),
            kafka_consumer_group=os.getenv("KAFKA_CONSUMER_GROUP", "github-processor"),
            kafka_auto_offset_reset=os.getenv("KAFKA_AUTO_OFFSET_RESET", "earliest"),
            postgres_host=os.getenv("POSTGRES_HOST", "localhost"),
            postgres_port=int(os.getenv("POSTGRES_PORT", "5432")),
            postgres_db=os.getenv("POSTGRES_DB", "github_analytics"),
            postgres_user=os.getenv("POSTGRES_USER", "postgres"),
            postgres_password=os.getenv("POSTGRES_PASSWORD", "postgres"),
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
            elasticsearch_url=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"),
            elasticsearch_enabled=os.getenv("ELASTICSEARCH_ENABLED", "false").lower() == "true",
            batch_size=int(os.getenv("BATCH_SIZE", "100")),
            commit_interval=int(os.getenv("COMMIT_INTERVAL", "5")),
        )

    @property
    def postgres_dsn(self) -> str:
        """Build PostgreSQL connection string."""
        return (
            f"host={self.postgres_host} "
            f"port={self.postgres_port} "
            f"dbname={self.postgres_db} "
            f"user={self.postgres_user} "
            f"password={self.postgres_password}"
        )
