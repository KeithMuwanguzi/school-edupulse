"""Bulk student enrollment import — Phase 2 §5."""
from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError
from app.models.enums import ClassLevel
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import Student, StudentGuardian, StudentHealth
from app.schemas.student import (
    GuardianInput,
    HealthInput,
    StudentCreate,
    StudentImportRequest,
    StudentImportResponse,
    StudentImportRow,
    StudentImportRowResult,
)
from app.services import student_number_service
from app.services.student_enrollment_validation import validate_student_enrollment


@dataclass
class _StudentImportCache:
    classes_by_level: dict[str, SchoolClass] = field(default_factory=dict)
    streams: dict[tuple[UUID, str], ClassStream] = field(default_factory=dict)
    classes_with_streams: set[UUID] = field(default_factory=set)
    by_lin: dict[str, Student] = field(default_factory=dict)
    by_class_name: dict[tuple[UUID, str, str], Student] = field(default_factory=dict)


async def _load_import_cache(session: AsyncSession, tenant_id: UUID) -> _StudentImportCache:
    cache = _StudentImportCache()

    classes = list(
        await session.scalars(
            select(SchoolClass).where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.deleted_at.is_(None),
            )
        )
    )
    for school_class in classes:
        cache.classes_by_level[school_class.level.value] = school_class

    streams = list(
        await session.scalars(
            select(ClassStream).where(
                ClassStream.tenant_id == tenant_id,
                ClassStream.deleted_at.is_(None),
            )
        )
    )
    for stream in streams:
        key = (stream.class_id, stream.name.strip().lower())
        cache.streams[key] = stream
        if stream.is_active:
            cache.classes_with_streams.add(stream.class_id)

    students = list(
        await session.scalars(
            select(Student).where(
                Student.tenant_id == tenant_id,
                Student.deleted_at.is_(None),
            )
        )
    )
    for student in students:
        if student.lin and student.lin.strip():
            cache.by_lin[student.lin.strip()] = student
        if student.class_id:
            name_key = (
                student.class_id,
                student.first_name.strip().lower(),
                student.last_name.strip().lower(),
            )
            cache.by_class_name[name_key] = student

    return cache


def _import_row_to_student_create(
    row: StudentImportRow,
    *,
    class_id: UUID,
    stream_id: UUID | None,
) -> StudentCreate:
    guardians: list[GuardianInput] = []
    if row.guardian_name and row.guardian_name.strip():
        guardians.append(
            GuardianInput(
                relationship=row.guardian_relationship or "guardian",
                full_name=row.guardian_name.strip(),
                phone_primary=row.guardian_phone or None,
                email=row.guardian_email or None,
                is_primary=True,
                is_emergency=True,
            )
        )

    health: HealthInput | None = None
    if row.blood_group or row.allergies or row.medical_conditions:
        health = HealthInput(
            blood_group=row.blood_group or None,
            allergies=row.allergies or None,
            chronic_conditions=row.medical_conditions or None,
        )

    return StudentCreate(
        first_name=row.first_name.strip(),
        last_name=row.last_name.strip(),
        middle_name=(row.middle_name or None),
        lin=row.lin.strip() if row.lin else None,
        class_id=class_id,
        stream_id=stream_id,
        gender=row.gender,
        date_of_birth=row.date_of_birth,
        nationality=(row.nationality or None),
        religion=(row.religion or None),
        residence=row.residence,
        admission_date=row.admission_date,
        previous_school=(row.previous_school or None),
        home_address=(row.home_address or None),
        village=(row.village or None),
        district=(row.district or None),
        guardians=guardians,
        health=health,
    )


def _find_duplicate_cached(
    cache: _StudentImportCache,
    row: StudentImportRow,
    *,
    class_id: UUID,
) -> Student | None:
    if row.lin and row.lin.strip():
        by_lin = cache.by_lin.get(row.lin.strip())
        if by_lin is not None:
            return by_lin

    name_key = (
        class_id,
        row.first_name.strip().lower(),
        row.last_name.strip().lower(),
    )
    return cache.by_class_name.get(name_key)


def _register_created_student(cache: _StudentImportCache, student: Student) -> None:
    if student.lin and student.lin.strip():
        cache.by_lin[student.lin.strip()] = student
    if student.class_id:
        cache.by_class_name[
            (
                student.class_id,
                student.first_name.strip().lower(),
                student.last_name.strip().lower(),
            )
        ] = student


