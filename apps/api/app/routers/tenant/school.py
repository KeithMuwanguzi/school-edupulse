"""Tenant self-service: school profile + academic context (§6.3)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import get_tenant_context, require_role
from app.core.errors import ConflictError, NotFoundError, StaleVersionError
from app.models.enums import ActorType
from app.models.platform import Tenant
from app.models.school import School
from app.schemas.academic import AcademicContextEnriched
from app.schemas.school import (
    SchoolDetail,
    SchoolProfile,
    SchoolUpdate,
)
from app.services import academic_service, cache_service, school_badge_service, subscription_service
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tenant", tags=["tenant:school"])


async def _build_detail(session: AsyncSession, tenant_id) -> SchoolDetail:
    # Self-sufficient: a SET LOCAL GUC is reset on commit, so callers that build
    # a detail AFTER committing would otherwise lose RLS scope.
    await apply_tenant_guc(session, tenant_id)
    school = await session.scalar(select(School).where(School.tenant_id == tenant_id))
    if school is None:
        raise NotFoundError("School profile not found.")
    tenant = await session.get(Tenant, tenant_id)
    modules = await subscription_service.get_active_module_keys(session, tenant_id)
    return SchoolDetail(
        tenant_id=tenant_id,
        school_id=school.id,
        school_code=tenant.school_code,
        status=tenant.status.value,
        modules=modules,
        created_at=school.created_at,
        profile=SchoolProfile(
            name=school.name,
            motto=school.motto,
            badge_url=school_badge_service.resolve_badge_url(tenant_id, school.badge_url),
            ownership=school.ownership.value,
            emis_number=school.emis_number,
            license_number=school.license_number,
            registration_status=school.registration_status.value,
            boarding_status=school.boarding_status.value,
            sex_composition=school.sex_composition.value,
            is_upe=school.is_upe,
            district_id=school.district_id,
            county_id=school.county_id,
            sub_county_id=school.sub_county_id,
            parish_id=school.parish_id,
            address_line=school.address_line,
            phone=school.phone,
            email=school.email,
            head_teacher_name=school.head_teacher_name,
            contact_person_name=school.contact_person_name,
            contact_person_phone=school.contact_person_phone,
            contact_person_nin=school.contact_person_nin,
            timezone=school.timezone,
            currency=school.currency,
            locale=school.locale,
            student_number_prefix=school.student_number_prefix,
            report_footer_notes=school.report_footer_notes,
            report_next_term_note=school.report_next_term_note,
            version=school.version,
        ),
    )


@router.get("/school", response_model=SchoolDetail)
async def get_school(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_session),
) -> SchoolDetail:
    return await _build_detail(session, ctx.tenant_id)


@router.patch("/school", response_model=SchoolDetail)
async def update_school(
    body: SchoolUpdate,
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> SchoolDetail:
    await apply_tenant_guc(session, ctx.tenant_id)
    school = await session.scalar(select(School).where(School.tenant_id == ctx.tenant_id))
    if school is None:
        raise NotFoundError("School profile not found.")

    if body.version is not None and body.version != school.version:
        raise StaleVersionError("This profile was modified by someone else. Reload and retry.")

    # Tenants cannot change their own status, school_code or emis_number here.
    changes = body.model_dump(exclude_none=True, exclude={"version", "status"})
    for field, value in changes.items():
        setattr(school, field, value)
    if changes:
        school.version += 1

    if "student_number_prefix" in changes:
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            raise ConflictError(
                "That student-number prefix is already used by another school."
            ) from exc

    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="school.updated",
        resource_type="school",
        resource_id=school.id,
        metadata={"fields": list(changes.keys())},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    await cache_service.invalidate_profile(ctx.tenant_id)
    return await _build_detail(session, ctx.tenant_id)


@router.post("/school/badge", response_model=SchoolDetail)
async def upload_school_badge(
    request: Request,
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> SchoolDetail:
    await apply_tenant_guc(session, ctx.tenant_id)
    school = await session.scalar(select(School).where(School.tenant_id == ctx.tenant_id))
    if school is None:
        raise NotFoundError("School profile not found.")

    await school_badge_service.save_badge(session, ctx.tenant_id, file)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="school.badge_updated",
        resource_type="school",
        resource_id=school.id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    await cache_service.invalidate_profile(ctx.tenant_id)
    return await _build_detail(session, ctx.tenant_id)


@router.delete("/school/badge", response_model=SchoolDetail)
async def delete_school_badge(
    request: Request,
    ctx: TenantContext = Depends(require_role("school_admin")),
    session: AsyncSession = Depends(get_session),
) -> SchoolDetail:
    await apply_tenant_guc(session, ctx.tenant_id)
    school = await session.scalar(select(School).where(School.tenant_id == ctx.tenant_id))
    if school is None:
        raise NotFoundError("School profile not found.")

    await school_badge_service.remove_badge(session, ctx.tenant_id)
    await record_audit(
        session,
        actor_type=ActorType.tenant_user,
        actor_id=ctx.user_id,
        tenant_id=ctx.tenant_id,
        action="school.badge_removed",
        resource_type="school",
        resource_id=school.id,
        metadata={},
        ip_address=request.client.host if request.client else None,
    )
    await session.commit()
    await cache_service.invalidate_profile(ctx.tenant_id)
    return await _build_detail(session, ctx.tenant_id)


@router.get("/academic-context", response_model=AcademicContextEnriched)
async def academic_context(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_session),
) -> AcademicContextEnriched:
    return await academic_service.get_context(session, ctx.tenant_id)
