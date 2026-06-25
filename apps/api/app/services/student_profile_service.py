"""Student profile sub-resources: guardians, health, discipline — Phase 2 §5."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.models.student import (
    Student,
    StudentDisciplineRecord,
    StudentGuardian,
    StudentHealth,
)
from app.models.user import TenantUser
from app.schemas.student import (
    DisciplineCreate,
    DisciplineOut,
    DisciplineUpdate,
    GuardianInput,
    GuardianOut,
    GuardianUpdate,
    HealthInput,
    HealthOut,
)


async def _ensure_student(session: AsyncSession, tenant_id: UUID, student_id: UUID) -> Student:
    row = await session.scalar(
        select(Student).where(
            Student.id == student_id,
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Student not found.")
    return row


async def _portal_username(
    session: AsyncSession, tenant_id: UUID, user_id: UUID | None
) -> str | None:
    if user_id is None:
        return None
    from app.services.tenant_user_service import _school_code

    user = await session.scalar(
        select(TenantUser).where(
            TenantUser.id == user_id,
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    if user is None:
        return None
    code = await _school_code(session, tenant_id)
    return f"{user.login_id}@{code}"


# --- Guardians -------------------------------------------------------------


async def _guardian_out(
    session: AsyncSession, tenant_id: UUID, row: StudentGuardian
) -> GuardianOut:
    return GuardianOut(
        id=row.id,
        student_id=row.student_id,
        relationship=row.relationship,
        full_name=row.full_name,
        phone_primary=row.phone_primary,
        phone_alt=row.phone_alt,
        email=row.email,
        occupation=row.occupation,
        national_id=row.national_id,
        address=row.address,
        is_primary=row.is_primary,
        is_emergency=row.is_emergency,
        can_pickup=row.can_pickup,
        portal_user_id=row.portal_user_id,
        portal_username=await _portal_username(session, tenant_id, row.portal_user_id),
    )


async def _validate_portal_user(
    session: AsyncSession, tenant_id: UUID, user_id: UUID | None
) -> None:
    if user_id is None:
        return
    exists = await session.scalar(
        select(TenantUser.id).where(
            TenantUser.id == user_id,
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    if exists is None:
        raise ValidationError("Linked portal account not found.")


async def _demote_primaries(
    session: AsyncSession, tenant_id: UUID, student_id: UUID, exclude_id: UUID | None = None
) -> None:
    rows = await session.scalars(
        select(StudentGuardian).where(
            StudentGuardian.tenant_id == tenant_id,
            StudentGuardian.student_id == student_id,
            StudentGuardian.is_primary.is_(True),
            StudentGuardian.deleted_at.is_(None),
        )
    )
    for row in rows:
        if exclude_id is None or row.id != exclude_id:
            row.is_primary = False


async def list_guardians(
    session: AsyncSession, tenant_id: UUID, student_id: UUID
) -> list[GuardianOut]:
    rows = list(
        await session.scalars(
            select(StudentGuardian)
            .where(
                StudentGuardian.tenant_id == tenant_id,
                StudentGuardian.student_id == student_id,
                StudentGuardian.deleted_at.is_(None),
            )
            .order_by(StudentGuardian.is_primary.desc(), StudentGuardian.created_at)
        )
    )
    return [await _guardian_out(session, tenant_id, r) for r in rows]


async def add_guardian(
    session: AsyncSession, tenant_id: UUID, student_id: UUID, body: GuardianInput
) -> GuardianOut:
    await _ensure_student(session, tenant_id, student_id)
    await _validate_portal_user(session, tenant_id, body.portal_user_id)
    if body.is_primary:
        await _demote_primaries(session, tenant_id, student_id)

    row = StudentGuardian(
        tenant_id=tenant_id,
        student_id=student_id,
        relationship=body.relationship,
        full_name=body.full_name.strip(),
        phone_primary=(body.phone_primary or None),
        phone_alt=(body.phone_alt or None),
        email=(body.email or None),
        occupation=(body.occupation or None),
        national_id=(body.national_id or None),
        address=(body.address or None),
        is_primary=body.is_primary,
        is_emergency=body.is_emergency,
        can_pickup=body.can_pickup,
        portal_user_id=body.portal_user_id,
    )
    session.add(row)
    await session.flush()
    return await _guardian_out(session, tenant_id, row)


async def update_guardian(
    session: AsyncSession, tenant_id: UUID, guardian_id: UUID, body: GuardianUpdate
) -> GuardianOut:
    row = await session.scalar(
        select(StudentGuardian).where(
            StudentGuardian.id == guardian_id,
            StudentGuardian.tenant_id == tenant_id,
            StudentGuardian.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Guardian not found.")

    fields = body.model_fields_set
    if "portal_user_id" in fields and not body.clear_portal_user:
        await _validate_portal_user(session, tenant_id, body.portal_user_id)
        row.portal_user_id = body.portal_user_id
    if body.clear_portal_user:
        row.portal_user_id = None

    if body.is_primary:
        await _demote_primaries(session, tenant_id, row.student_id, exclude_id=row.id)

    for attr in (
        "relationship",
        "full_name",
        "phone_primary",
        "phone_alt",
        "email",
        "occupation",
        "national_id",
        "address",
        "is_primary",
        "is_emergency",
        "can_pickup",
    ):
        if attr in fields:
            value = getattr(body, attr)
            if isinstance(value, str):
                value = value.strip() or None
            setattr(row, attr, value)

    await session.flush()
    return await _guardian_out(session, tenant_id, row)


async def delete_guardian(
    session: AsyncSession, tenant_id: UUID, guardian_id: UUID
) -> None:
    row = await session.scalar(
        select(StudentGuardian).where(
            StudentGuardian.id == guardian_id,
            StudentGuardian.tenant_id == tenant_id,
            StudentGuardian.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Guardian not found.")
    row.deleted_at = dt.datetime.now(dt.UTC)


# --- Health ----------------------------------------------------------------


def _health_out(row: StudentHealth) -> HealthOut:
    return HealthOut(
        id=row.id,
        student_id=row.student_id,
        blood_group=row.blood_group,
        allergies=row.allergies,
        chronic_conditions=row.chronic_conditions,
        medications=row.medications,
        disabilities=row.disabilities,
        dietary_needs=row.dietary_needs,
        doctor_name=row.doctor_name,
        doctor_phone=row.doctor_phone,
        insurance_provider=row.insurance_provider,
        insurance_number=row.insurance_number,
        emergency_notes=row.emergency_notes,
    )


async def get_health(
    session: AsyncSession, tenant_id: UUID, student_id: UUID
) -> HealthOut | None:
    row = await session.scalar(
        select(StudentHealth).where(
            StudentHealth.tenant_id == tenant_id,
            StudentHealth.student_id == student_id,
            StudentHealth.deleted_at.is_(None),
        )
    )
    return _health_out(row) if row else None


async def upsert_health(
    session: AsyncSession, tenant_id: UUID, student_id: UUID, body: HealthInput
) -> HealthOut:
    await _ensure_student(session, tenant_id, student_id)
    row = await session.scalar(
        select(StudentHealth).where(
            StudentHealth.tenant_id == tenant_id,
            StudentHealth.student_id == student_id,
            StudentHealth.deleted_at.is_(None),
        )
    )
    data = {k: (v or None) if isinstance(v, str) else v for k, v in body.model_dump().items()}
    if row is None:
        row = StudentHealth(tenant_id=tenant_id, student_id=student_id, **data)
        session.add(row)
    else:
        for key, value in data.items():
            setattr(row, key, value)
    await session.flush()
    return _health_out(row)


# --- Discipline ------------------------------------------------------------


async def _discipline_out(
    session: AsyncSession, tenant_id: UUID, row: StudentDisciplineRecord, *, with_student: bool
) -> DisciplineOut:
    recorded_by_name: str | None = None
    if row.recorded_by_user_id:
        user = await session.scalar(
            select(TenantUser).where(
                TenantUser.id == row.recorded_by_user_id,
                TenantUser.tenant_id == tenant_id,
            )
        )
        recorded_by_name = user.name if user else None

    student_name: str | None = None
    student_number: str | None = None
    if with_student:
        student = await session.scalar(
            select(Student).where(
                Student.id == row.student_id,
                Student.tenant_id == tenant_id,
            )
        )
        if student:
            student_name = f"{student.first_name} {student.last_name}"
            student_number = student.student_number

    return DisciplineOut(
        id=row.id,
        student_id=row.student_id,
        incident_date=row.incident_date,
        category=row.category,
        severity=row.severity,
        description=row.description,
        action_taken=row.action_taken,
        status=row.status,
        recorded_by_user_id=row.recorded_by_user_id,
        recorded_by_name=recorded_by_name,
        created_at=row.created_at,
        student_name=student_name,
        student_number=student_number,
    )


async def list_discipline(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    student_id: UUID | None = None,
    status: str | None = None,
    limit: int = 200,
) -> list[DisciplineOut]:
    stmt = (
        select(StudentDisciplineRecord)
        .where(
            StudentDisciplineRecord.tenant_id == tenant_id,
            StudentDisciplineRecord.deleted_at.is_(None),
        )
        .order_by(
            StudentDisciplineRecord.incident_date.desc(),
            StudentDisciplineRecord.created_at.desc(),
        )
        .limit(min(max(limit, 1), 500))
    )
    if student_id is not None:
        stmt = stmt.where(StudentDisciplineRecord.student_id == student_id)
    if status is not None:
        stmt = stmt.where(StudentDisciplineRecord.status == status)

    rows = list(await session.scalars(stmt))
    return [
        await _discipline_out(session, tenant_id, r, with_student=student_id is None)
        for r in rows
    ]


async def add_discipline(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    body: DisciplineCreate,
    *,
    recorded_by: UUID | None,
) -> DisciplineOut:
    await _ensure_student(session, tenant_id, student_id)
    row = StudentDisciplineRecord(
        tenant_id=tenant_id,
        student_id=student_id,
        incident_date=body.incident_date,
        category=body.category.strip(),
        severity=body.severity,
        description=body.description.strip(),
        action_taken=(body.action_taken.strip() if body.action_taken else None),
        status=body.status,
        recorded_by_user_id=recorded_by,
    )
    session.add(row)
    await session.flush()
    return await _discipline_out(session, tenant_id, row, with_student=True)


async def update_discipline(
    session: AsyncSession, tenant_id: UUID, record_id: UUID, body: DisciplineUpdate
) -> DisciplineOut:
    row = await session.scalar(
        select(StudentDisciplineRecord).where(
            StudentDisciplineRecord.id == record_id,
            StudentDisciplineRecord.tenant_id == tenant_id,
            StudentDisciplineRecord.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Discipline record not found.")

    fields = body.model_fields_set
    for attr in ("incident_date", "category", "severity", "description", "action_taken", "status"):
        if attr in fields:
            value = getattr(body, attr)
            if isinstance(value, str) and attr in ("action_taken",):
                value = value.strip() or None
            elif isinstance(value, str):
                value = value.strip()
            setattr(row, attr, value)

    await session.flush()
    return await _discipline_out(session, tenant_id, row, with_student=True)


async def delete_discipline(
    session: AsyncSession, tenant_id: UUID, record_id: UUID
) -> None:
    row = await session.scalar(
        select(StudentDisciplineRecord).where(
            StudentDisciplineRecord.id == record_id,
            StudentDisciplineRecord.tenant_id == tenant_id,
            StudentDisciplineRecord.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Discipline record not found.")
    row.deleted_at = dt.datetime.now(dt.UTC)
