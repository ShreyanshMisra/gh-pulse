"""Tests for GitHub event processor."""

import pytest
import math
from unittest.mock import MagicMock, patch, call
from datetime import datetime, timezone

from src.consumer import GitHubEventProcessor


class TestGitHubEventProcessor:
    """Tests for GitHubEventProcessor class."""

    @pytest.fixture
    def processor(self, mock_config):
        """Create a processor instance for testing."""
        return GitHubEventProcessor(mock_config)

    def test_init(self, processor, mock_config):
        """Test processor initialization."""
        assert processor.config == mock_config
        assert processor.consumer is None
        assert processor.db_conn is None
        assert processor.events_buffer == []
        assert processor.repos_buffer == {}

    def test_supported_events(self, processor):
        """Test that expected event types are supported."""
        expected = {
            "WatchEvent",
            "ForkEvent",
            "PushEvent",
            "IssuesEvent",
            "PullRequestEvent",
            "CreateEvent",
            "ReleaseEvent",
            "IssueCommentEvent",
        }
        assert processor.SUPPORTED_EVENTS == expected

    def test_star_events(self, processor):
        """Test that WatchEvent is recognized as a star event."""
        assert processor.STAR_EVENTS == {"WatchEvent"}


class TestVelocityScore:
    """Tests for velocity score calculation."""

    @pytest.fixture
    def processor(self, mock_config):
        """Create a processor instance for testing."""
        return GitHubEventProcessor(mock_config)

    def test_velocity_score_watch_event(self, processor):
        """Test velocity score for WatchEvent (stars)."""
        score = processor._calculate_velocity_score("WatchEvent", 123, 1000)
        # WatchEvent has weight 1.0
        # size_factor = 1 / log(1001) = ~0.145
        # score = 1.0 * 0.145 * 10 = ~1.45
        assert 1.0 < score < 2.0

    def test_velocity_score_fork_event(self, processor):
        """Test velocity score for ForkEvent."""
        score = processor._calculate_velocity_score("ForkEvent", 123, 1000)
        # ForkEvent has weight 0.8
        assert score > 0
        assert score < processor._calculate_velocity_score("WatchEvent", 123, 1000)

    def test_velocity_score_push_event(self, processor):
        """Test velocity score for PushEvent."""
        score = processor._calculate_velocity_score("PushEvent", 123, 1000)
        # PushEvent has weight 0.3
        assert score > 0

    def test_velocity_score_small_repo(self, processor):
        """Test that smaller repos get higher velocity scores."""
        small_repo_score = processor._calculate_velocity_score("WatchEvent", 1, 100)
        large_repo_score = processor._calculate_velocity_score("WatchEvent", 2, 100000)
        assert small_repo_score > large_repo_score

    def test_velocity_score_unknown_event(self, processor):
        """Test velocity score for unknown event type."""
        score = processor._calculate_velocity_score("UnknownEvent", 123, 1000)
        # Default weight is 0.1
        assert score > 0
        assert score < processor._calculate_velocity_score("WatchEvent", 123, 1000)


class TestEventProcessing:
    """Tests for event processing."""

    @pytest.fixture
    def processor(self, mock_config):
        """Create a processor instance for testing."""
        return GitHubEventProcessor(mock_config)

    def test_process_watch_event(self, processor, sample_github_event):
        """Test processing a WatchEvent (star)."""
        result = processor._process_event(sample_github_event)

        assert result is not None
        assert result["repo_id"] == 456
        assert result["repo_name"] == "facebook/react"
        assert result["event_type"] == "WatchEvent"
        assert result["stars_delta"] == 1
        assert result["velocity_score"] > 0

    def test_process_push_event(self, processor, sample_push_event):
        """Test processing a PushEvent."""
        result = processor._process_event(sample_push_event)

        assert result is not None
        assert result["repo_id"] == 789
        assert result["event_type"] == "PushEvent"
        assert result["stars_delta"] == 0  # Not a star event

    def test_process_fork_event(self, processor, sample_fork_event):
        """Test processing a ForkEvent."""
        result = processor._process_event(sample_fork_event)

        assert result is not None
        assert result["repo_id"] == 101
        assert result["event_type"] == "ForkEvent"
        assert result["stars_delta"] == 0  # Not a star event

    def test_process_unsupported_event(self, processor, unsupported_event):
        """Test that unsupported events are skipped."""
        result = processor._process_event(unsupported_event)
        assert result is None

    def test_process_event_missing_repo(self, processor):
        """Test processing event with missing repo info."""
        event = {
            "type": "WatchEvent",
            "actor": {"id": 123},
            "repo": {},  # Missing id and name
        }
        result = processor._process_event(event)
        assert result is None


class TestRepoInfoExtraction:
    """Tests for repository info extraction."""

    @pytest.fixture
    def processor(self, mock_config):
        """Create a processor instance for testing."""
        return GitHubEventProcessor(mock_config)

    def test_extract_repo_info(self, processor, sample_github_event):
        """Test extracting repository info from event."""
        info = processor._extract_repo_info(sample_github_event)

        assert info is not None
        assert info["repo_id"] == 456
        assert info["full_name"] == "facebook/react"
        assert info["language"] == "JavaScript"
        assert info["description"] is not None
        assert info["total_stars"] == 200000

    def test_extract_repo_info_minimal(self, processor, sample_push_event):
        """Test extracting repo info from event without full payload."""
        info = processor._extract_repo_info(sample_push_event)

        assert info is not None
        assert info["repo_id"] == 789
        assert info["full_name"] == "microsoft/vscode"
        # No repository payload, so these are None/0
        assert info["language"] is None
        assert info["total_stars"] == 0

    def test_extract_repo_info_missing(self, processor):
        """Test extracting repo info from event with missing repo."""
        event = {"repo": {}}
        info = processor._extract_repo_info(event)
        assert info is None


class TestBuffering:
    """Tests for event and repo buffering."""

    @pytest.fixture
    def processor(self, mock_config):
        """Create a processor instance for testing."""
        return GitHubEventProcessor(mock_config)

    def test_events_buffer_on_process(self, processor, sample_github_event):
        """Test that processing an event updates buffers."""
        # Initially empty
        assert len(processor.events_buffer) == 0
        assert len(processor.repos_buffer) == 0

        # Process event
        result = processor._process_event(sample_github_event)

        # Repos buffer should be updated
        assert 456 in processor.repos_buffer
        assert processor.repos_buffer[456]["full_name"] == "facebook/react"

    def test_stars_cache_update(self, processor, sample_github_event):
        """Test that stars cache is updated on processing."""
        # Initially empty
        assert len(processor.repo_stars_cache) == 0

        # Process event
        processor._process_event(sample_github_event)

        # Cache should be updated
        assert 456 in processor.repo_stars_cache
        assert processor.repo_stars_cache[456] == 200000


class TestTimestampParsing:
    """Tests for timestamp parsing."""

    @pytest.fixture
    def processor(self, mock_config):
        """Create a processor instance for testing."""
        return GitHubEventProcessor(mock_config)

    def test_parse_iso_timestamp(self, processor, sample_github_event):
        """Test parsing ISO timestamp from event."""
        result = processor._process_event(sample_github_event)
        assert result is not None
        assert isinstance(result["timestamp"], datetime)
        assert result["timestamp"].tzinfo is not None

    def test_parse_missing_timestamp(self, processor):
        """Test handling missing timestamp."""
        event = {
            "type": "WatchEvent",
            "repo": {"id": 123, "name": "test/repo"},
            "payload": {},
            # No created_at
        }
        result = processor._process_event(event)
        assert result is not None
        assert isinstance(result["timestamp"], datetime)
