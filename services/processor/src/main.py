"""Main entry point for the GitHub Events Processor Service."""

import logging
import sys

from .config import Config
from .consumer import GitHubEventProcessor


def setup_logging() -> None:
    """Configure logging for the application."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )
    # Reduce noise from libraries
    logging.getLogger("kafka").setLevel(logging.WARNING)


def main() -> None:
    """Main entry point."""
    setup_logging()
    logger = logging.getLogger(__name__)

    try:
        # Load configuration
        config = Config.from_env()

        logger.info("Configuration loaded successfully")
        logger.info(f"Kafka servers: {config.kafka_bootstrap_servers}")
        logger.info(f"Kafka topic: {config.kafka_topic}")
        logger.info(f"PostgreSQL: {config.postgres_host}:{config.postgres_port}/{config.postgres_db}")
        logger.info(f"Batch size: {config.batch_size}")

        # Create and run processor
        processor = GitHubEventProcessor(config)
        processor.run()

    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
