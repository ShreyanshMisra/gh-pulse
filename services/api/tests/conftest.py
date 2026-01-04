"""Pytest fixtures for API tests."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from src.main import app
from src.db import Base, get_db, RepoMetrics, Repository


# Test database URL (in-memory SQLite for tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def test_engine():
    """Create a test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine):
    """Create a test database session."""
    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(test_session):
    """Create a test client with mocked dependencies."""

    async def override_get_db():
        yield test_session

    app.dependency_overrides[get_db] = override_get_db

    # Mock Redis and Elasticsearch initialization
    with patch("src.main.init_redis", new_callable=AsyncMock), \
         patch("src.main.init_elasticsearch", new_callable=AsyncMock), \
         patch("src.main.close_redis", new_callable=AsyncMock), \
         patch("src.main.close_elasticsearch", new_callable=AsyncMock):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def sample_repos(test_session):
    """Create sample repository data."""
    repos = [
        Repository(
            repo_id=1,
            full_name="facebook/react",
            language="JavaScript",
            description="A declarative, efficient, and flexible JavaScript library for building user interfaces.",
            total_stars=200000,
        ),
        Repository(
            repo_id=2,
            full_name="microsoft/vscode",
            language="TypeScript",
            description="Visual Studio Code",
            total_stars=150000,
        ),
        Repository(
            repo_id=3,
            full_name="torvalds/linux",
            language="C",
            description="Linux kernel source tree",
            total_stars=160000,
        ),
    ]

    for repo in repos:
        test_session.add(repo)

    await test_session.commit()
    return repos


@pytest_asyncio.fixture
async def sample_metrics(test_session, sample_repos):
    """Create sample metrics data."""
    now = datetime.utcnow()
    metrics = []

    # Create metrics for each repo
    for repo in sample_repos:
        for i in range(5):
            metric = RepoMetrics(
                repo_id=repo.repo_id,
                repo_name=repo.full_name,
                event_type="WatchEvent",
                timestamp=now - timedelta(hours=i),
                stars_delta=1,
                velocity_score=5.0 - (i * 0.5),
            )
            metrics.append(metric)
            test_session.add(metric)

    await test_session.commit()
    return metrics
