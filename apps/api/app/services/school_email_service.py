"""School contact email — normalization and uniqueness."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DuplicateSchoolEmailError
from app.models.school import School


def normalize_school_email(email: str) -> str:
    return email.strip().lower()


async def assert_school_email_available(
    session: AsyncSession,
    email: str,
    *,
    exclude_school_id: UUID | None = None,
) -> str:
    """Return normalized email or raise if another active school already uses it."""
    normalized = normalize_school_email(email)
    stmt = select(School.id).where(
        func.lower(func.trim(School.email)) == normalized,
        School.deleted_at.is_(None),
    )
    if exclude_school_id is not None:
        stmt = stmt.where(School.id != exclude_school_id)
    existing = await session.scalar(stmt)
    if existing is not None:
        raise DuplicateSchoolEmailError(
            f"The email '{normalized}' is already registered to another school."
        )
    return normalized
