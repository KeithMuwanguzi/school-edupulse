"""Term registration — tenant config + per-term student workflow."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import get_tenant_context, require_module, require_role
from app.models.enums import ActorType
from app.schemas.term_registration import (
    RegisteredRosterSummaryOut,
    RegisteredStudentOut,
    RegistrationConfigOut,
    RegistrationDetailOut,
    RegistrationStart,
    RegistrationSummaryOut,
    QueueItemOut,
    RequirementCreate,
    RequirementOut,
    RequirementUpdate,
    ResponsesUpsert,
    SectionCreate,
    SectionOut,
    SectionReorder,
    SectionUpdate,
)
from app.services import (
    term_registration_config_service,
    term_registration_service,
    term_roster_service,
)
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:term-registration"])

_students = require_module("students")
_admin = require_role("school_admin")


# --- Config (admin) ---------------------------------------------------------


@router.get("/registration/config", response_model=RegistrationConfigOut)
async def get_registration_config(
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RegistrationConfigOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await term_registration_config_service.get_config(session, ctx.tenant_id)
    await session.commit()
    return out


@router.post("/registration/sections", response_model=SectionOut, status_code=201)
async def create_registration_section(
    body: SectionCreate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> SectionOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    row = await term_registration_config_service.create_section(session, ctx.tenant_id, body)
    await session.commit()
    return row


@router.patch("/registration/sections/{section_id}", response_model=SectionOut)
async def update_registration_section(
    section_id: UUID,
    body: SectionUpdate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> SectionOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    row = await term_registration_config_service.update_section(
        session, ctx.tenant_id, section_id, body
    )
    await session.commit()
    return row


@router.delete(
    "/registration/sections/{section_id}",
    status_code=204,
    response_class=Response,
)
async def delete_registration_section(
    section_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await term_registration_config_service.delete_section(session, ctx.tenant_id, section_id)
    await session.commit()
    return Response(status_code=204)


@router.put("/registration/sections/reorder", response_model=RegistrationConfigOut)
async def reorder_registration_sections(
    body: SectionReorder,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RegistrationConfigOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await term_registration_config_service.reorder_sections(
        session, ctx.tenant_id, body
    )
    await session.commit()
    return out


@router.post(
    "/registration/sections/{section_id}/requirements",
    response_model=RequirementOut,
    status_code=201,
)
async def create_registration_requirement(
    section_id: UUID,
    body: RequirementCreate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RequirementOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    row = await term_registration_config_service.create_requirement(
        session, ctx.tenant_id, section_id, body
    )
    await session.commit()
    return row


@router.patch("/registration/requirements/{requirement_id}", response_model=RequirementOut)
async def update_registration_requirement(
    requirement_id: UUID,
    body: RequirementUpdate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RequirementOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    row = await term_registration_config_service.update_requirement(
        session, ctx.tenant_id, requirement_id, body
    )
    await session.commit()
    return row


@router.delete(
    "/registration/requirements/{requirement_id}",
    status_code=204,
    response_class=Response,
)
async def delete_registration_requirement(
    requirement_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await term_registration_config_service.delete_requirement(
        session, ctx.tenant_id, requirement_id
    )
    await session.commit()
    return Response(status_code=204)


# --- Workflow (any staff with students module) --------------------------------


@router.get("/registration/roster-summary", response_model=RegisteredRosterSummaryOut)
async def registered_roster_summary(
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(get_tenant_context),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RegisteredRosterSummaryOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await term_roster_service.registered_roster_summary(
        session, ctx.tenant_id, term_id
    )


@router.get("/registration/roster", response_model=list[RegisteredStudentOut])
async def registered_roster(
    term_id: UUID | None = None,
    q: str | None = Query(default=None, max_length=80),
    class_id: UUID | None = Query(default=None),
    stream_id: UUID | None = Query(default=None),
    unassigned: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=500),
    ctx: TenantContext = Depends(get_tenant_context),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> list[RegisteredStudentOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    items, _term = await term_roster_service.list_registered_students(
        session,
        ctx.tenant_id,
        term_id=term_id,
        class_id=class_id,
        stream_id=stream_id,
        unassigned=unassigned,
        q=q,
        limit=limit,
    )
    return items


@router.get("/registration/summary", response_model=RegistrationSummaryOut)
async def registration_summary(
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(get_tenant_context),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RegistrationSummaryOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await term_registration_service.summary(session, ctx.tenant_id, term_id)


@router.get("/registration/queue", response_model=list[QueueItemOut])
async def registration_queue(
    term_id: UUID | None = None,
    status: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80),
    class_id: UUID | None = Query(default=None),
    stream_id: UUID | None = Query(default=None),
    unassigned: bool = Query(default=False),
    ctx: TenantContext = Depends(get_tenant_context),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> list[QueueItemOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await term_registration_service.queue(
        session,
        ctx.tenant_id,
        term_id=term_id,
        status=status,
        q=q,
        class_id=class_id,
        stream_id=stream_id,
        unassigned=unassigned,
    )


@router.post("/registration", response_model=RegistrationDetailOut, status_code=201)
async def start_registration(
    body: RegistrationStart,
    request: Request,
    ctx: TenantContext = Depends(get_tenant_context),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RegistrationDetailOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await term_registration_service.start_registration(
        session, ctx.tenant_id, body.student_id, body.term_id, ctx.user_id
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="registration.started",
        resource_type="student_term_registration",
        resource_id=out.id,
        metadata={"student_id": str(body.student_id), "term_id": str(out.term_id)},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return out


@router.get("/registration/{registration_id}", response_model=RegistrationDetailOut)
async def get_registration(
    registration_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RegistrationDetailOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await term_registration_service.get_registration(
        session, ctx.tenant_id, registration_id
    )


@router.put("/registration/{registration_id}/responses", response_model=RegistrationDetailOut)
async def upsert_registration_responses(
    registration_id: UUID,
    body: ResponsesUpsert,
    ctx: TenantContext = Depends(get_tenant_context),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RegistrationDetailOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await term_registration_service.upsert_responses(
        session,
        ctx.tenant_id,
        registration_id,
        ctx.user_id,
        body.responses,
    )
    await session.commit()
    return out


@router.post("/registration/{registration_id}/complete", response_model=RegistrationDetailOut)
async def complete_registration(
    registration_id: UUID,
    ctx: TenantContext = Depends(get_tenant_context),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RegistrationDetailOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await term_registration_service.complete_registration(
        session, ctx.tenant_id, registration_id, ctx.user_id
    )
    await session.commit()
    return out
