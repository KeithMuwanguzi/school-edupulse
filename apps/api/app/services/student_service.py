"""Student enrollment — Phase 2 §5."""
from __future__ import annotations

import base64
import datetime as dt
import re
from uuid import UUID

from sqlalchemy import and_, func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.models.hostel import Hostel, HostelRoom
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import (
    Student,
    StudentDisciplineRecord,
    StudentGuardian,
    StudentHealth,
)
from app.models.user import Role, TenantUser
from app.schemas.common import CursorPage
from app.schemas.student import (
    BulkAssignResponse,
    BulkAssignRowResult,
    ClassRosterCount,
    GuardianLinkOut,
    RosterSummaryOut,
    StreamRosterCount,
    StudentCreate,
    StudentDetailOut,
    StudentOut,
    StudentUpdate,
)
from app.services import hostel_service, student_number_service, student_profile_service
from app.services.teacher_service import TeacherRosterAccess, teacher_roster_access
from app.services.student_enrollment_validation import (
    class_has_active_streams,
    validate_student_enrollment,
)

STUDENT_NUMBER_RE = re.compile(r"^\d{4,20}$")


def _encode_cursor(student_number: str, student_id: UUID) -> str:
    raw = f"{student_number}:{student_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[str, UUID]:
    raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    number, sid = raw.split(":", 1)
    return number, UUID(sid)


    return number, UUID(sid)


def _teacher_scoped(role: str | None) -> bool:
    return role == "teacher"


async def _load_teacher_access(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    role: str | None,
    user_id: UUID | None,
) -> TeacherRosterAccess | None:
    if not _teacher_scoped(role) or user_id is None:
        return None
    return await teacher_roster_access(session, tenant_id, user_id)


def _ensure_teacher_can_view(
    access: TeacherRosterAccess,
    *,
    class_id: UUID | None,
    stream_id: UUID | None,
) -> None:
    if not access.allows(class_id, stream_id):
        raise ForbiddenError("You can only view students in classes you are assigned to.")


def _teacher_student_visibility(access: TeacherRosterAccess):
    """SQLAlchemy filter limiting students to a teacher's assigned classes."""
    clauses = []
    for class_id, class_access in access.classes.items():
        if class_access.all_streams:
            clauses.append(Student.class_id == class_id)
        elif class_access.stream_ids:
            clauses.append(
                and_(
                    Student.class_id == class_id,
                    Student.stream_id.in_(class_access.stream_ids),
                )
            )
    if not clauses:
        return Student.id.is_(None)
    return or_(*clauses)


async def _resolve_placement(
    session: AsyncSession,
    tenant_id: UUID,
    class_id: UUID | None,
    stream_id: UUID | None,
) -> tuple[UUID | None, UUID | None]:
    if class_id is None:
        if stream_id is not None:
            raise ValidationError("stream_id requires class_id.")
        return None, None

    school_class = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.id == class_id,
            SchoolClass.deleted_at.is_(None),
        )
    )
    if school_class is None:
        raise NotFoundError("Class not found.")

    if stream_id is None:
        return class_id, None

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
    return class_id, stream_id


async def _guardian_for(
    session: AsyncSession, tenant_id: UUID, student_number: str
) -> GuardianLinkOut | None:
    from app.services.tenant_user_service import _school_code

    row = await session.execute(
        select(TenantUser, Role.role_key)
        .join(Role, TenantUser.role_id == Role.id)
        .where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.login_id == student_number,
            TenantUser.deleted_at.is_(None),
            Role.role_key == "parent",
        )
        .limit(1)
    )
    hit = row.first()
    if hit is None:
        return None
    user, _ = hit
    code = await _school_code(session, tenant_id)
    return GuardianLinkOut(
        user_id=user.id,
        name=user.name,
        username=f"{user.login_id}@{code}",
        email=user.email,
    )


