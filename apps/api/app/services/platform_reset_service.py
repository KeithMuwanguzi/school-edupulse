"""Platform-wide data reset — wipes tenant/operational data, keeps platform admin + seed catalog."""
from __future__ import annotations

import shutil
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings
from app.core.logging import get_logger
from app.core.redis import redis_client
from app.models.platform import PlatformAdmin

log = get_logger("skulpulse.platform_reset")

# Reference / bootstrap tables — never truncated.
PRESERVED_TABLES = frozenset(
    {
        "alembic_version",
        "platform_admins",
        "module_catalog",
        "platform_config",
        "roles",
        "regions",
        "districts",
        "counties",
        "sub_counties",
        "parishes",
    }
)

RESET_CONFIRMATION_PHRASE = "RESET ALL DATA"


async def _list_resettable_tables(session: AsyncSession) -> list[str]:
    rows = await session.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
            """
        )
    )
    return [name for name in rows.scalars() if name not in PRESERVED_TABLES]


async def _count_platform_admins(session: AsyncSession) -> int:
    return int(await session.scalar(select(func.count()).select_from(PlatformAdmin)) or 0)


def _clear_media_storage() -> None:
    root = Path(settings.media_storage_path) / "tenants"
    if root.is_dir():
        shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)


async def _flush_redis() -> None:
    await redis_client.flushdb()


async def reset_platform_data() -> dict[str, int | list[str]]:
    """Truncate all non-reference tables; preserve platform admin credentials."""
    admin_engine = create_async_engine(
        settings.migration_database_url,
        connect_args={"statement_cache_size": 0, "ssl": False},
    )
    try:
        async with admin_engine.connect() as conn:
            admin_count_before = await _count_platform_admins(conn)
            tables = await _list_resettable_tables(conn)
            if not tables:
                return {
                    "platform_admins_preserved": admin_count_before,
                    "tables_truncated": 0,
                    "table_names": [],
                }

            quoted = ", ".join(f'"{t}"' for t in tables)
            await conn.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))
            await conn.commit()

            admin_count_after = await _count_platform_admins(conn)
            if admin_count_after != admin_count_before:
                raise RuntimeError(
                    "Platform admin row count changed during reset — aborting follow-up steps."
                )
    finally:
        await admin_engine.dispose()

    _clear_media_storage()
    await _flush_redis()

    log.warning(
        "platform.data_reset.complete",
        tables_truncated=len(tables),
        platform_admins_preserved=admin_count_after,
    )
    return {
        "platform_admins_preserved": admin_count_after,
        "tables_truncated": len(tables),
        "table_names": tables,
    }
