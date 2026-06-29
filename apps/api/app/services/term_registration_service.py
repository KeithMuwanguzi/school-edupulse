"""Term registration workflow — queue, section progress, collaborative checks."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.academic import Term
from app.models.enums import TermStatus
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import Student
from app.models.term_registration import (
    StudentRegistrationResponse,
    StudentTermRegistration,
)
from app.models.user import TenantUser
from app.schemas.term_registration import (
    QueueItemOut,
    RegistrationDetailOut,
    RegistrationSummaryOut,
    RequirementOut,
    ResponseInput,
    ResponseOut,
    SectionProgressOut,
)
from app.services import term_registration_config_service


def _unwrap_value(raw: dict | None) -> str | bool | int | float | None:
    if raw is None:
        return None
    return raw.get("value")


def _wrap_value(value: str | bool | int | float | None) -> dict | None:
    if value is None:
        return None
    return {"value": value}


def _is_satisfied(
    requirement: RequirementOut,
    response: StudentRegistrationResponse | None,
) -> bool:
    if response is None:
        return False
    if response.status == "waived":
        return True
    if response.status != "satisfied":
        return False
    val = _unwrap_value(response.value)
    if requirement.field_type == "checkbox":
        return val is True
    if val is None:
        return False
    if isinstance(val, str):
        return bool(val.strip())
    return True


def _section_progress(
    section_reqs: list[RequirementOut],
    responses: dict[UUID, StudentRegistrationResponse],
) -> tuple[int, int, int, int, bool, list[ResponseOut]]:
    required_total = required_done = optional_total = optional_done = 0
    response_outs: list[ResponseOut] = []

    for req in section_reqs:
        resp = responses.get(req.id)
        satisfied = _is_satisfied(req, resp)
        if req.is_required:
            required_total += 1
            if satisfied:
                required_done += 1
        else:
            optional_total += 1
            if satisfied:
                optional_done += 1
        if resp is not None:
            response_outs.append(
                ResponseOut(
                    id=resp.id,
                    requirement_id=req.id,
                    value=_unwrap_value(resp.value),
                    status=resp.status,
                    notes=resp.notes,
                    recorded_by_name=None,
                    recorded_at=resp.recorded_at,
                )
            )

    is_complete = required_total > 0 and required_done == required_total
    return required_total, required_done, optional_total, optional_done, is_complete, response_outs


async def _resolve_term(session: AsyncSession, tenant_id: UUID, term_id: UUID | None) -> Term:
    if term_id is not None:
        term = await session.scalar(
            select(Term).where(Term.tenant_id == tenant_id, Term.id == term_id)
        )
        if term is None:
            raise NotFoundError("Term not found.")
        return term

    term = await session.scalar(
        select(Term).where(
            Term.tenant_id == tenant_id,
            Term.status == TermStatus.active,
        )
    )
    if term is None:
        raise ValidationError("No active term — set one in Academic year settings.")
    return term


async def _student_placement(
    session: AsyncSession, tenant_id: UUID, student: Student
) -> tuple[str | None, str | None, str | None]:
    class_level = class_label = stream_name = None
    if student.class_id:
        school_class = await session.scalar(
            select(SchoolClass).where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.id == student.class_id,
                SchoolClass.deleted_at.is_(None),
            )
        )
        if school_class:
            class_level = school_class.level.value
            class_label = school_class.label
    if student.stream_id:
        stream = await session.scalar(
            select(ClassStream).where(
                ClassStream.tenant_id == tenant_id,
                ClassStream.id == student.stream_id,
                ClassStream.deleted_at.is_(None),
            )
        )
        if stream:
            stream_name = stream.name
    return class_level, class_label, stream_name


async def _load_responses(
    session: AsyncSession, tenant_id: UUID, registration_id: UUID
) -> dict[UUID, StudentRegistrationResponse]:
    rows = list(
        await session.scalars(
            select(StudentRegistrationResponse).where(
                StudentRegistrationResponse.tenant_id == tenant_id,
                StudentRegistrationResponse.registration_id == registration_id,
            )
        )
    )
    return {r.requirement_id: r for r in rows}


async def summary(
    session: AsyncSession, tenant_id: UUID, term_id: UUID | None
) -> RegistrationSummaryOut:
    term = await _resolve_term(session, tenant_id, term_id)
    section_outs, _ = await term_registration_config_service.get_active_config(
        session, tenant_id
    )

    students = list(
        await session.scalars(
            select(Student).where(
                Student.tenant_id == tenant_id,
                Student.deleted_at.is_(None),
                Student.is_active.is_(True),
                Student.status == "enrolled",
            )
        )
    )
    regs = list(
        await session.scalars(
            select(StudentTermRegistration).where(
                StudentTermRegistration.tenant_id == tenant_id,
                StudentTermRegistration.term_id == term.id,
            )
        )
    )
    reg_by_student = {r.student_id: r for r in regs}
    not_started = in_progress = complete = 0
    for student in students:
        reg = reg_by_student.get(student.id)
        if reg is None:
            not_started += 1
        elif reg.status == "complete":
            complete += 1
        else:
            in_progress += 1

    return RegistrationSummaryOut(
        term_id=term.id,
        term_label=term.label,
        total_students=len(students),
        not_started=not_started,
        in_progress=in_progress,
        complete=complete,
    )


async def queue(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID | None,
    status: str | None,
    q: str | None,
    class_id: UUID | None = None,
    stream_id: UUID | None = None,
    unassigned: bool = False,
    limit: int = 500,
) -> list[QueueItemOut]:
    term = await _resolve_term(session, tenant_id, term_id)
    section_outs, _ = await term_registration_config_service.get_active_config(
        session, tenant_id
    )
    sections_total = len(section_outs)
    required_total_all = sum(
        len([r for r in s.requirements if r.is_required]) for s in section_outs
    )

    stmt = select(Student).where(
        Student.tenant_id == tenant_id,
        Student.deleted_at.is_(None),
        Student.is_active.is_(True),
        Student.status == "enrolled",
    )
    if unassigned:
        stmt = stmt.where(Student.class_id.is_(None))
    elif class_id is not None:
        stmt = stmt.where(Student.class_id == class_id)
        if stream_id is not None:
            stmt = stmt.where(Student.stream_id == stream_id)
    if q:
        needle = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Student.first_name.ilike(needle),
                Student.last_name.ilike(needle),
                Student.student_number.ilike(needle),
            )
        )
    stmt = stmt.order_by(
        Student.last_name,
        func.coalesce(Student.middle_name, ""),
        Student.first_name,
        Student.id,
    ).limit(limit)
    students = list(await session.scalars(stmt))

    regs = list(
        await session.scalars(
            select(StudentTermRegistration).where(
                StudentTermRegistration.tenant_id == tenant_id,
                StudentTermRegistration.term_id == term.id,
            )
        )
    )
    reg_by_student = {r.student_id: r for r in regs}

    items: list[QueueItemOut] = []
    for student in students:
        reg = reg_by_student.get(student.id)
        reg_status = reg.status if reg else "not_started"
        if status and reg_status != status:
            continue

        required_done = 0
        sections_complete = 0
        if reg:
            responses = await _load_responses(session, tenant_id, reg.id)
            for sec in section_outs:
                rt, rd, _, _, complete, _ = _section_progress(sec.requirements, responses)
                required_done += rd
                if complete:
                    sections_complete += 1

        class_level, class_label, stream_name = await _student_placement(
            session, tenant_id, student
        )
        items.append(
            QueueItemOut(
                student_id=student.id,
                student_number=student.student_number,
                first_name=student.first_name,
                middle_name=student.middle_name,
                last_name=student.last_name,
                class_level=class_level,
                class_label=class_label,
                stream_name=stream_name,
                registration_id=reg.id if reg else None,
                status=reg_status,
                required_total=required_total_all,
                required_done=required_done,
                sections_complete=sections_complete,
                sections_total=sections_total,
            )
        )
    return items


async def start_registration(
    session: AsyncSession,
    tenant_id: UUID,
    student_id: UUID,
    term_id: UUID | None,
    user_id: UUID,
) -> RegistrationDetailOut:
    term = await _resolve_term(session, tenant_id, term_id)
    student = await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.id == student_id,
            Student.deleted_at.is_(None),
        )
    )
    if student is None:
        raise NotFoundError("Student not found — onboard the learner first.")
    if not student.is_active or student.status != "enrolled":
        raise ValidationError("Only active enrolled students can be registered for a term.")

    existing = await session.scalar(
        select(StudentTermRegistration).where(
            StudentTermRegistration.tenant_id == tenant_id,
            StudentTermRegistration.student_id == student_id,
            StudentTermRegistration.term_id == term.id,
        )
    )
    if existing:
        return await get_registration(session, tenant_id, existing.id)

    row = StudentTermRegistration(
        tenant_id=tenant_id,
        student_id=student_id,
        term_id=term.id,
        status="in_progress",
        class_id=student.class_id,
        stream_id=student.stream_id,
        started_by_user_id=user_id,
    )
    session.add(row)
    await session.flush()
    return await get_registration(session, tenant_id, row.id)


async def get_registration(
    session: AsyncSession, tenant_id: UUID, registration_id: UUID
) -> RegistrationDetailOut:
    reg = await session.scalar(
        select(StudentTermRegistration).where(
            StudentTermRegistration.tenant_id == tenant_id,
            StudentTermRegistration.id == registration_id,
        )
    )
    if reg is None:
        raise NotFoundError("Registration not found.")

    student = await session.scalar(
        select(Student).where(
            Student.tenant_id == tenant_id,
            Student.id == reg.student_id,
            Student.deleted_at.is_(None),
        )
    )
    if student is None:
        raise NotFoundError("Student not found.")

    term = await session.get(Term, reg.term_id)
    section_outs, req_map = await term_registration_config_service.get_active_config(
        session, tenant_id
    )
    responses = await _load_responses(session, tenant_id, reg.id)

    # Resolve recorder names
    user_ids = {r.recorded_by_user_id for r in responses.values() if r.recorded_by_user_id}
    names: dict[UUID, str] = {}
    if user_ids:
        users = list(
            await session.scalars(
                select(TenantUser).where(
                    TenantUser.tenant_id == tenant_id,
                    TenantUser.id.in_(user_ids),
                )
            )
        )
        names = {u.id: u.name for u in users}

    sections: list[SectionProgressOut] = []
    total_required = total_required_done = sections_complete = 0
    for sec in section_outs:
        rt, rd, ot, od, complete, resp_outs = _section_progress(sec.requirements, responses)
        for ro in resp_outs:
            raw = responses.get(ro.requirement_id)
            if raw and raw.recorded_by_user_id:
                ro.recorded_by_name = names.get(raw.recorded_by_user_id)
        total_required += rt
        total_required_done += rd
        if complete:
            sections_complete += 1
        sections.append(
            SectionProgressOut(
                section_id=sec.id,
                slug=sec.slug,
                label=sec.label,
                icon=sec.icon,
                required_total=rt,
                required_done=rd,
                optional_total=ot,
                optional_done=od,
                is_complete=complete,
                requirements=sec.requirements,
                responses=resp_outs,
            )
        )

    class_level, class_label, stream_name = await _student_placement(
        session, tenant_id, student
    )
    return RegistrationDetailOut(
        id=reg.id,
        student_id=student.id,
        student_number=student.student_number,
        first_name=student.first_name,
        last_name=student.last_name,
        term_id=reg.term_id,
        term_label=term.label if term else "",
        status=reg.status,
        class_level=class_level,
        class_label=class_label,
        stream_name=stream_name,
        required_total=total_required,
        required_done=total_required_done,
        sections_complete=sections_complete,
        sections_total=len(section_outs),
        completed_at=reg.completed_at,
        sections=sections,
    )


async def upsert_responses(
    session: AsyncSession,
    tenant_id: UUID,
    registration_id: UUID,
    user_id: UUID,
    inputs: list[ResponseInput],
) -> RegistrationDetailOut:
    reg = await session.scalar(
        select(StudentTermRegistration).where(
            StudentTermRegistration.tenant_id == tenant_id,
            StudentTermRegistration.id == registration_id,
        )
    )
    if reg is None:
        raise NotFoundError("Registration not found.")
    if reg.status == "complete":
        raise ConflictError("This registration is already complete.")

    _, req_map = await term_registration_config_service.get_active_config(session, tenant_id)
    now = dt.datetime.now(dt.UTC)
    for item in inputs:
        req = req_map.get(item.requirement_id)
        if req is None:
            raise ValidationError(f"Unknown requirement: {item.requirement_id}")

        row = await session.scalar(
            select(StudentRegistrationResponse).where(
                StudentRegistrationResponse.tenant_id == tenant_id,
                StudentRegistrationResponse.registration_id == registration_id,
                StudentRegistrationResponse.requirement_id == item.requirement_id,
            )
        )
        if row is None:
            row = StudentRegistrationResponse(
                tenant_id=tenant_id,
                registration_id=registration_id,
                requirement_id=item.requirement_id,
            )
            session.add(row)

        row.value = _wrap_value(item.value)
        row.status = item.status
        row.notes = item.notes
        row.recorded_by_user_id = user_id
        row.recorded_at = now

    await session.flush()
    await _maybe_auto_complete(session, tenant_id, reg, user_id)
    return await get_registration(session, tenant_id, registration_id)


async def _maybe_auto_complete(
    session: AsyncSession,
    tenant_id: UUID,
    reg: StudentTermRegistration,
    user_id: UUID,
) -> None:
    detail = await get_registration(session, tenant_id, reg.id)
    if detail.required_total > 0 and detail.required_done >= detail.required_total:
        reg.status = "complete"
        reg.completed_at = dt.datetime.now(dt.UTC)
        reg.completed_by_user_id = user_id
        await session.flush()


async def complete_registration(
    session: AsyncSession,
    tenant_id: UUID,
    registration_id: UUID,
    user_id: UUID,
) -> RegistrationDetailOut:
    reg = await session.scalar(
        select(StudentTermRegistration).where(
            StudentTermRegistration.tenant_id == tenant_id,
            StudentTermRegistration.id == registration_id,
        )
    )
    if reg is None:
        raise NotFoundError("Registration not found.")

    detail = await get_registration(session, tenant_id, registration_id)
    if detail.required_done < detail.required_total:
        raise ValidationError(
            f"{detail.required_total - detail.required_done} required item(s) still outstanding."
        )

    reg.status = "complete"
    reg.completed_at = dt.datetime.now(dt.UTC)
    reg.completed_by_user_id = user_id
    await session.flush()
    return await get_registration(session, tenant_id, registration_id)
