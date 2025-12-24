"""Main entry point for the GitHub Events Ingestion Service."""

import logging
import sys

from .config import Config
from .poller import GitHubEventPoller


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
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def main() -> None:
    """Main entry point."""
    setup_logging()
    logger = logging.getLogger(__name__)

    try:
        # Load and validate configuration
        config = Config.from_env()
        config.validate()

        logger.info("Configuration loaded successfully")
        logger.info(f"GitHub tokens configured: {len(config.github_tokens)}")
        logger.info(f"Kafka servers: {config.kafka_bootstrap_servers}")

        # Create and run poller
        poller = GitHubEventPoller(config)
        poller.run()

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
