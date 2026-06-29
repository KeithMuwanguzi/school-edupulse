"""Tenant academic calendar management — Phase 2 §1."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import get_tenant_context, require_role
from app.models.enums import ActorType
from app.schemas.academic import (
    AcademicContextEnriched,
    AcademicYearCreate,
    AcademicYearUpdate,
    AcademicYearWithTerms,
    TermUpdate,
)
from app.schemas.school import TermOut
from app.schemas.term_calendar import (
    TermCalendarEventCreate,
    TermCalendarEventOut,
    TermCalendarEventUpdate,
)
from app.services import academic_service, term_calendar_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:academic"])


@router.get("/academic-years", response_model=list[AcademicYearWithTerms])
async def list_academic_years(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_session),
) -> list[AcademicYearWithTerms]:
    return await academic_service.list_years(session, ctx.tenant_id)


@router.post("/academic-years", response_model=AcademicYearWithTerms, status_code=201)
async def create_academic_year(
    body: AcademicYearCreate,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> AcademicYearWithTerms:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await academic_service.create_year(session, ctx.tenant_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="academic_year.created",
        resource_type="academic_year",
        resource_id=result.id,
        metadata={"label": result.label},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/academic-years/{year_id}", response_model=AcademicYearWithTerms)
async def update_academic_year(
    year_id: UUID,
    body: AcademicYearUpdate,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> AcademicYearWithTerms:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await academic_service.update_year(session, ctx.tenant_id, year_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="academic_year.updated",
        resource_type="academic_year",
        resource_id=year_id,
        metadata=body.model_dump(mode="json", exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post("/academic-years/{year_id}/activate", response_model=AcademicYearWithTerms)
async def activate_academic_year(
    year_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> AcademicYearWithTerms:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await academic_service.activate_year(session, ctx.tenant_id, year_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="academic_year.activated",
        resource_type="academic_year",
        resource_id=year_id,
        metadata={"label": result.label},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/academic-years/{year_id}/terms/{term_id}", response_model=TermOut)
async def update_term(
    year_id: UUID,
    term_id: UUID,
    body: TermUpdate,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> TermOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await academic_service.update_term(
        session, ctx.tenant_id, year_id, term_id, body
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="term.updated",
        resource_type="term",
        resource_id=term_id,
        metadata=body.model_dump(mode="json", exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.post("/academic-years/{year_id}/terms/{term_id}/activate", response_model=TermOut)
async def activate_term(
    year_id: UUID,
    term_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> TermOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await academic_service.activate_term(session, ctx.tenant_id, year_id, term_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="term.activated",
        resource_type="term",
        resource_id=term_id,
        metadata={"label": result.label, "term_number": result.term_number},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.get(
    "/academic-years/{year_id}/calendar-events",
    response_model=list[TermCalendarEventOut],
)
async def list_term_calendar_events(
    year_id: UUID,
    term_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_session),
) -> list[TermCalendarEventOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await term_calendar_service.list_year_events(
        session, ctx.tenant_id, year_id, term_id=term_id
    )


@router.post(
    "/academic-years/{year_id}/terms/{term_id}/calendar-events",
    response_model=TermCalendarEventOut,
    status_code=201,
)
async def create_term_calendar_event(
    year_id: UUID,
    term_id: UUID,
    body: TermCalendarEventCreate,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> TermCalendarEventOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await term_calendar_service.create_event(
        session, ctx.tenant_id, year_id, term_id, body
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="term_calendar_event.created",
        resource_type="term_calendar_event",
        resource_id=result.id,
        metadata={"title": result.title, "event_type": result.event_type},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch(
    "/academic-years/{year_id}/terms/{term_id}/calendar-events/{event_id}",
    response_model=TermCalendarEventOut,
)
async def update_term_calendar_event(
    year_id: UUID,
    term_id: UUID,
    event_id: UUID,
    body: TermCalendarEventUpdate,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> TermCalendarEventOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await term_calendar_service.update_event(
        session, ctx.tenant_id, year_id, term_id, event_id, body
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="term_calendar_event.updated",
        resource_type="term_calendar_event",
        resource_id=event_id,
        metadata=body.model_dump(mode="json", exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.delete(
    "/academic-years/{year_id}/terms/{term_id}/calendar-events/{event_id}",
    status_code=204,
    response_class=Response,
)
async def delete_term_calendar_event(
    year_id: UUID,
    term_id: UUID,
    event_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await term_calendar_service.delete_event(
        session, ctx.tenant_id, year_id, term_id, event_id
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="term_calendar_event.deleted",
        resource_type="term_calendar_event",
        resource_id=event_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return Response(status_code=204)