async def _student_out(session: AsyncSession, tenant_id: UUID, row: Student) -> StudentOut:
    class_level: str | None = None
    class_label: str | None = None
    stream_name: str | None = None

    if row.class_id:
        school_class = await session.scalar(
            select(SchoolClass).where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.id == row.class_id,
                SchoolClass.deleted_at.is_(None),
            )
        )
        if school_class:
            class_level = school_class.level.value
            class_label = school_class.label

    if row.stream_id:
        stream = await session.scalar(
            select(ClassStream).where(
                ClassStream.tenant_id == tenant_id,
                ClassStream.id == row.stream_id,
                ClassStream.deleted_at.is_(None),
            )
        )
        if stream:
            stream_name = stream.name

    hostel_name: str | None = None
    hostel_room_name: str | None = None
    if row.hostel_id:
        hostel_name = await session.scalar(
            select(Hostel.name).where(
                Hostel.tenant_id == tenant_id,
                Hostel.id == row.hostel_id,
                Hostel.deleted_at.is_(None),
            )
        )
    if row.hostel_room_id:
        hostel_room_name = await session.scalar(
            select(HostelRoom.name).where(
                HostelRoom.tenant_id == tenant_id,
                HostelRoom.id == row.hostel_room_id,
                HostelRoom.deleted_at.is_(None),
            )
        )

    guardian = await _guardian_for(session, tenant_id, row.student_number)
    guardian_count = int(
        await session.scalar(
            select(func.count())
            .select_from(StudentGuardian)
            .where(
                StudentGuardian.tenant_id == tenant_id,
                StudentGuardian.student_id == row.id,
                StudentGuardian.deleted_at.is_(None),
            )
        )
        or 0
    )

    return StudentOut(
        id=row.id,
        student_number=row.student_number,
        first_name=row.first_name,
        last_name=row.last_name,
        middle_name=row.middle_name,
        preferred_name=row.preferred_name,
        lin=row.lin,
        class_id=row.class_id,
        class_level=class_level,
        class_label=class_label,
        stream_id=row.stream_id,
        stream_name=stream_name,
        gender=row.gender,
        date_of_birth=row.date_of_birth,
        nationality=row.nationality,
        religion=row.religion,
        residence=row.residence,
        house=row.house,
        hostel_id=row.hostel_id,
        hostel_room_id=row.hostel_room_id,
        hostel_name=hostel_name,
        hostel_room_name=hostel_room_name,
        admission_date=row.admission_date,
        previous_school=row.previous_school,
        home_address=row.home_address,
        village=row.village,
        district=row.district,
        photo_url=row.photo_url,
        status=row.status,
        is_active=row.is_active,
        guardian=guardian,
        guardian_count=guardian_count,
    )


