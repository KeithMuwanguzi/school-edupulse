"""School badge upload and public branding URLs."""
from __future__ import annotations

import mimetypes
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import NotFoundError, ValidationError
from app.models.school import School

ALLOWED_CONTENT_TYPES = frozenset({"image/png", "image/jpeg", "image/webp"})
MAX_BADGE_BYTES = 512 * 1024
EXT_BY_TYPE = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


def badge_public_path(tenant_id: UUID, version: int) -> str:
    return f"/api/v1/branding/{tenant_id}/badge?v={version}"


def badge_storage_dir(tenant_id: UUID) -> Path:
    root = Path(settings.media_storage_path)
    return root / "tenants" / str(tenant_id)


def badge_file_path(tenant_id: UUID) -> Path | None:
    directory = badge_storage_dir(tenant_id)
    if not directory.is_dir():
        return None
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        candidate = directory / f"badge{ext}"
        if candidate.is_file():
            return candidate
    return None


def resolve_badge_url(tenant_id: UUID, badge_url: str | None) -> str | None:
    """Drop stale URLs when the file was removed (e.g. container rebuild without a volume)."""
    if not badge_url:
        return None
    if badge_file_path(tenant_id) is None:
        return None
    return badge_url


async def get_school(session: AsyncSession, tenant_id: UUID) -> School:
    school = await session.scalar(select(School).where(School.tenant_id == tenant_id))
    if school is None:
        raise NotFoundError("School not found.")
    return school


def _validate_upload(file: UploadFile, data: bytes) -> str:
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError("Badge must be PNG, JPEG, or WebP.")
    if len(data) > MAX_BADGE_BYTES:
        raise ValidationError("Badge must be 512 KB or smaller.")
    return content_type


async def save_badge(
    session: AsyncSession,
    tenant_id: UUID,
    file: UploadFile,
) -> School:
    school = await get_school(session, tenant_id)
    data = await file.read()
    content_type = _validate_upload(file, data)

    directory = badge_storage_dir(tenant_id)
    directory.mkdir(parents=True, exist_ok=True)

    for existing in directory.glob("badge.*"):
        existing.unlink(missing_ok=True)

    ext = EXT_BY_TYPE[content_type]
    target = directory / f"badge{ext}"
    target.write_bytes(data)

    school.badge_url = badge_public_path(tenant_id, school.version + 1)
    school.version += 1
    await session.flush()
    return school


async def remove_badge(session: AsyncSession, tenant_id: UUID) -> School:
    school = await get_school(session, tenant_id)
    existing = badge_file_path(tenant_id)
    if existing is not None:
        existing.unlink(missing_ok=True)
    school.badge_url = None
    school.version += 1
    await session.flush()
    return school


def badge_media_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"
