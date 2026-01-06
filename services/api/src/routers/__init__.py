"""API routers package."""

from .trending import router as trending_router
from .websocket import router as websocket_router
from .search import router as search_router
from .stats import router as stats_router

__all__ = ["trending_router", "websocket_router", "search_router", "stats_router"]