def _validate_row_cached(
    cache: _StudentImportCache,
    row: StudentImportRow,
) -> tuple[str, str | None, StudentCreate | None, bool]:
    """Return (status, message, body, class_has_streams)."""
    first = row.first_name.strip()
    last = row.last_name.strip()
    if not first or not last:
        return "failed", "first_name and last_name are required", None, False

    if not row.class_level:
        return "failed", "class_level is required", None, False

    school_class = cache.classes_by_level.get(row.class_level)
    if school_class is None:
        return "failed", f"Class {row.class_level} not found — set up classes first", None, False

    class_id = school_class.id
    stream_id: UUID | None = None
    if row.stream_name:
        stream = cache.streams.get((class_id, row.stream_name.strip().lower()))
        if stream is None:
            return (
                "failed",
                f"Stream '{row.stream_name}' not found in {row.class_level}",
                None,
                False,
            )
        stream_id = stream.id

    try:
        body = _import_row_to_student_create(row, class_id=class_id, stream_id=stream_id)
    except ValidationError as exc:
        return "failed", exc.detail, None, False
    except ValueError as exc:
        return "failed", str(exc), None, False

    has_streams = class_id in cache.classes_with_streams
    try:
        validate_student_enrollment(body, class_has_streams=has_streams)
    except ValidationError as exc:
        return "failed", exc.detail, None, has_streams

    return "valid", None, body, has_streams


async def _create_imported_student(
    session: AsyncSession,
    tenant_id: UUID,
    body: StudentCreate,
    *,
    class_has_streams: bool,
) -> Student:
    """Fast import path — skips full StudentOut assembly and redundant lookups."""
    validate_student_enrollment(body, class_has_streams=class_has_streams)

    student_number = await student_number_service.generate_student_number(session, tenant_id)
    row = Student(
        tenant_id=tenant_id,
        student_number=student_number,
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        middle_name=(body.middle_name or None),
        preferred_name=(body.preferred_name or None),
        lin=body.lin.strip() if body.lin else None,
        class_id=body.class_id,
        stream_id=body.stream_id,
        gender=body.gender,
        date_of_birth=body.date_of_birth,
        nationality=(body.nationality or None),
        religion=(body.religion or None),
        residence=body.residence,
        house=(body.house or None),
        hostel_id=body.hostel_id,
        hostel_room_id=body.hostel_room_id,
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

    for guardian in body.guardians:
        session.add(
            StudentGuardian(
                tenant_id=tenant_id,
                student_id=row.id,
                relationship=guardian.relationship,
                full_name=guardian.full_name.strip(),
                phone_primary=(guardian.phone_primary or None),
                phone_alt=(guardian.phone_alt or None),
                email=(guardian.email or None),
                occupation=(guardian.occupation or None),
                national_id=(guardian.national_id or None),
                address=(guardian.address or None),
                is_primary=guardian.is_primary,
                is_emergency=guardian.is_emergency,
                can_pickup=guardian.can_pickup,
                portal_user_id=guardian.portal_user_id,
            )
        )

    if body.health is not None:
        data = {
            k: (v or None) if isinstance(v, str) else v
            for k, v in body.health.model_dump().items()
        }
        session.add(StudentHealth(tenant_id=tenant_id, student_id=row.id, **data))

    await session.flush()
    return row


async def import_students(
    session: AsyncSession,
    tenant_id: UUID,
    body: StudentImportRequest,
) -> StudentImportResponse:
    cache = await _load_import_cache(session, tenant_id)
    results: list[StudentImportRowResult] = []
    created = skipped = failed = valid = 0
    line_base = body.line_offset

    for i, row in enumerate(body.rows, start=1):
        line = line_base + i
        ident = f"{row.first_name.strip()} {row.last_name.strip()}".strip() or f"Row {line}"
        try:
            status, message, enrollment, has_streams = _validate_row_cached(cache, row)
            if status == "valid" and enrollment is not None:
                valid += 1
                if body.dry_run:
                    results.append(
                        StudentImportRowResult(
                            line=line,
                            identifier=ident,
                            status="valid",
                            message="Ready to import",
                        )
                    )
                    continue

                if body.skip_duplicates:
                    duplicate = _find_duplicate_cached(
                        cache,
                        row,
                        class_id=enrollment.class_id,
                    )
                    if duplicate is not None:
                        skipped += 1
                        results.append(
                            StudentImportRowResult(
                                line=line,
                                identifier=ident,
                                status="skipped",
                                message=f"Already enrolled as #{duplicate.student_number}",
                                student_id=duplicate.id,
                            )
                        )
                        continue

                created_student = await _create_imported_student(
                    session,
                    tenant_id,
                    enrollment,
                    class_has_streams=has_streams,
                )
                _register_created_student(cache, created_student)
                created += 1
                results.append(
                    StudentImportRowResult(
                        line=line,
                        identifier=ident,
                        status="created",
                        message=f"Assigned #{created_student.student_number}",
                        student_id=created_student.id,
                    )
                )
            elif status == "skipped":
                skipped += 1
                results.append(
                    StudentImportRowResult(
                        line=line,
                        identifier=ident,
                        status="skipped",
                        message=message,
                    )
                )
            else:
                failed += 1
                results.append(
                    StudentImportRowResult(
                        line=line,
                        identifier=ident,
                        status="failed",
                        message=message,
                    )
                )
        except Exception as exc:  # noqa: BLE001 — per-row isolation for bulk import
            failed += 1
            results.append(
                StudentImportRowResult(
                    line=line,
                    identifier=ident,
                    status="failed",
                    message=str(exc),
                )
            )

    return StudentImportResponse(
        created=created,
        skipped=skipped,
        failed=failed,
        valid=valid,
        results=results,
    )
