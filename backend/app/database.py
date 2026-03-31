from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Engine settings per environment
# ---------------------------------------------------------------------------
# Dev:  smaller pool — avoid exhausting a local/shared DB, keep resource usage
#       low, surface connection issues early with a short timeout.
# Prod: larger pool to support multiple AIWorkerSettings replicas running
#       max_jobs=10 each. Headroom calculation:
#         3 replicas × 10 jobs = 30 concurrent workers
#         + FastAPI/web processes on top
#       pool_size=20 + max_overflow=20 = 40 max connections covers this safely.
# ---------------------------------------------------------------------------

_BASE_ENGINE_KWARGS = dict(
    echo=False,
    pool_pre_ping=True,       # Drop stale connections before use
    pool_recycle=1800,        # Recycle connections every 30 min (avoids server-side timeouts)
)

_ENV_ENGINE_KWARGS = {
    "development": dict(
        pool_size=5,
        max_overflow=5,        # 10 max total — enough for local work, not wasteful
        pool_timeout=10,       # Fail fast locally so misconfigs surface immediately
        echo=False,             # Log SQL in dev for easier debugging
    ),
    "production": dict(
        pool_size=20,
        max_overflow=20,       # 40 max total — headroom for 3 worker replicas + web
        pool_timeout=30,       # Standard wait before raising on exhausted pool
    ),
}

_env = getattr(settings, "environment", "production").lower()
_engine_kwargs = {**_BASE_ENGINE_KWARGS, **_ENV_ENGINE_KWARGS.get(_env, _ENV_ENGINE_KWARGS["production"])}

engine = create_async_engine(settings.database_url, **_engine_kwargs)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise