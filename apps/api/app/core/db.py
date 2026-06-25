"""Async SQLAlchemy engine + session factory, and RLS session helpers (§4.1)."""
from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# App engine → PgBouncer (transaction pooling). pool_pre_ping for dead conns.
# asyncpg + PgBouncer (transaction mode) requires the prepared-statement cache
# disabled, else cached statements collide across pooled backends.
engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=settings.pool_size,
    max_overflow=settings.max_overflow,
    future=True,
    # NOTE: statement_timeout is set at the role level (see migration) rather than
    # as a startup parameter, which PgBouncer (transaction mode) would reject.
    connect_args={
        "statement_cache_size": 0,
        "ssl": False,  # PgBouncer in dev has no TLS; skip SSL negotiation.
    },
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def apply_tenant_guc(session: AsyncSession, tenant_id: UUID | None) -> None:
    """Set (or clear) the RLS GUC for the current transaction.

    Must run inside a transaction so ``SET LOCAL`` is scoped to it — essential
    under PgBouncer transaction pooling.
    """
    if tenant_id is None:
        # Empty string → current_setting(..., true) returns '' and the policy
        # ``tenant_id = ''::uuid`` matches no rows (cast of '' fails → guarded by
        # NULLIF in the policy). We clear to a sentinel that matches nothing.
        await session.execute(text("SELECT set_config('app.current_tenant_id', '', true)"))
    else:
        await session.execute(
            text("SELECT set_config('app.current_tenant_id', :tid, true)"),
            {"tid": str(tenant_id)},
        )


async def apply_bypass_guc(session: AsyncSession) -> None:
    """Enable the platform RLS bypass for the current transaction (§4.1).

    Platform routes legitimately read/write across tenants. Must run inside a
    transaction (SET LOCAL semantics).
    """
    await session.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a session. Tenant GUC is applied by the
    auth dependency (see core.dependencies)."""
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
