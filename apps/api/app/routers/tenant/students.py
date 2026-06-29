"""Tenant student enrollment — Phase 2 §5 (`students` module gate)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.models.enums import ActorType
from app.schemas.common import CursorPage
from app.schemas.student import (
    BulkAssignRequest,
    BulkAssignResponse,
    DisciplineCreate,
    DisciplineOut,
    DisciplineUpdate,
    GuardianInput,
    GuardianOut,
    GuardianUpdate,
    HealthInput,
    HealthOut,
    RosterSummaryOut,
    StudentCreate,
    StudentDetailOut,
    StudentImportRequest,
    StudentImportResponse,
    StudentOut,
    StudentUpdate,
)
from app.services import student_import_service, student_profile_service, student_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:students"])

_students = require_module("students")
_admin = require_role("school_admin")


@router.post("/students/import", response_model=StudentImportResponse)
async def import_students(
    body: StudentImportRequest,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> StudentImportResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await student_import_service.import_students(session, ctx.tenant_id, body)
    if not body.dry_run and result.created:
        await record_audit(
            session,
            actor_type=ActorType.tenant_user,
            actor_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            action="students.import",
            resource_type="student",
            resource_id=None,
            metadata={
                "created": result.created,
                "skipped": result.skipped,
                "failed": result.failed,
            },
            ip_address=request.client.host if request.client else None,
        )
    if not body.dry_run:
        await session.commit()
    return result


@router.post("/students/bulk-assign", response_model=BulkAssignResponse)
async def bulk_assign_students(
    body: BulkAssignRequest,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> BulkAssignResponse:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await student_service.bulk_assign_students(
        session,
        ctx.tenant_id,
        student_ids=body.student_ids,
        class_id=body.class_id,
        stream_id=body.stream_id,
        clear_class=body.clear_class,
    )
    if result.updated:
        await record_audit(
            session,
            actor_type=ActorType.tenant_user,
            actor_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            action="students.bulk_assign",
            resource_type="student",
            resource_id=None,
            metadata={"updated": result.updated, "failed": result.failed},
            ip_address=request.client.host if request.client else None,
        )
    await session.commit()
    return result


@router.get("/students/roster-summary", response_model=RosterSummaryOut)
async def roster_summary(
    ctx: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> RosterSummaryOut:
    return await student_service.get_roster_summary(
        session, ctx.tenant_id, role=ctx.role, user_id=ctx.user_id
    )


@router.get("/students", response_model=CursorPage[StudentOut])
async def list_students(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=15, ge=1, le=100),
    class_id: UUID | None = Query(default=None),
    stream_id: UUID | None = Query(default=None),
    unassigned: bool = Query(default=False),
    q: str | None = Query(default=None, max_length=120),
    ctx: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> CursorPage[StudentOut]:
    return await student_service.list_students(
        session,
        ctx.tenant_id,
        cursor=cursor,
        limit=limit,
        class_id=class_id,
        stream_id=stream_id,
        unassigned=unassigned,
        q=q,
        role=ctx.role,
        user_id=ctx.user_id,
    )


@router.get("/students/discipline", response_model=list[DisciplineOut])
async def list_discipline_school_wide(
    status: str | None = Query(default=None),
    ctx: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> list[DisciplineOut]:
    return await student_profile_service.list_discipline(
        session, ctx.tenant_id, status=status
    )


@router.get("/students/{student_id}", response_model=StudentOut)
async def get_student(
    student_id: UUID,
    ctx: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> StudentOut:
    return await student_service.get_student(
        session, ctx.tenant_id, student_id, role=ctx.role, user_id=ctx.user_id
    )


@router.get("/students/{student_id}/detail", response_model=StudentDetailOut)
async def get_student_detail(
    student_id: UUID,
    ctx: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> StudentDetailOut:
    return await student_service.get_student_detail(
        session, ctx.tenant_id, student_id, role=ctx.role, user_id=ctx.user_id
    )


@router.post("/students", response_model=StudentOut, status_code=201)
async def create_student(
    body: StudentCreate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> StudentOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await student_service.create_student(session, ctx.tenant_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="student.enrolled",
        resource_type="student",
        resource_id=result.id,
        metadata={"student_number": result.student_number, "class_id": str(result.class_id)},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/students/{student_id}", response_model=StudentOut)
async def update_student(
    student_id: UUID,
    body: StudentUpdate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> StudentOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await student_service.update_student(session, ctx.tenant_id, student_id, body)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="student.updated",
        resource_type="student",
        resource_id=student_id,
        metadata=body.model_dump(mode="json", exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.delete("/students/{student_id}", status_code=204, response_class=Response)
async def delete_student(
    student_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await student_service.delete_student(session, ctx.tenant_id, student_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="student.deleted",
        resource_type="student",
        resource_id=student_id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return Response(status_code=204)


# --- Guardians -------------------------------------------------------------


@router.get("/students/{student_id}/guardians", response_model=list[GuardianOut])
async def list_guardians(
    student_id: UUID,
    ctx: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> list[GuardianOut]:
    return await student_profile_service.list_guardians(session, ctx.tenant_id, student_id)


@router.post("/students/{student_id}/guardians", response_model=GuardianOut, status_code=201)
async def add_guardian(
    student_id: UUID,
    body: GuardianInput,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> GuardianOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await student_profile_service.add_guardian(session, ctx.tenant_id, student_id, body)
    await session.commit()
    return result


@router.patch("/students/guardians/{guardian_id}", response_model=GuardianOut)
async def update_guardian(
    guardian_id: UUID,
    body: GuardianUpdate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> GuardianOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await student_profile_service.update_guardian(
        session, ctx.tenant_id, guardian_id, body
    )
    await session.commit()
    return result


@router.delete("/students/guardians/{guardian_id}", status_code=204, response_class=Response)
async def delete_guardian(
    guardian_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await student_profile_service.delete_guardian(session, ctx.tenant_id, guardian_id)
    await session.commit()
    return Response(status_code=204)


# --- Health ----------------------------------------------------------------


@router.get("/students/{student_id}/health", response_model=HealthOut | None)
async def get_health(
    student_id: UUID,
    ctx: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> HealthOut | None:
    return await student_profile_service.get_health(session, ctx.tenant_id, student_id)


@router.put("/students/{student_id}/health", response_model=HealthOut)
async def upsert_health(
    student_id: UUID,
    body: HealthInput,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> HealthOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await student_profile_service.upsert_health(session, ctx.tenant_id, student_id, body)
    await session.commit()
    return result


# --- Discipline ------------------------------------------------------------


@router.get("/students/{student_id}/discipline", response_model=list[DisciplineOut])
async def list_student_discipline(
    student_id: UUID,
    ctx: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> list[DisciplineOut]:
    return await student_profile_service.list_discipline(
        session, ctx.tenant_id, student_id=student_id
    )


@router.post("/students/{student_id}/discipline", response_model=DisciplineOut, status_code=201)
async def add_discipline(
    student_id: UUID,
    body: DisciplineCreate,
    request: Request,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> DisciplineOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await student_profile_service.add_discipline(
        session, ctx.tenant_id, student_id, body, recorded_by=ctx.user_id
    )
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="student.discipline.created",
        resource_type="student_discipline_record",
        resource_id=result.id,
        metadata={"student_id": str(student_id), "category": result.category},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    return result


@router.patch("/students/discipline/{record_id}", response_model=DisciplineOut)
async def update_discipline(
    record_id: UUID,
    body: DisciplineUpdate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> DisciplineOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    result = await student_profile_service.update_discipline(
        session, ctx.tenant_id, record_id, body
    )
    await session.commit()
    return result


@router.delete("/students/discipline/{record_id}", status_code=204, response_class=Response)
async def delete_discipline(
    record_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_students),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    await student_profile_service.delete_discipline(session, ctx.tenant_id, record_id)
    await session.commit()
    return Response(status_code=204)
