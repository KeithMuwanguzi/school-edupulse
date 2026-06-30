"""Public school branding assets (badge images)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import client_ip
from app.core.db import get_session
from app.core.errors import NotFoundError
from app.core.rate_limit import sliding_window_hit
from app.models.platform import Tenant
from app.services import school_badge_service

router = APIRouter(prefix="/branding", tags=["branding"])


async def _enforce_branding_limits(request: Request) -> None:
    ip = client_ip(request)
    if ip:
        await sliding_window_hit(
            f"branding:ip:{ip}",
            limit=60,
            window_seconds=60,
            label="branding request",
        )


@router.get("/school/{school_code}/badge")
async def get_school_badge_by_code(
    school_code: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(_enforce_branding_limits),
) -> FileResponse:
    """Public badge lookup by school code (avoids UUID enumeration)."""
    tenant = await session.scalar(
        select(Tenant).where(
            Tenant.school_code == school_code.strip().upper(),
            Tenant.deleted_at.is_(None),
        )
    )
    if tenant is None:
        raise NotFoundError("School badge not found.")
    path = school_badge_service.badge_file_path(tenant.id)
    if path is None:
        raise NotFoundError("School badge not found.")
    return FileResponse(
        path,
        media_type=school_badge_service.badge_media_type(path),
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/{tenant_id}/badge")
async def get_school_badge(
    tenant_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(_enforce_branding_limits),
) -> FileResponse:
    """Legacy UUID-based badge URL (rate-limited). Prefer /school/{code}/badge."""
    _ = session
    path = school_badge_service.badge_file_path(tenant_id)
    if path is None:
        raise NotFoundError("School badge not found.")
    return FileResponse(
        path,
        media_type=school_badge_service.badge_media_type(path),
        headers={"Cache-Control": "public, max-age=3600"},
    )
