"""School-local clock — timetable slots and attendance windows use the tenant timezone."""
from __future__ import annotations

import datetime as dt
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.school import School

DEFAULT_TIMEZONE = "Africa/Kampala"


async def school_timezone(session: AsyncSession, tenant_id: UUID) -> ZoneInfo:
    tz_name = await session.scalar(
        select(School.timezone).where(
            School.tenant_id == tenant_id,
            School.deleted_at.is_(None),
        )
    )
    name = (tz_name or DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo(DEFAULT_TIMEZONE)


async def school_now(session: AsyncSession, tenant_id: UUID) -> dt.datetime:
    tz = await school_timezone(session, tenant_id)
    return dt.datetime.now(tz)


async def school_today(session: AsyncSession, tenant_id: UUID) -> dt.date:
    return (await school_now(session, tenant_id)).date()
