"""Tenant teachers & assignments — Phase 2 §6 (`teachers` module gate)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.models.enums import ActorType
from app.schemas.teacher import (
    TeacherAssignmentCreate,
    TeacherAssignmentOut,
    TeacherAssignmentUpdate,
    TeacherStaffOut,
)
from app.services import teacher_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:teachers"])

_teachers = require_module("teachers")
_admin = require_role("school_admin")


@router.get("/teachers/staff", response_model=list[TeacherStaffOut])
async def list_staff(
    academic_year_id: UUID | None = Query(default=None),
    term_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(_teachers),
    session: AsyncSession = Depends(get_session),
) -> list[TeacherStaffOut]:
    return await teacher_service.list_staff(
        session,
        ctx.tenant_id,
        academic_year_id=academic_year_id,
        term_id=term_id,
    )


@router.get("/teachers/assignments", response_model=list[TeacherAssignmentOut])
async def list_assignments(
    teacher_user_id: UUID | None = Query(default=None),
    class_id: UUID | None = Query(default=None),
    academic_year_id: UUID | None = Query(default=None),
    term_id: UUID | None = Query(default=None),
    ctx: TenantContext = Depends(_teachers),
    session: AsyncSession = Depends(get_session),
) -> list[TeacherAssignmentOut]:
    return await teacher_service.list_assignments(
        session,
        ctx.tenant_id,
        teacher_user_id=teacher_user_id,
        class_id=class_id,
        academic_year_id=academic_year_id,
        term_id=term_id,
    )


@router.post("/teachers/assignments", response_model=TeacherAssignmentOut, status_code=201)
async def create_assignment(
    body: TeacherAssignmentCreate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_teachers),
    session: AsyncSession = Depends(get_session),
) -> TeacherAssignmentOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await teacher_service.create_assignment(session, ctx.tenant_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="teacher.assignment.created",
        resource_type="teacher_assignment",
        resource_id=result.id,
        metadata={
            "teacher_user_id": str(result.teacher_user_id),
            "class_level": result.class_level,
            "subject_code": result.subject_code,
        },
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/teachers/assignments/{assignment_id}", response_model=TeacherAssignmentOut)
async def update_assignment(
    assignment_id: UUID,
    body: TeacherAssignmentUpdate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_teachers),
    session: AsyncSession = Depends(get_session),
) -> TeacherAssignmentOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await teacher_service.update_assignment(
        session, ctx.tenant_id, assignment_id, body
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="teacher.assignment.updated",
        resource_type="teacher_assignment",
        resource_id=assignment_id,
        metadata=body.model_dump(mode="json", exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.delete("/teachers/assignments/{assignment_id}", status_code=204, response_class=Response)
async def delete_assignment(
    assignment_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_teachers),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await teacher_service.delete_assignment(session, ctx.tenant_id, assignment_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="teacher.assignment.deleted",
        resource_type="teacher_assignment",
        resource_id=assignment_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return Response(status_code=204)
