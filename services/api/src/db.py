"""Database connection and session management."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, BigInteger, Text, Float, DateTime, func

from .config import get_settings


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""

    pass


class RepoMetrics(Base):
    """Time-series metrics for repositories."""

    __tablename__ = "repo_metrics"

    id = Column(Integer, primary_key=True)
    repo_id = Column(BigInteger, nullable=False, index=True)
    repo_name = Column(Text, nullable=False)
    event_type = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    stars_delta = Column(Integer, default=0)
    velocity_score = Column(Float, default=0.0)


class Repository(Base):
    """Repository master data."""

    __tablename__ = "repositories"

    repo_id = Column(BigInteger, primary_key=True)
    full_name = Column(Text, nullable=False)
    language = Column(Text)
    description = Column(Text)
    total_stars = Column(Integer, default=0)
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_updated_at = Column(DateTime(timezone=True), server_default=func.now())


# Global engine and session factory
_engine = None
_session_factory = None


def get_engine():
    """Get or create the database engine."""
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.database_url,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            echo=False,
        )
    return _engine


def get_session_factory():
    """Get or create the session factory."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database sessions."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for database sessions."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Initialize database connection pool."""
    engine = get_engine()
    # Verify connection
    async with engine.begin():
        pass


async def close_db() -> None:
    """Close database connection pool."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
