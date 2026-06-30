"""Resolve a parent portal account to its linked pupil."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Student
from app.models.user import Role, TenantUser


async def resolve_parent_student(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
) -> Student | None:
    user = await session.scalar(
        select(TenantUser)
        .join(Role, Role.id == TenantUser.role_id)
        .where(
            TenantUser.id == user_id,
            TenantUser.tenant_id == tenant_id,
            Role.role_key == "parent",
        )
    )
    if user is None:
        return None
    return await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.student_number == user.login_id,
            Student.deleted_at.is_(None),
        )
    )
