"""Automatic per-school student-number generation — Phase 2 §5.

Each school is assigned a globally-unique numeric prefix (lazily, from a
platform sequence) and a running, zero-padded sequence. The stored
``student_number`` is therefore ``f"{prefix}{seq:05d}"`` — digits only, so it
continues to double as the guardian's portal login.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models.school import School
from app.models.student import Student

SEQUENCE_PAD = 5


async def _ensure_prefix(session: AsyncSession, school: School) -> str:
    if school.student_number_prefix:
        return school.student_number_prefix
    value = await session.scalar(text("SELECT nextval('student_number_prefix_seq')"))
    school.student_number_prefix = str(int(value))
    return school.student_number_prefix


async def peek_prefix(session: AsyncSession, tenant_id: UUID) -> str | None:
    """Return the configured prefix without assigning one."""
    return await session.scalar(
        select(School.student_number_prefix).where(School.tenant_id == tenant_id)
    )


async def generate_student_number(session: AsyncSession, tenant_id: UUID) -> str:
    """Allocate the next unique student number for a school.

    Locks the school row so concurrent enrollments (and bulk imports within one
    transaction) never collide. Skips any number already taken by a legacy row.
    """
    school = await session.scalar(
        select(School).where(School.tenant_id == tenant_id).with_for_update()
    )
    if school is None:
        raise NotFoundError("School profile not found.")

    prefix = await _ensure_prefix(session, school)

    while True:
        seq = school.student_number_next
        school.student_number_next = seq + 1
        candidate = f"{prefix}{seq:0{SEQUENCE_PAD}d}"
        clash = await session.scalar(
            select(Student.id).where(
                Student.tenant_id == tenant_id,
                Student.student_number == candidate,
                Student.deleted_at.is_(None),
            )
        )
        if clash is None:
            return candidate
