"""Shared constants for GitHub event processing."""

# Event types that indicate a "star" (WatchEvent is GitHub's star event)
STAR_EVENTS = {"WatchEvent"}

# All supported event types
SUPPORTED_EVENTS = {
    "WatchEvent",        # Stars
    "ForkEvent",         # Forks
    "PushEvent",         # Commits
    "IssuesEvent",       # Issues
    "PullRequestEvent",  # Pull requests
    "CreateEvent",       # Repo/branch/tag creation
    "ReleaseEvent",      # Releases
    "IssueCommentEvent", # Comments
}

# Base weights by event type for velocity scoring
EVENT_WEIGHTS = {
    "WatchEvent": 1.0,        # Stars are most valuable
    "ForkEvent": 0.8,         # Forks indicate serious interest
    "PullRequestEvent": 0.6,  # PRs show active development
    "ReleaseEvent": 0.5,      # Releases are significant
    "IssuesEvent": 0.4,       # Issues show engagement
    "PushEvent": 0.3,         # Commits are routine
    "CreateEvent": 0.2,       # Creation events
    "IssueCommentEvent": 0.1, # Comments are minor
}
