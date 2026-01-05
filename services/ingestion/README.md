# GitHub Ingestion Service

Polls the GitHub Events API and publishes events to Kafka for downstream processing.

## Features

- Token rotation for rate limit management
- ETag caching to minimize API calls
- Configurable poll interval
- Automatic retry with exponential backoff
