"""Grading configuration — scales by NCDC section, subject assignments."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_role
from app.schemas.grading import (
    AggregateDivisionCreate,
    AggregateDivisionOut,
    AggregateDivisionUpdate,
    GradeRangeCreate,
    GradeRangeOut,
    GradeRangeUpdate,
    GradingConfigOut,
    GradingScaleCreate,
    GradingScaleOut,
    GradingScaleUpdate,
    SubjectGradingOut,
    SubjectGradingScaleUpdate,
)
from app.services import grading_config_service

router = APIRouter(prefix="/tenant", tags=["tenant:grading"])

_admin = require_role("school_admin")


@router.get("/grading/config", response_model=GradingConfigOut)
async def get_grading_config(
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> GradingConfigOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await grading_config_service.get_config(session, ctx.tenant_id)


@router.post("/grading/scales", response_model=GradingScaleOut, status_code=201)
async def create_grading_scale(
    body: GradingScaleCreate,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> GradingScaleOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await grading_config_service.create_scale(session, ctx.tenant_id, body)
    await session.commit()
    return out


@router.patch("/grading/scales/{scale_id}", response_model=GradingScaleOut)
async def update_grading_scale(
    scale_id: UUID,
    body: GradingScaleUpdate,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> GradingScaleOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await grading_config_service.update_scale(session, ctx.tenant_id, scale_id, body)
    await session.commit()
    return out


@router.delete("/grading/scales/{scale_id}", status_code=204, response_class=Response)
async def delete_grading_scale(
    scale_id: UUID,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await grading_config_service.delete_scale(session, ctx.tenant_id, scale_id)
    await session.commit()
    return Response(status_code=204)


@router.post(
    "/grading/scales/{scale_id}/ranges",
    response_model=GradeRangeOut,
    status_code=201,
)
async def create_grade_range(
    scale_id: UUID,
    body: GradeRangeCreate,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> GradeRangeOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await grading_config_service.create_range(session, ctx.tenant_id, scale_id, body)
    await session.commit()
    return out


@router.patch(
    "/grading/scales/{scale_id}/ranges/{range_id}",
    response_model=GradeRangeOut,
)
async def update_grade_range(
    scale_id: UUID,
    range_id: UUID,
    body: GradeRangeUpdate,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> GradeRangeOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await grading_config_service.update_range(
        session, ctx.tenant_id, scale_id, range_id, body
    )
    await session.commit()
    return out


@router.delete(
    "/grading/scales/{scale_id}/ranges/{range_id}",
    status_code=204,
    response_class=Response,
)
async def delete_grade_range(
    scale_id: UUID,
    range_id: UUID,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await grading_config_service.delete_range(session, ctx.tenant_id, scale_id, range_id)
    await session.commit()
    return Response(status_code=204)


@router.patch("/grading/subjects/{subject_id}/scale", response_model=SubjectGradingOut)
async def assign_subject_grading_scale(
    subject_id: UUID,
    body: SubjectGradingScaleUpdate,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> SubjectGradingOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await grading_config_service.assign_subject_scale(
        session, ctx.tenant_id, subject_id, body
    )
    await session.commit()
    return out


@router.post("/grading/aggregate-divisions", response_model=AggregateDivisionOut, status_code=201)
async def create_aggregate_division(
    body: AggregateDivisionCreate,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> AggregateDivisionOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await grading_config_service.create_aggregate_division(session, ctx.tenant_id, body)
    await session.commit()
    return out


@router.patch(
    "/grading/aggregate-divisions/{division_id}",
    response_model=AggregateDivisionOut,
)
async def update_aggregate_division(
    division_id: UUID,
    body: AggregateDivisionUpdate,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> AggregateDivisionOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await grading_config_service.update_aggregate_division(
        session, ctx.tenant_id, division_id, body
    )
    await session.commit()
    return out


@router.delete(
    "/grading/aggregate-divisions/{division_id}",
    status_code=204,
    response_class=Response,
)
async def delete_aggregate_division(
    division_id: UUID,
    ctx: TenantContext = Depends(_admin),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await grading_config_service.delete_aggregate_division(session, ctx.tenant_id, division_id)
    await session.commit()
    return Response(status_code=204)
