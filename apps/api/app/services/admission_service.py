"""Admissions pipeline service — Phase 2 §14."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.models.admission import AdmissionApplication
from app.models.school_class import ClassStream, SchoolClass
from app.schemas.admission import (
    STATUS_TRANSITIONS,
    WITHDRAWAL_REASONS,
    AdmissionApplicationCreate,
    AdmissionApplicationOut,
    AdmissionApplicationUpdate,
    AdmissionBatchResponse,
    AdmissionBatchRowCreate,
    AdmissionBatchRowResult,
)


def _today() -> dt.date:
    return dt.date.today()


async def _next_reference(session: AsyncSession, tenant_id: UUID) -> str:
    refs = await _next_references(session, tenant_id, 1)
    return refs[0]


async def _next_references(
    session: AsyncSession, tenant_id: UUID, count: int
) -> list[str]:
    year = _today().year
    prefix = f"ADM-{year}-"
    current = await session.scalar(
        select(func.count())
        .select_from(AdmissionApplication)
        .where(
            AdmissionApplication.tenant_id == tenant_id,
            AdmissionApplication.reference_number.like(f"{prefix}%"),
            AdmissionApplication.deleted_at.is_(None),
        )
    )
    base = int(current or 0)
    return [f"{prefix}{base + i + 1:04d}" for i in range(count)]


async def _load_class_labels(
    session: AsyncSession, tenant_id: UUID, row: AdmissionApplication
) -> tuple[str | None, str | None]:
    class_label: str | None = None
    stream_name: str | None = None
    if row.applied_class_id:
        cls = await session.scalar(
            select(SchoolClass).where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.id == row.applied_class_id,
                SchoolClass.deleted_at.is_(None),
            )
        )
        if cls:
            class_label = f"{cls.level} · {cls.label}" if cls.label else cls.level
    if row.applied_stream_id:
        stream = await session.scalar(
            select(ClassStream).where(
                ClassStream.tenant_id == tenant_id,
                ClassStream.id == row.applied_stream_id,
                ClassStream.deleted_at.is_(None),
            )
        )
        if stream:
            stream_name = stream.name
    return class_label, stream_name


def _to_out(
    row: AdmissionApplication,
    *,
    class_label: str | None = None,
    stream_name: str | None = None,
) -> AdmissionApplicationOut:
    return AdmissionApplicationOut(
        id=row.id,
        reference_number=row.reference_number,
        status=row.status,
        first_name=row.first_name,
        last_name=row.last_name,
        middle_name=row.middle_name,
        gender=row.gender,
        date_of_birth=row.date_of_birth,
        applied_class_level=row.applied_class_level,
        applied_class_id=row.applied_class_id,
        applied_stream_id=row.applied_stream_id,
        applied_class_label=class_label,
        applied_stream_name=stream_name,
        guardian_name=row.guardian_name,
        guardian_relationship=row.guardian_relationship,
        guardian_phone=row.guardian_phone,
        guardian_email=row.guardian_email,
        previous_school=row.previous_school,
        notes=row.notes,
        interview_date=row.interview_date,
        interview_score=row.interview_score,
        applied_at=row.applied_at,
        student_id=row.student_id,
        enrolled_at=row.enrolled_at,
        withdrawal_reason=row.withdrawal_reason,
        withdrawal_note=row.withdrawal_note,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def list_applications(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    status: str | None = None,
) -> list[AdmissionApplicationOut]:
    q = (
        select(AdmissionApplication)
        .where(
            AdmissionApplication.tenant_id == tenant_id,
            AdmissionApplication.deleted_at.is_(None),
        )
        .order_by(AdmissionApplication.applied_at.desc(), AdmissionApplication.created_at.desc())
    )
    if status:
        q = q.where(AdmissionApplication.status == status)
    rows = (await session.execute(q)).scalars().all()
    out: list[AdmissionApplicationOut] = []
    for row in rows:
        class_label, stream_name = await _load_class_labels(session, tenant_id, row)
        out.append(_to_out(row, class_label=class_label, stream_name=stream_name))
    return out


async def get_application(
    session: AsyncSession, tenant_id: UUID, application_id: UUID
) -> AdmissionApplicationOut:
    row = await _get_row(session, tenant_id, application_id)
    class_label, stream_name = await _load_class_labels(session, tenant_id, row)
    return _to_out(row, class_label=class_label, stream_name=stream_name)


async def _get_row(
    session: AsyncSession, tenant_id: UUID, application_id: UUID
) -> AdmissionApplication:
    row = await session.scalar(
        select(AdmissionApplication).where(
            AdmissionApplication.tenant_id == tenant_id,
            AdmissionApplication.id == application_id,
            AdmissionApplication.deleted_at.is_(None),
        )
    )
    if row is None:
        raise NotFoundError("Application not found.")
    return row


def _application_from_create(
    tenant_id: UUID,
    body: AdmissionApplicationCreate,
    *,
    reference_number: str,
) -> AdmissionApplication:
    return AdmissionApplication(
        tenant_id=tenant_id,
        reference_number=reference_number,
        status="application",
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        middle_name=body.middle_name.strip() if body.middle_name else None,
        gender=body.gender or None,
        date_of_birth=body.date_of_birth,
        applied_class_level=body.applied_class_level,
        applied_class_id=body.applied_class_id,
        applied_stream_id=body.applied_stream_id,
        guardian_name=body.guardian_name.strip() if body.guardian_name else None,
        guardian_relationship=body.guardian_relationship or None,
        guardian_phone=body.guardian_phone.strip() if body.guardian_phone else None,
        guardian_email=body.guardian_email.strip() if body.guardian_email else None,
        previous_school=body.previous_school.strip() if body.previous_school else None,
        notes=body.notes.strip() if body.notes else None,
        applied_at=body.applied_at or _today(),
    )


async def create_application(
    session: AsyncSession, tenant_id: UUID, body: AdmissionApplicationCreate
) -> AdmissionApplicationOut:
    ref = await _next_reference(session, tenant_id)
    row = _application_from_create(tenant_id, body, reference_number=ref)
    session.add(row)
    await session.flush()
    await session.refresh(row)
    class_label, stream_name = await _load_class_labels(session, tenant_id, row)
    return _to_out(row, class_label=class_label, stream_name=stream_name)


async def create_applications_batch(
    session: AsyncSession,
    tenant_id: UUID,
    rows: list[AdmissionBatchRowCreate],
) -> AdmissionBatchResponse:
    refs = await _next_references(session, tenant_id, len(rows))
    results: list[AdmissionBatchRowResult] = []
    created = 0
    failed = 0

    for i, body_row in enumerate(rows):
        line = i + 1
        identifier = f"{body_row.last_name.strip()} {body_row.first_name.strip()}".strip() or f"Row {line}"
        try:
            first = body_row.first_name.strip()
            last = body_row.last_name.strip()
            if not first or not last:
                raise ValidationError("Surname and last name are required.")
            body = AdmissionApplicationCreate(
                first_name=first,
                last_name=last,
                middle_name=body_row.middle_name,
                gender=body_row.gender,
                date_of_birth=body_row.date_of_birth,
                applied_class_level=body_row.applied_class_level,
                applied_class_id=body_row.applied_class_id,
                applied_stream_id=body_row.applied_stream_id,
                guardian_name=body_row.guardian_name,
                guardian_relationship=body_row.guardian_relationship,
                guardian_phone=body_row.guardian_phone,
                guardian_email=body_row.guardian_email,
                previous_school=body_row.previous_school,
                notes=body_row.notes,
                applied_at=body_row.applied_at,
            )
            row = _application_from_create(tenant_id, body, reference_number=refs[i])
            session.add(row)
            await session.flush()
            await session.refresh(row)
            results.append(
                AdmissionBatchRowResult(
                    line=line,
                    identifier=identifier,
                    status="created",
                    application_id=row.id,
                    reference_number=row.reference_number,
                )
            )
            created += 1
        except ValidationError as exc:
            failed += 1
            results.append(
                AdmissionBatchRowResult(
                    line=line,
                    identifier=identifier,
                    status="failed",
                    message=str(exc),
                )
            )
        except Exception as exc:
            failed += 1
            results.append(
                AdmissionBatchRowResult(
                    line=line,
                    identifier=identifier,
                    status="failed",
                    message=str(exc),
                )
            )

    return AdmissionBatchResponse(created=created, failed=failed, results=results)


async def update_application(
    session: AsyncSession,
    tenant_id: UUID,
    application_id: UUID,
    body: AdmissionApplicationUpdate,
) -> AdmissionApplicationOut:
    row = await _get_row(session, tenant_id, application_id)
    data = body.model_dump(exclude_unset=True)

    if "status" in data and data["status"] is not None:
        new_status = data["status"]
        allowed = STATUS_TRANSITIONS.get(row.status, set())
        if new_status != row.status and new_status not in allowed:
            raise ValidationError(
                f"Cannot move from '{row.status}' to '{new_status}'."
            )
        if new_status == "enrolled" and row.student_id is None:
            raise ValidationError("Link a student record before marking as enrolled.")
        if new_status == "withdrawn":
            reason = data.get("withdrawal_reason", row.withdrawal_reason)
            if not reason or reason not in WITHDRAWAL_REASONS:
                raise ValidationError("Select a withdrawal reason.")
            note = data.get("withdrawal_note", row.withdrawal_note)
            if isinstance(note, str):
                note = note.strip() or None
            if reason == "other" and not note:
                raise ValidationError("Add a note when the reason is Other.")
            data.setdefault("withdrawal_reason", reason)
            if note is not None:
                data["withdrawal_note"] = note
        if new_status == "application" and row.status == "withdrawn":
            data["withdrawal_reason"] = None
            data["withdrawal_note"] = None

    for key, value in data.items():
        if key in {
            "first_name",
            "last_name",
            "middle_name",
            "guardian_name",
            "guardian_phone",
            "guardian_email",
            "previous_school",
            "notes",
            "withdrawal_note",
        }:
            if isinstance(value, str):
                value = value.strip() or None
        setattr(row, key, value)

    await session.flush()
    await session.refresh(row)
    class_label, stream_name = await _load_class_labels(session, tenant_id, row)
    return _to_out(row, class_label=class_label, stream_name=stream_name)


async def link_enrolled_student(
    session: AsyncSession,
    tenant_id: UUID,
    application_id: UUID,
    student_id: UUID,
) -> AdmissionApplicationOut:
    row = await _get_row(session, tenant_id, application_id)
    if row.status not in {"accepted", "enrolled"}:
        raise ValidationError("Only accepted applications can be linked to a student.")
    row.student_id = student_id
    row.status = "enrolled"
    row.enrolled_at = _today()
    await session.flush()
    await session.refresh(row)
    class_label, stream_name = await _load_class_labels(session, tenant_id, row)
    return _to_out(row, class_label=class_label, stream_name=stream_name)