async def get_roster_summary(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    role: str | None = None,
    user_id: UUID | None = None,
) -> RosterSummaryOut:
    access = await _load_teacher_access(session, tenant_id, role=role, user_id=user_id)
    base = (Student.tenant_id == tenant_id, Student.deleted_at.is_(None))

    if access is not None:
        visible = _teacher_student_visibility(access)
        total = int(
            await session.scalar(
                select(func.count()).select_from(Student).where(*base, visible)
            )
            or 0
        )
        unassigned = 0
        class_ids = access.class_ids()
    else:
        total = int(
            await session.scalar(select(func.count()).select_from(Student).where(*base)) or 0
        )
        unassigned = int(
            await session.scalar(
                select(func.count())
                .select_from(Student)
                .where(*base, Student.class_id.is_(None))
            )
            or 0
        )
        class_ids = None

    classes = list(
        await session.scalars(
            select(SchoolClass)
            .where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.deleted_at.is_(None),
                *(
                    [SchoolClass.id.in_(class_ids)]
                    if class_ids is not None
                    else []
                ),
            )
            .order_by(SchoolClass.sort_order, SchoolClass.level)
        )
    )

    class_counts: list[ClassRosterCount] = []
    for school_class in classes:
        class_access = access.classes.get(school_class.id) if access else None
        if access is not None and class_access is None:
            continue

        class_stmt = select(func.count()).select_from(Student).where(
            *base, Student.class_id == school_class.id
        )
        if class_access is not None and not class_access.all_streams:
            class_stmt = class_stmt.where(Student.stream_id.in_(class_access.stream_ids))

        class_count = int(await session.scalar(class_stmt) or 0)

        streams = list(
            await session.scalars(
                select(ClassStream)
                .where(
                    ClassStream.tenant_id == tenant_id,
                    ClassStream.class_id == school_class.id,
                    ClassStream.deleted_at.is_(None),
                    *(
                        [ClassStream.id.in_(class_access.stream_ids)]
                        if class_access is not None and not class_access.all_streams
                        else []
                    ),
                )
                .order_by(ClassStream.sort_order, ClassStream.name)
            )
        )
        stream_counts: list[StreamRosterCount] = []
        for stream in streams:
            stream_count = int(
                await session.scalar(
                    select(func.count())
                    .select_from(Student)
                    .where(*base, Student.stream_id == stream.id)
                )
                or 0
            )
            stream_counts.append(
                StreamRosterCount(
                    stream_id=stream.id,
                    name=stream.name,
                    count=stream_count,
                )
            )
        class_counts.append(
            ClassRosterCount(
                class_id=school_class.id,
                level=school_class.level.value,
                label=school_class.label,
                count=class_count,
                streams=stream_counts,
            )
        )

    return RosterSummaryOut(total=total, unassigned=unassigned, classes=class_counts)


async def list_students(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    cursor: str | None = None,
    limit: int = 50,
    class_id: UUID | None = None,
    stream_id: UUID | None = None,
    unassigned: bool = False,
    q: str | None = None,
    role: str | None = None,
    user_id: UUID | None = None,
) -> CursorPage[StudentOut]:
    access = await _load_teacher_access(session, tenant_id, role=role, user_id=user_id)
    if access is not None:
        if unassigned:
            raise ForbiddenError("You can only view students in classes you are assigned to.")
        if class_id is not None:
            _ensure_teacher_can_view(access, class_id=class_id, stream_id=stream_id)
        elif stream_id is not None:
            raise ForbiddenError("Select a class to view its students.")

    limit = min(max(limit, 1), 100)
    stmt = (
        select(Student)
        .where(Student.tenant_id == tenant_id, Student.deleted_at.is_(None))
        .order_by(Student.student_number, Student.id)
    )

    if access is not None:
        stmt = stmt.where(_teacher_student_visibility(access))

    if unassigned:
        stmt = stmt.where(Student.class_id.is_(None))
    elif class_id is not None:
        stmt = stmt.where(Student.class_id == class_id)
        if stream_id is not None:
            stmt = stmt.where(Student.stream_id == stream_id)
        elif access is not None:
            class_access = access.classes.get(class_id)
            if class_access is not None and not class_access.all_streams:
                stmt = stmt.where(Student.stream_id.in_(class_access.stream_ids))

    if q:
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                Student.student_number.ilike(needle),
                Student.first_name.ilike(needle),
                Student.last_name.ilike(needle),
                Student.lin.ilike(needle),
            )
        )

    if cursor:
        c_num, c_id = _decode_cursor(cursor)
        stmt = stmt.where(tuple_(Student.student_number, Student.id) > tuple_(c_num, c_id))

    rows = list(await session.scalars(stmt.limit(limit + 1)))
    has_more = len(rows) > limit
    page_rows = rows[:limit]
    items = [await _student_out(session, tenant_id, r) for r in page_rows]
    next_cursor = (
        _encode_cursor(page_rows[-1].student_number, page_rows[-1].id) if has_more else None
    )
    return CursorPage(items=items, next_cursor=next_cursor, has_more=has_more)


