"""Async SQLAlchemy engine and session factory."""

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from src.config import settings

_engine: Any = None
_session_factory: Any = None


def get_engine() -> Any:
    """Lazily create and return the async engine."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.async_db_url,
            pool_size=10,
            max_overflow=20,
            pool_recycle=3600,
            echo=False,
        )
    return _engine


def get_session_factory() -> Any:
    """Return the async sessionmaker."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session."""
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async session."""
    async with get_async_session() as session:
        yield session


async def init_db() -> None:
    """Create database if not exists, then create all tables."""
    from src.config import settings

    # Step 1: Create database if not exists (connect to default 'mysql' db)
    base_url = (
        f"mysql+aiomysql://{settings.DB_USER}:{settings.DB_PASSWORD}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/mysql"
    )
    engine_base = create_async_engine(base_url, echo=False)
    try:
        async with engine_base.begin() as conn:
            await conn.execute(
                text(
                    f"CREATE DATABASE IF NOT EXISTS `{settings.DB_NAME}` "
                    "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            )
    finally:
        await engine_base.dispose()

    # Step 2: Create tables in the target database
    from src.models import Base  # noqa: F811

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
