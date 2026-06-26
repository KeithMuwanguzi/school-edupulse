"""Teachers & assignments — Phase 2 §6."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.academic import AcademicYear, Term
from app.core.school_levels import LEVEL_CYCLE
from app.models.enums import AcademicYearStatus, ClassLevel, NcdcCycle, TermStatus
from app.models.school_class import ClassStream, SchoolClass
from app.models.subject import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import Role, TenantUser
from app.schemas.teacher import (
    TeacherAssignmentCreate,
    TeacherAssignmentOut,
    TeacherAssignmentUpdate,
    TeacherStaffOut,
)
from app.services.tenant_user_service import _school_code

TEACHING_ROLES = frozenset({"teacher", "deputy_head"})


async def _active_year(session: AsyncSession, tenant_id: UUID) -> AcademicYear:
    year = await session.scalar(
        select(AcademicYear).where(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.status == AcademicYearStatus.active,
        )
    )
    if year is None:
        raise ValidationError("No active academic year — set one under Settings.")
    return year


async def _resolve_term(
    session: AsyncSession, tenant_id: UUID, year_id: UUID, term_id: UUID | None
) -> UUID | None:
    if term_id is None:
        active = await session.scalar(
            select(Term).where(
                Term.tenant_id == tenant_id,
                Term.academic_year_id == year_id,
                Term.status == TermStatus.active,
            )
        )
        return active.id if active else None

    term = await session.scalar(
        select(Term).where(
            Term.tenant_id == tenant_id,
            Term.id == term_id,
            Term.academic_year_id == year_id,
        )
    )
    if term is None:
        raise NotFoundError("Term not found for the active academic year.")
    return term.id


async def _teacher_user(
    session: AsyncSession, tenant_id: UUID, user_id: UUID
) -> tuple[TenantUser, str]:
    row = await session.execute(
        select(TenantUser, Role.role_key)
        .join(Role, TenantUser.role_id == Role.id)
        .where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.id == user_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    hit = row.first()
    if hit is None:
        raise NotFoundError("Teacher not found.")
    user, role_key = hit
    if role_key not in TEACHING_ROLES:
        raise ValidationError("User must have the teacher or deputy head role.")
    return user, role_key


async def _class_row(
    session: AsyncSession, tenant_id: UUID, class_id: UUID
) -> SchoolClass:
    school_class = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.id == class_id,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if school_class is None:
        raise NotFoundError("Class not found.")
    return school_class


async def _subject_row(session: AsyncSession, tenant_id: UUID, subject_id: UUID) -> Subject:
    subject = await session.scalar(
        select(Subject).where(
            Subject.tenant_id == tenant_id,
            Subject.id == subject_id,
            Subject.deleted_at.is_(None),
        )
    )
    if subject is None:
        raise NotFoundError("Subject not found.")
    return subject


async def _stream_row(
    session: AsyncSession, tenant_id: UUID, class_id: UUID, stream_id: UUID | None
) -> ClassStream | None:
    if stream_id is None:
        return None
    stream = await session.scalar(
        select(ClassStream).where(
            ClassStream.tenant_id == tenant_id,
            ClassStream.id == stream_id,
            ClassStream.class_id == class_id,
            ClassStream.deleted_at.is_(None),
        )
    )
    if stream is None:
        raise NotFoundError("Stream not found for this class.")
    return stream


def _subject_matches_class(subject: Subject, school_class: SchoolClass) -> bool:
    required = LEVEL_CYCLE[school_class.level]
    return required in subject.ncdc_cycles


async def _duplicate_assignment(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    teacher_user_id: UUID,
    academic_year_id: UUID,
    term_id: UUID | None,
    class_id: UUID,
    stream_id: UUID | None,
    subject_id: UUID,
    exclude_id: UUID | None = None,
) -> bool:
    stmt = select(TeacherAssignment.id).where(
        TeacherAssignment.tenant_id == tenant_id,
        TeacherAssignment.teacher_user_id == teacher_user_id,
        TeacherAssignment.academic_year_id == academic_year_id,
        TeacherAssignment.class_id == class_id,
        TeacherAssignment.subject_id == subject_id,
        TeacherAssignment.deleted_at.is_(None),
    )
    if term_id is None:
        stmt = stmt.where(TeacherAssignment.term_id.is_(None))
    else:
        stmt = stmt.where(TeacherAssignment.term_id == term_id)
    if stream_id is None:
        stmt = stmt.where(TeacherAssignment.stream_id.is_(None))
    else:
        stmt = stmt.where(TeacherAssignment.stream_id == stream_id)
    if exclude_id is not None:
        stmt = stmt.where(TeacherAssignment.id != exclude_id)
    return await session.scalar(stmt) is not None


async def _assignment_out(
    session: AsyncSession, tenant_id: UUID, row: TeacherAssignment
) -> TeacherAssignmentOut:
    teacher, _ = await _teacher_user(session, tenant_id, row.teacher_user_id)
    year = await session.get(AcademicYear, row.academic_year_id)
    term = await session.get(Term, row.term_id) if row.term_id else None
    school_class = await _class_row(session, tenant_id, row.class_id)
    stream = (
        await _stream_row(session, tenant_id, row.class_id, row.stream_id)
        if row.stream_id
        else None
    )
    subject = await _subject_row(session, tenant_id, row.subject_id)

    return TeacherAssignmentOut(
        id=row.id,
        teacher_user_id=row.teacher_user_id,
        teacher_name=teacher.name,
        academic_year_id=row.academic_year_id,
        academic_year_label=year.label if year else "",
        term_id=row.term_id,
        term_label=term.label if term else None,
        class_id=row.class_id,
        class_level=school_class.level.value,
        stream_id=row.stream_id,
        stream_name=stream.name if stream else None,
        subject_id=row.subject_id,
        subject_code=subject.code,
        subject_name=subject.name,
        is_class_teacher=row.is_class_teacher,
    )


async def list_staff(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    academic_year_id: UUID | None = None,
    term_id: UUID | None = None,
) -> list[TeacherStaffOut]:
    school_code = await _school_code(session, tenant_id)
    year = (
        await session.get(AcademicYear, academic_year_id)
        if academic_year_id
        else await _active_year(session, tenant_id)
    )

    rows = await session.execute(
        select(TenantUser, Role.role_key)
        .join(Role, TenantUser.role_id == Role.id)
        .where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
            Role.role_key.in_(TEACHING_ROLES),
        )
        .order_by(TenantUser.name, TenantUser.login_id)
    )

    staff: list[TeacherStaffOut] = []
    for user, role_key in rows.all():
        count_stmt = (
            select(func.count())
            .select_from(TeacherAssignment)
            .where(
                TeacherAssignment.tenant_id == tenant_id,
                TeacherAssignment.teacher_user_id == user.id,
                TeacherAssignment.academic_year_id == year.id,
                TeacherAssignment.deleted_at.is_(None),
            )
        )
        if term_id is not None:
            count_stmt = count_stmt.where(TeacherAssignment.term_id == term_id)
        count = int(await session.scalar(count_stmt) or 0)
        staff.append(
            TeacherStaffOut(
                id=user.id,
                login_id=user.login_id,
                username=f"{user.login_id}@{school_code}",
                name=user.name,
                role=role_key,
                status=user.status.value,
                assignment_count=count,
            )
        )
    return staff


async def list_assignments(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    teacher_user_id: UUID | None = None,
    class_id: UUID | None = None,
    academic_year_id: UUID | None = None,
    term_id: UUID | None = None,
) -> list[TeacherAssignmentOut]:
    year_id = academic_year_id
    if year_id is None:
        year_id = (await _active_year(session, tenant_id)).id

    stmt = (
        select(TeacherAssignment)
        .where(
            TeacherAssignment.tenant_id == tenant_id,
            TeacherAssignment.academic_year_id == year_id,
            TeacherAssignment.deleted_at.is_(None),
        )
        .order_by(TeacherAssignment.created_at, TeacherAssignment.id)
    )
    if teacher_user_id is not None:
        stmt = stmt.where(TeacherAssignment.teacher_user_id == teacher_user_id)
    if class_id is not None:
        stmt = stmt.where(TeacherAssignment.class_id == class_id)
    if term_id is not None:
        stmt = stmt.where(TeacherAssignment.term_id == term_id)

    rows = list(await session.scalars(stmt))
    return [await _assignment_out(session, tenant_id, r) for r in rows]


async def create_assignment(
    session: AsyncSession, tenant_id: UUID, body: TeacherAssignmentCreate
) -> TeacherAssignmentOut:
    await _teacher_user(session, tenant_id, body.teacher_user_id)
    year = await _active_year(session, tenant_id)
    term_id = await _resolve_term(session, tenant_id, year.id, body.term_id)
    school_class = await _class_row(session, tenant_id, body.class_id)
    subject = await _subject_row(session, tenant_id, body.subject_id)
    await _stream_row(session, tenant_id, body.class_id, body.stream_id)

    if not _subject_matches_class(subject, school_class):
        raise ValidationError(
            f"Subject {subject.code} is not taught in {school_class.level.value}."
        )

    if await _duplicate_assignment(
        session,
        tenant_id,
        teacher_user_id=body.teacher_user_id,
        academic_year_id=year.id,
        term_id=term_id,
        class_id=body.class_id,
        stream_id=body.stream_id,
        subject_id=body.subject_id,
    ):
        raise ConflictError("This assignment already exists.")

    row = TeacherAssignment(
        tenant_id=tenant_id,
        teacher_user_id=body.teacher_user_id,
        academic_year_id=year.id,
        term_id=term_id,
        class_id=body.class_id,
        stream_id=body.stream_id,
        subject_id=body.subject_id,
        is_class_teacher=body.is_class_teacher,
    )
    session.add(row)
    await session.flush()
    return await _assignment_out(session, tenant_id, row)


async def update_assignment(
    session: AsyncSession,
    tenant_id: UUID,
    assignment_id: UUID,
    body: TeacherAssignmentUpdate,
) -> TeacherAssignmentOut:
    row = await session.scalar(
        select(TeacherAssignment).where(
            TeacherAssignment.id == assignment_id,
            TeacherAssignment.tenant_id == tenant_id,
            TeacherAssignment.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Assignment not found.")

    class_id = body.class_id if body.class_id is not None else row.class_id
    subject_id = body.subject_id if body.subject_id is not None else row.subject_id
    stream_id = None if body.clear_stream else (
        body.stream_id if body.stream_id is not None else row.stream_id
    )
    term_id = None if body.clear_term else (
        body.term_id if body.term_id is not None else row.term_id
    )

    school_class = await _class_row(session, tenant_id, class_id)
    subject = await _subject_row(session, tenant_id, subject_id)
    await _stream_row(session, tenant_id, class_id, stream_id)

    if term_id is not None:
        await _resolve_term(session, tenant_id, row.academic_year_id, term_id)

    if not _subject_matches_class(subject, school_class):
        raise ValidationError(
            f"Subject {subject.code} is not taught in {school_class.level.value}."
        )

    if await _duplicate_assignment(
        session,
        tenant_id,
        teacher_user_id=row.teacher_user_id,
        academic_year_id=row.academic_year_id,
        term_id=term_id,
        class_id=class_id,
        stream_id=stream_id,
        subject_id=subject_id,
        exclude_id=row.id,
    ):
        raise ConflictError("This assignment already exists.")

    row.class_id = class_id
    row.subject_id = subject_id
    row.stream_id = stream_id
    row.term_id = term_id
    if body.is_class_teacher is not None:
        row.is_class_teacher = body.is_class_teacher

    return await _assignment_out(session, tenant_id, row)


async def delete_assignment(
    session: AsyncSession, tenant_id: UUID, assignment_id: UUID
) -> None:
    row = await session.scalar(
        select(TeacherAssignment).where(
            TeacherAssignment.id == assignment_id,
            TeacherAssignment.tenant_id == tenant_id,
            TeacherAssignment.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Assignment not found.")
    row.deleted_at = dt.datetime.now(dt.UTC)


@dataclass(frozen=True)
class _ClassRosterAccess:
    """Stream visibility for one assigned class."""

    all_streams: bool
    stream_ids: frozenset[UUID]


@dataclass(frozen=True)
class TeacherRosterAccess:
    """Classes and streams a teacher may view in the student roster."""

    classes: dict[UUID, _ClassRosterAccess]

    def allows(self, class_id: UUID | None, stream_id: UUID | None) -> bool:
        if class_id is None:
            return False
        access = self.classes.get(class_id)
        if access is None:
            return False
        if access.all_streams:
            return True
        if stream_id is None:
            return False
        return stream_id in access.stream_ids

    def class_ids(self) -> frozenset[UUID]:
        return frozenset(self.classes.keys())


async def teacher_roster_access(
    session: AsyncSession, tenant_id: UUID, teacher_user_id: UUID
) -> TeacherRosterAccess:
    """Resolve roster visibility from active-year assignments."""
    year = await _active_year(session, tenant_id)
    rows = list(
        await session.scalars(
            select(TeacherAssignment).where(
                TeacherAssignment.tenant_id == tenant_id,
                TeacherAssignment.teacher_user_id == teacher_user_id,
                TeacherAssignment.academic_year_id == year.id,
                TeacherAssignment.deleted_at.is_(None),
            )
        )
    )

    merged: dict[UUID, _ClassRosterAccess] = {}
    for row in rows:
        current = merged.get(row.class_id)
        if row.is_class_teacher or row.stream_id is None:
            merged[row.class_id] = _ClassRosterAccess(all_streams=True, stream_ids=frozenset())
            continue
        if current is not None and current.all_streams:
            continue
        stream_ids = (
            current.stream_ids if current is not None else frozenset[UUID]()
        ) | {row.stream_id}
        merged[row.class_id] = _ClassRosterAccess(all_streams=False, stream_ids=stream_ids)

    return TeacherRosterAccess(classes=merged)
