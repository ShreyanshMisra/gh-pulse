"""WebSocket endpoint for real-time updates."""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db_context, RepoMetrics, Repository

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._broadcast_task: asyncio.Task | None = None
        self._running = False

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

        # Start broadcast task if not running
        if not self._running:
            self._running = True
            self._broadcast_task = asyncio.create_task(self._broadcast_loop())

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

        # Stop broadcast task if no connections
        if not self.active_connections and self._broadcast_task:
            self._running = False

    async def broadcast(self, message: dict) -> None:
        """Send a message to all connected clients."""
        if not self.active_connections:
            return

        message_json = json.dumps(message, default=str)
        disconnected = set()

        for connection in self.active_connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket: {e}")
                disconnected.add(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.active_connections.discard(conn)

    async def _broadcast_loop(self) -> None:
        """Periodically broadcast updates to all clients."""
        while self._running and self.active_connections:
            try:
                # Fetch latest data
                data = await self._get_live_data()
                await self.broadcast(data)
            except Exception as e:
                logger.error(f"Broadcast error: {e}")

            # Wait before next broadcast
            await asyncio.sleep(5)  # Broadcast every 5 seconds

    async def _get_live_data(self) -> dict:
        """Fetch live data for broadcasting."""
        async with get_db_context() as db:
            now = datetime.utcnow()
            cutoff_1m = now - timedelta(minutes=1)
            cutoff_1h = now - timedelta(hours=1)

            # Get events in last minute (for events/min calculation)
            events_query = select(func.count(RepoMetrics.id)).where(
                RepoMetrics.timestamp >= cutoff_1m
            )
            events_result = await db.execute(events_query)
            events_per_min = events_result.scalar() or 0

            # Get active repos in last hour
            active_repos_query = select(
                func.count(func.distinct(RepoMetrics.repo_id))
            ).where(RepoMetrics.timestamp >= cutoff_1h)
            active_result = await db.execute(active_repos_query)
            active_repos = active_result.scalar() or 0

            # Get total events in last hour
            total_events_query = select(func.count(RepoMetrics.id)).where(
                RepoMetrics.timestamp >= cutoff_1h
            )
            total_result = await db.execute(total_events_query)
            total_events = total_result.scalar() or 0

            # Get top language
            top_lang_query = (
                select(Repository.language, func.count(RepoMetrics.id).label("count"))
                .join(Repository, Repository.repo_id == RepoMetrics.repo_id)
                .where(RepoMetrics.timestamp >= cutoff_1h)
                .where(Repository.language.isnot(None))
                .group_by(Repository.language)
                .order_by(desc("count"))
                .limit(1)
            )
            top_lang_result = await db.execute(top_lang_query)
            top_lang_row = top_lang_result.first()
            top_language = top_lang_row.language if top_lang_row else None

            # Get recent trending repos (top 5)
            trending_query = (
                select(
                    RepoMetrics.repo_name,
                    func.sum(RepoMetrics.stars_delta).label("stars_gained"),
                    func.avg(RepoMetrics.velocity_score).label("velocity"),
                )
                .where(RepoMetrics.timestamp >= cutoff_1h)
                .group_by(RepoMetrics.repo_id, RepoMetrics.repo_name)
                .order_by(desc("velocity"))
                .limit(5)
            )
            trending_result = await db.execute(trending_query)
            trending = [
                {
                    "repo_name": row.repo_name,
                    "stars_gained": row.stars_gained or 0,
                    "velocity": round(row.velocity or 0, 4),
                }
                for row in trending_result.all()
            ]

            return {
                "type": "update",
                "timestamp": now.isoformat(),
                "stats": {
                    "events_per_min": events_per_min,
                    "active_repos": active_repos,
                    "total_events": total_events,
                    "top_language": top_language,
                },
                "trending": trending,
            }


# Global connection manager
manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates.

    Clients receive periodic updates with:
    - Current stats (events/min, active repos, etc.)
    - Top trending repositories
    """
    await manager.connect(websocket)

    try:
        # Send initial data immediately
        initial_data = await manager._get_live_data()
        await websocket.send_json(initial_data)

        # Keep connection alive and handle client messages
        while True:
            try:
                # Wait for client messages (ping/pong or commands)
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=60.0  # Timeout for keepalive
                )

                # Handle ping
                if data == "ping":
                    await websocket.send_text("pong")

            except asyncio.TimeoutError:
                # Send keepalive ping
                try:
                    await websocket.send_text(json.dumps({"type": "ping"}))
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)


@router.get("/ws/stats")
async def get_current_stats() -> dict:
    """Get current stats (non-WebSocket fallback).

    Returns the same data that would be sent via WebSocket.
    Useful for initial page load or when WebSocket is unavailable.
    """
    return await manager._get_live_data()
