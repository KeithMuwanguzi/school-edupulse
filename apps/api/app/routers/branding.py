"""Public school branding assets (badge images)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import NotFoundError
from app.services import school_badge_service

router = APIRouter(prefix="/branding", tags=["branding"])


@router.get("/{tenant_id}/badge")
async def get_school_badge(
    tenant_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    _ = session  # reserved for future signed-URL checks
    path = school_badge_service.badge_file_path(tenant_id)
    if path is None:
        raise NotFoundError("School badge not found.")
    return FileResponse(
        path,
        media_type=school_badge_service.badge_media_type(path),
        headers={"Cache-Control": "public, max-age=3600"},
    )
