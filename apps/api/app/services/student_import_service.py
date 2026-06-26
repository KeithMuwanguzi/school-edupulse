"""Bulk student enrollment import — Phase 2 §5."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ClassLevel
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import Student
from app.core.errors import ValidationError
from app.schemas.student import (
    GuardianInput,
    HealthInput,
    StudentCreate,
    StudentImportRequest,
    StudentImportResponse,
    StudentImportRow,
    StudentImportRowResult,
)
from app.services.student_enrollment_validation import (
    class_has_active_streams,
    validate_student_enrollment,
)
from app.services.student_service import create_student


async def _class_by_level(
    session: AsyncSession, tenant_id: UUID, level: str
) -> SchoolClass | None:
    return await session.scalar(
        select(SchoolClass).where(
            SchoolClass.tenant_id == tenant_id,
            SchoolClass.level == ClassLevel(level),
            SchoolClass.deleted_at.is_(None),
        )
    )


async def _stream_by_name(
    session: AsyncSession, tenant_id: UUID, class_id: UUID, name: str
) -> ClassStream | None:
    needle = name.strip().lower()
    streams = list(
        await session.scalars(
            select(ClassStream).where(
                ClassStream.tenant_id == tenant_id,
                ClassStream.class_id == class_id,
                ClassStream.deleted_at.is_(None),
            )
        )
    )
    for stream in streams:
        if stream.name.strip().lower() == needle:
            return stream
    return None


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


async def _find_duplicate(
    session: AsyncSession,
    tenant_id: UUID,
    row: StudentImportRow,
    *,
    class_id: UUID,
) -> Student | None:
    """Match existing enrolment by LIN, or by name within the same class."""
    if row.lin and row.lin.strip():
        by_lin = await session.scalar(
            select(Student).where(
                Student.tenant_id == tenant_id,
                Student.lin == row.lin.strip(),
                Student.deleted_at.is_(None),
            )
        )
        if by_lin is not None:
            return by_lin

    first = row.first_name.strip().lower()
    last = row.last_name.strip().lower()
    return await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.class_id == class_id,
            func.lower(Student.first_name) == first,
            func.lower(Student.last_name) == last,
            Student.deleted_at.is_(None),
        )
    )


async def _validate_row(
    session: AsyncSession,
    tenant_id: UUID,
    row: StudentImportRow,
) -> tuple[str, str | None, StudentCreate | None]:
    """Return (status, message, body). status: valid|failed.

    Student numbers are assigned by the system — any number in the sheet is ignored.
    Rows must satisfy the same enrollment completeness rules as the onboarding wizard.
    """
    first = row.first_name.strip()
    last = row.last_name.strip()
    if not first or not last:
        return "failed", "first_name and last_name are required", None

    if not row.class_level:
        return "failed", "class_level is required", None

    school_class = await _class_by_level(session, tenant_id, row.class_level)
    if school_class is None:
        return "failed", f"Class {row.class_level} not found — set up classes first", None

    class_id = school_class.id
    stream_id: UUID | None = None
    if row.stream_name:
        stream = await _stream_by_name(session, tenant_id, class_id, row.stream_name)
        if stream is None:
            return (
                "failed",
                f"Stream '{row.stream_name}' not found in {row.class_level}",
                None,
            )
        stream_id = stream.id

    try:
        body = _import_row_to_student_create(row, class_id=class_id, stream_id=stream_id)
    except ValidationError as exc:
        return "failed", exc.detail, None
    except ValueError as exc:
        return "failed", str(exc), None

    has_streams = await class_has_active_streams(session, tenant_id, class_id)
    try:
        validate_student_enrollment(body, class_has_streams=has_streams)
    except ValidationError as exc:
        return "failed", exc.detail, None

    return "valid", None, body


async def import_students(
    session: AsyncSession,
    tenant_id: UUID,
    body: StudentImportRequest,
) -> StudentImportResponse:
    results: list[StudentImportRowResult] = []
    created = skipped = failed = valid = 0

    for i, row in enumerate(body.rows, start=1):
        ident = f"{row.first_name.strip()} {row.last_name.strip()}".strip() or f"Row {i}"
        try:
            status, message, enrollment = await _validate_row(
                session,
                tenant_id,
                row,
            )
            if status == "valid" and enrollment is not None:
                valid += 1
                if body.dry_run:
                    results.append(
                        StudentImportRowResult(
                            line=i,
                            identifier=ident,
                            status="valid",
                            message="Ready to import",
                        )
                    )
                    continue

                if body.skip_duplicates:
                    duplicate = await _find_duplicate(
                        session,
                        tenant_id,
                        row,
                        class_id=enrollment.class_id,
                    )
                    if duplicate is not None:
                        skipped += 1
                        results.append(
                            StudentImportRowResult(
                                line=i,
                                identifier=ident,
                                status="skipped",
                                message=f"Already enrolled as #{duplicate.student_number}",
                                student_id=duplicate.id,
                            )
                        )
                        continue

                created_student = await create_student(session, tenant_id, enrollment)
                created += 1
                results.append(
                    StudentImportRowResult(
                        line=i,
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
                        line=i,
                        identifier=ident,
                        status="skipped",
                        message=message,
                    )
                )
            else:
                failed += 1
                results.append(
                    StudentImportRowResult(
                        line=i,
                        identifier=ident,
                        status="failed",
                        message=message,
                    )
                )
        except Exception as exc:  # noqa: BLE001 — per-row isolation for bulk import
            failed += 1
            results.append(
                StudentImportRowResult(
                    line=i,
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
