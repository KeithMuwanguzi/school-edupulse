"""Circular attachment storage (local filesystem)."""
from __future__ import annotations

import mimetypes
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile

from app.core.config import settings
from app.core.errors import ValidationError

ALLOWED_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
    }
)
MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
EXT_BY_TYPE = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


def circular_storage_dir(tenant_id: UUID, circular_id: UUID) -> Path:
    root = Path(settings.media_storage_path)
    return root / "tenants" / str(tenant_id) / "circulars" / str(circular_id)


def circular_attachment_path(tenant_id: UUID, circular_id: UUID) -> Path | None:
    directory = circular_storage_dir(tenant_id, circular_id)
    if not directory.is_dir():
        return None
    for path in directory.iterdir():
        if path.is_file() and path.name.startswith("attachment"):
            return path
    return None


def _validate_upload(file: UploadFile, data: bytes) -> str:
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError("Attachment must be PDF, PNG, JPEG, or WebP.")
    if len(data) > MAX_ATTACHMENT_BYTES:
        raise ValidationError("Attachment must be 2 MB or smaller.")
    return content_type


async def save_attachment(
    tenant_id: UUID,
    circular_id: UUID,
    file: UploadFile,
) -> tuple[str, Path]:
    data = await file.read()
    content_type = _validate_upload(file, data)
    directory = circular_storage_dir(tenant_id, circular_id)
    directory.mkdir(parents=True, exist_ok=True)

    for existing in directory.glob("attachment.*"):
        existing.unlink(missing_ok=True)

    ext = EXT_BY_TYPE[content_type]
    target = directory / f"attachment{ext}"
    target.write_bytes(data)
    filename = (file.filename or f"attachment{ext}").strip()[:255]
    return filename, target


def remove_attachment(tenant_id: UUID, circular_id: UUID) -> None:
    path = circular_attachment_path(tenant_id, circular_id)
    if path is not None:
        path.unlink(missing_ok=True)
    directory = circular_storage_dir(tenant_id, circular_id)
    if directory.is_dir() and not any(directory.iterdir()):
        directory.rmdir()


def attachment_media_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"
