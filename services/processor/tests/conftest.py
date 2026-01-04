"""Pytest fixtures for processor tests."""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

from src.config import Config


@pytest.fixture
def mock_config():
    """Create a mock configuration."""
    config = MagicMock(spec=Config)
    config.kafka_bootstrap_servers = "localhost:9092"
    config.kafka_topic = "github-events-raw"
    config.kafka_consumer_group = "test-processor"
    config.kafka_auto_offset_reset = "earliest"
    config.postgres_dsn = "postgresql://test:test@localhost:5432/test"
    config.postgres_host = "localhost"
    config.batch_size = 10
    return config


@pytest.fixture
def sample_github_event():
    """Create a sample GitHub event."""
    return {
        "id": "12345678901",
        "type": "WatchEvent",
        "actor": {
            "id": 123,
            "login": "testuser",
            "display_login": "testuser",
            "gravatar_id": "",
            "url": "https://api.github.com/users/testuser",
            "avatar_url": "https://avatars.githubusercontent.com/u/123?",
        },
        "repo": {
            "id": 456,
            "name": "facebook/react",
            "url": "https://api.github.com/repos/facebook/react",
        },
        "payload": {
            "action": "started",
            "repository": {
                "id": 456,
                "name": "react",
                "full_name": "facebook/react",
                "language": "JavaScript",
                "description": "A declarative, efficient, and flexible JavaScript library for building user interfaces.",
                "stargazers_count": 200000,
            },
        },
        "public": True,
        "created_at": "2024-01-15T10:30:00Z",
    }


@pytest.fixture
def sample_push_event():
    """Create a sample PushEvent."""
    return {
        "id": "12345678902",
        "type": "PushEvent",
        "actor": {
            "id": 124,
            "login": "developer",
        },
        "repo": {
            "id": 789,
            "name": "microsoft/vscode",
        },
        "payload": {
            "push_id": 123456,
            "size": 3,
            "distinct_size": 3,
            "ref": "refs/heads/main",
            "commits": [
                {"sha": "abc123", "message": "Fix bug"},
                {"sha": "def456", "message": "Add feature"},
                {"sha": "ghi789", "message": "Update docs"},
            ],
        },
        "created_at": "2024-01-15T11:00:00Z",
    }


@pytest.fixture
def sample_fork_event():
    """Create a sample ForkEvent."""
    return {
        "id": "12345678903",
        "type": "ForkEvent",
        "actor": {
            "id": 125,
            "login": "contributor",
        },
        "repo": {
            "id": 101,
            "name": "torvalds/linux",
        },
        "payload": {
            "forkee": {
                "id": 999,
                "name": "linux",
                "full_name": "contributor/linux",
            },
        },
        "created_at": "2024-01-15T12:00:00Z",
    }


@pytest.fixture
def unsupported_event():
    """Create an unsupported event type."""
    return {
        "id": "12345678904",
        "type": "GollumEvent",  # Wiki event - not supported
        "actor": {
            "id": 126,
            "login": "wikiuser",
        },
        "repo": {
            "id": 102,
            "name": "some/repo",
        },
        "payload": {},
        "created_at": "2024-01-15T13:00:00Z",
    }
