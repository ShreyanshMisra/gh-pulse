"""Velocity score calculation for GitHub events."""

import math
from .constants import EVENT_WEIGHTS


def calculate_velocity_score(event_type: str, total_stars: int) -> float:
    """Calculate velocity score for an event.

    Velocity Score Formula:
    - Base score depends on event type
    - Normalized by repository size (smaller repos get higher scores)
    - Star events are weighted highest

    Args:
        event_type: The GitHub event type (e.g., "WatchEvent")
        total_stars: Total star count of the repository

    Returns:
        Velocity score rounded to 4 decimal places
    """
    base_weight = EVENT_WEIGHTS.get(event_type, 0.1)

    # Size normalization: smaller repos get higher scores
    # Using log scale to prevent extreme values
    size_factor = 1.0 / math.log(max(total_stars, 10) + 1)

    # Final velocity score
    velocity = base_weight * size_factor * 10  # Scale to reasonable range

    return round(velocity, 4)