async def get_student(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    *,
    role: str | None = None,
    user_id: UUID | None = None,
) -> StudentOut:
    row = await session.scalar(
        select(Student).where(
            Student.id == student_id,
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Student not found.")
    access = await _load_teacher_access(session, tenant_id, role=role, user_id=user_id)
    if access is not None:
        _ensure_teacher_can_view(access, class_id=row.class_id, stream_id=row.stream_id)
    return await _student_out(session, tenant_id, row)


async def get_student_detail(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    *,
    role: str | None = None,
    user_id: UUID | None = None,
) -> StudentDetailOut:
    row = await session.scalar(
        select(Student).where(
            Student.id == student_id,
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Student not found.")
    access = await _load_teacher_access(session, tenant_id, role=role, user_id=user_id)
    if access is not None:
        _ensure_teacher_can_view(access, class_id=row.class_id, stream_id=row.stream_id)

    base = await _student_out(session, tenant_id, row)
    guardians = await student_profile_service.list_guardians(session, tenant_id, student_id)
    health = await student_profile_service.get_health(session, tenant_id, student_id)
    discipline = await student_profile_service.list_discipline(
        session, tenant_id, student_id=student_id
    )
    return StudentDetailOut(
        **base.model_dump(),
        guardians=guardians,
        health=health,
        discipline=discipline,
    )


async def create_student(
    session: AsyncSession, tenant_id: UUID, body: StudentCreate
) -> StudentOut:
    if body.class_id is None:
        validate_student_enrollment(body, class_has_streams=False)
    else:
        has_streams = await class_has_active_streams(session, tenant_id, body.class_id)
        validate_student_enrollment(body, class_has_streams=has_streams)

    class_id, stream_id = await _resolve_placement(
        session, tenant_id, body.class_id, body.stream_id
    )

    # Boarding allocation (hostel add-on). A hostel selection implies boarder.
    hostel_id = body.hostel_id
    hostel_room_id = body.hostel_room_id
    residence = body.residence
    if hostel_id is not None:
        await hostel_service.validate_allocation(
            session,
            tenant_id,
            hostel_id=hostel_id,
            room_id=hostel_room_id,
            student_gender=body.gender,
        )
        residence = "boarder"
    else:
        hostel_room_id = None

    student_number = await student_number_service.generate_student_number(session, tenant_id)

    row = Student(
        tenant_id=tenant_id,
        student_number=student_number,
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        middle_name=(body.middle_name or None),
        preferred_name=(body.preferred_name or None),
        lin=body.lin.strip() if body.lin else None,
        class_id=class_id,
        stream_id=stream_id,
        gender=body.gender,
        date_of_birth=body.date_of_birth,
        nationality=(body.nationality or None),
        religion=(body.religion or None),
        residence=residence,
        house=(body.house or None),
        hostel_id=hostel_id,
        hostel_room_id=hostel_room_id,
        admission_date=body.admission_date,
        previous_school=(body.previous_school or None),
        home_address=(body.home_address or None),
        village=(body.village or None),
        district=(body.district or None),
        photo_url=(body.photo_url or None),
        status=body.status,
        is_active=True,
    )
    session.add(row)
    await session.flush()

    # Onboarding wizard may submit guardians + health in the same call.
    for guardian in body.guardians:
        await student_profile_service.add_guardian(session, tenant_id, row.id, guardian)
    if body.health is not None:
        await student_profile_service.upsert_health(session, tenant_id, row.id, body.health)

    return await _student_out(session, tenant_id, row)


async def update_student(
    session: AsyncSession, tenant_id: UUID, student_id: UUID, body: StudentUpdate
) -> StudentOut:
    row = await session.scalar(
        select(Student).where(
            Student.id == student_id,
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Student not found.")

    if body.clear_class:
        row.class_id = None
        row.stream_id = None
    elif body.class_id is not None or body.stream_id is not None:
        class_id = body.class_id if body.class_id is not None else row.class_id
        stream_id = body.stream_id if body.stream_id is not None else row.stream_id
        if class_id is None:
            row.class_id = None
            row.stream_id = None
        else:
            resolved_class, resolved_stream = await _resolve_placement(
                session, tenant_id, class_id, stream_id
            )
            row.class_id = resolved_class
            row.stream_id = resolved_stream

    if body.first_name is not None:
        row.first_name = body.first_name.strip()
    if body.last_name is not None:
        row.last_name = body.last_name.strip()
    if body.lin is not None:
        row.lin = body.lin.strip() or None
    if body.gender is not None:
        row.gender = body.gender
    if body.date_of_birth is not None:
        row.date_of_birth = body.date_of_birth
    if body.is_active is not None:
        row.is_active = body.is_active
    if body.status is not None:
        row.status = body.status

    # Optional profile fields — only touch when present in the payload.
    profile_set = body.model_fields_set
    for attr in (
        "middle_name",
        "preferred_name",
        "nationality",
        "religion",
        "residence",
        "house",
        "admission_date",
        "previous_school",
        "home_address",
        "village",
        "district",
        "photo_url",
    ):
        if attr in profile_set:
            value = getattr(body, attr)
            if isinstance(value, str):
                value = value.strip() or None
            setattr(row, attr, value)

    # Boarding allocation (hostel add-on).
    if "hostel_id" in profile_set:
        if body.hostel_id is None:
            row.hostel_id = None
            row.hostel_room_id = None
        else:
            new_room = (
                body.hostel_room_id if "hostel_room_id" in profile_set else None
            )
            await hostel_service.validate_allocation(
                session,
                tenant_id,
                hostel_id=body.hostel_id,
                room_id=new_room,
                student_gender=row.gender,
                exclude_student_id=row.id,
            )
            row.hostel_id = body.hostel_id
            row.hostel_room_id = new_room
            row.residence = "boarder"
    elif "hostel_room_id" in profile_set and row.hostel_id is not None:
        await hostel_service.validate_allocation(
            session,
            tenant_id,
            hostel_id=row.hostel_id,
            room_id=body.hostel_room_id,
            student_gender=row.gender,
            exclude_student_id=row.id,
        )
        row.hostel_room_id = body.hostel_room_id

    # Switching a learner to day scholar releases their boarding allocation.
    if "residence" in profile_set and body.residence == "day":
        row.hostel_id = None
        row.hostel_room_id = None

    return await _student_out(session, tenant_id, row)


async def delete_student(
    session: AsyncSession, tenant_id: UUID, student_id: UUID
) -> None:
    row = await session.scalar(
        select(Student).where(
            Student.id == student_id,
            Student.tenant_id == tenant_id,
            Student.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Student not found.")
    row.deleted_at = dt.datetime.now(dt.UTC)
    row.is_active = False


async def bulk_assign_students(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    student_ids: list[UUID],
    class_id: UUID | None,
    stream_id: UUID | None,
    clear_class: bool,
) -> BulkAssignResponse:
    results: list[BulkAssignRowResult] = []
    updated = failed = 0

    for student_id in student_ids:
        row = await session.scalar(
            select(Student).where(
                Student.id == student_id,
                Student.tenant_id == tenant_id,
                Student.deleted_at.is_(None),
            )
        )
        if row is None:
            failed += 1
            results.append(
                BulkAssignRowResult(
                    student_id=student_id,
                    status="failed",
                    message="Student not found",
                )
            )
            continue

        try:
            if clear_class:
                row.class_id = None
                row.stream_id = None
            elif class_id is not None:
                resolved_class, resolved_stream = await _resolve_placement(
                    session, tenant_id, class_id, stream_id
                )
                row.class_id = resolved_class
                row.stream_id = resolved_stream
            else:
                raise ValueError("Provide class_id or clear_class")

            updated += 1
            results.append(BulkAssignRowResult(student_id=student_id, status="updated"))
        except Exception as exc:  # noqa: BLE001
            failed += 1
            results.append(
                BulkAssignRowResult(
                    student_id=student_id,
                    status="failed",
                    message=str(exc),
                )
            )

    return BulkAssignResponse(updated=updated, failed=failed, results=results)
