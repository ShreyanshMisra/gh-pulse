"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import init_db, close_db
from .cache import init_redis, close_redis
from .routers import trending_router, websocket_router, search_router, stats_router
from .routers.search import init_elasticsearch, close_elasticsearch
from .middleware import RateLimitMiddleware, RequestLoggingMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Starting up GitHub Activity Stream API...")

    # Initialize database
    try:
        await init_db()
        logger.info("Database connection established")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise

    # Initialize Redis (non-fatal if fails)
    try:
        await init_redis()
    except Exception as e:
        logger.warning(f"Redis initialization failed: {e}")

    # Initialize Elasticsearch (non-fatal if fails)
    try:
        await init_elasticsearch()
    except Exception as e:
        logger.warning(f"Elasticsearch initialization failed: {e}")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await close_elasticsearch()
    await close_redis()
    await close_db()
    logger.info("Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="GitHub Activity Stream Analyzer",
    description="Real-time analytics for GitHub events - Bloomberg Terminal for GitHub",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Add rate limiting middleware
app.add_middleware(RateLimitMiddleware, requests_per_minute=120, requests_per_second=20)

# Add request logging middleware
app.add_middleware(RequestLoggingMiddleware)

# Configure CORS
settings = get_settings()
cors_origins = [origin.strip() for origin in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include routers
app.include_router(trending_router)
app.include_router(websocket_router)
app.include_router(search_router)
app.include_router(stats_router)


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "0.1.0",
    }


@app.get("/")
async def root() -> dict:
    """Root endpoint with API info."""
    return {
        "name": "GitHub Activity Stream Analyzer",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "trending": "/api/trending",
            "languages": "/api/languages",
            "stats": "/api/stats",
            "repo_metrics": "/api/repos/{owner}/{repo}/metrics",
        },
    }


def main():
    """Run the application with uvicorn (development only)."""
    import os
    import uvicorn

    settings = get_settings()
    is_dev = os.getenv("ENVIRONMENT", "production") == "development"
    uvicorn.run(
        "src.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=is_dev,
    )


if __name__ == "__main__":
    main()
