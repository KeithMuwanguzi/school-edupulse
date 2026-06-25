"""P7 PLE candidacy — Phase 2 §11 (`assessment` module gate)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.models.enums import ActorType
from app.schemas.ple import (
    PleCandidateNominate,
    PleCandidateOut,
    PleCandidateUpdate,
    PleCandidacySummaryOut,
    PleEligibleStudentOut,
)
from app.services import ple_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:ple"])

_assessment = require_module("assessment")
_staff = require_role("school_admin", "deputy_head")
_read = require_role("school_admin", "deputy_head", "teacher")


@router.get("/ple/summary", response_model=PleCandidacySummaryOut)
async def ple_summary(
    academic_year_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(_read),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> PleCandidacySummaryOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await ple_service.summary(
        session, ctx.tenant_id, academic_year_id=academic_year_id
    )


@router.get("/ple/candidates", response_model=list[PleCandidateOut])
async def list_candidates(
    academic_year_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    ctx: TenantContext = Depends(_read),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> list[PleCandidateOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await ple_service.list_candidates(
        session,
        ctx.tenant_id,
        academic_year_id=academic_year_id,
        status=status,
    )


@router.get("/ple/eligible", response_model=list[PleEligibleStudentOut])
async def list_eligible(
    academic_year_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(_read),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> list[PleEligibleStudentOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await ple_service.list_eligible(
        session, ctx.tenant_id, academic_year_id=academic_year_id
    )


@router.post("/ple/candidates", response_model=list[PleCandidateOut], status_code=201)
async def nominate_candidates(
    body: PleCandidateNominate,
    request: Request,
    academic_year_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> list[PleCandidateOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await ple_service.nominate(
        session,
        ctx.tenant_id,
        body,
        academic_year_id=academic_year_id,
        nominated_by_user_id=ctx.user_id,
    )
    await record_audit(
        session,
        tenant_id=ctx.tenant_id,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        action="ple.nominate",
        resource_type="ple_candidate",
        resource_id=None,
        metadata={"count": len(result), "student_ids": [str(r.student_id) for r in result]},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/ple/candidates/{candidate_id}", response_model=PleCandidateOut)
async def update_candidate(
    candidate_id: UUID,
    body: PleCandidateUpdate,
    request: Request,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_assessment),
    session: AsyncSession = Depends(get_session),
) -> PleCandidateOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await ple_service.update_candidate(
        session, ctx.tenant_id, candidate_id, body
    )
    await record_audit(
        session,
        tenant_id=ctx.tenant_id,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        action="ple.update",
        resource_type="ple_candidate",
        resource_id=candidate_id,
        metadata={"status": result.status},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result
