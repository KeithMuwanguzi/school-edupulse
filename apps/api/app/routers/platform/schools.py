"""Platform-admin school management (§6.2)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import Principal, get_platform_session, require_platform_admin
from app.core.errors import NotFoundError, StaleVersionError
from app.models.enums import ActorType
from app.models.platform import Tenant
from app.models.school import School
from app.repositories.platform_schools import PlatformSchoolRepository
from app.schemas.common import CursorPage
from app.schemas.school import (
    ModulesReplace,
    OnboardRequest,
    OnboardResponse,
    PortalUser,
    SchoolCodeSuggestion,
    SchoolDetail,
    SchoolListItem,
    SchoolProfile,
    SchoolUpdate,
)
from app.schemas.tenant_user import PasswordResetResponse
from app.services import (
    cache_service,
    email_service,
    idempotency_service,
    onboarding_service,
    school_badge_service,
    school_code_service,
    subscription_service,
    tenant_user_service,
)
from app.services.audit_service import record_audit
from app.services.school_email_service import assert_school_email_available

router = APIRouter(prefix="/platform/schools", tags=["platform:schools"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _school_detail(session: AsyncSession, tenant: Tenant, school: School) -> SchoolDetail:
    modules = await subscription_service.get_active_module_keys(session, tenant.id)
    return SchoolDetail(
        tenant_id=tenant.id,
        school_id=school.id,
        school_code=tenant.school_code,
        status=tenant.status.value,
        modules=modules,
        created_at=school.created_at,
        profile=SchoolProfile(
            name=school.name,
            motto=school.motto,
            badge_url=school_badge_service.resolve_badge_url(tenant.id, school.badge_url),
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
            version=school.version,
        ),
    )


@router.get("", response_model=CursorPage[SchoolListItem])
async def list_schools(
    session: AsyncSession = Depends(get_platform_session),
    status: str | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> CursorPage[SchoolListItem]:
    repo = PlatformSchoolRepository(session)
    items, next_cursor = await repo.list_schools(status=status, cursor=cursor, limit=limit)
    return CursorPage[SchoolListItem](
        items=[
            SchoolListItem(
                tenant_id=i["tenant"].id,
                school_id=i["school"].id if i["school"] else None,
                school_code=i["tenant"].school_code,
                name=i["school"].name if i["school"] else i["tenant"].school_code,
                status=i["tenant"].status.value,
                ownership=i["school"].ownership.value if i["school"] else None,
                module_count=i["module_count"],
                created_at=i["tenant"].created_at,
            )
            for i in items
        ],
        next_cursor=next_cursor,
        has_more=next_cursor is not None,
    )


@router.get("/suggest-code", response_model=SchoolCodeSuggestion)
async def suggest_school_code(
    name: str = Query(min_length=2, max_length=255),
    session: AsyncSession = Depends(get_platform_session),
) -> SchoolCodeSuggestion:
    code, adjusted, note = await school_code_service.suggest_school_code(session, name)
    return SchoolCodeSuggestion(school_code=code, adjusted=adjusted, note=note)


@router.post("", status_code=201)
async def onboard(
    body: OnboardRequest,
    request: Request,
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    endpoint = "POST /platform/schools"
    payload = body.model_dump(mode="json")
    phash = idempotency_service.payload_hash(payload)
    if idempotency_key:
        cached = await idempotency_service.lookup(session, idempotency_key, endpoint, phash)
        if cached:
            return JSONResponse(cached["body"], status_code=cached["status"])

    result = await onboarding_service.onboard_school(
        session,
        body,
        actor_id=principal.user_id,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    out = result.model_dump(mode="json")
    if idempotency_key:
        await idempotency_service.store(
            session, idempotency_key, endpoint, phash, 201, out, result.tenant_id
        )
    await session.commit()
    await onboarding_service.warm_caches(result.school_code, result.tenant_id, result.modules)

    recipient = str(body.email).strip()
    if recipient:
        await email_service.send_portal_credentials(
            to=recipient,
            school_name=body.name,
            username=result.admin_user.username,
            password=body.admin_user.password,
            intro=(
                f"Welcome to SkulPulse. Your school portal for {body.name} has been "
                "provisioned with the credentials below."
            ),
        )

    return JSONResponse(out, status_code=201)


@router.get("/{tenant_id}", response_model=SchoolDetail)
async def get_school(
    tenant_id: UUID,
    session: AsyncSession = Depends(get_platform_session),
) -> SchoolDetail:
    repo = PlatformSchoolRepository(session)
    found = await repo.get_detail(tenant_id)
    if found is None or found[1] is None:
        raise NotFoundError("School not found.")
    return await _school_detail(session, found[0], found[1])


@router.patch("/{tenant_id}", response_model=SchoolDetail)
async def update_school(
    tenant_id: UUID,
    body: SchoolUpdate,
    request: Request,
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> JSONResponse:
    endpoint = f"PATCH /platform/schools/{tenant_id}"
    payload = body.model_dump(mode="json", exclude_none=True)
    phash = idempotency_service.payload_hash(payload)
    if idempotency_key:
        cached = await idempotency_service.lookup(session, idempotency_key, endpoint, phash)
        if cached:
            return JSONResponse(cached["body"], status_code=cached["status"])

    repo = PlatformSchoolRepository(session)
    found = await repo.get_detail(tenant_id)
    if found is None or found[1] is None:
        raise NotFoundError("School not found.")
    tenant, school = found

    if body.version is not None and body.version != school.version:
        raise StaleVersionError("This school was modified by someone else. Reload and retry.")

    changes = body.model_dump(exclude_none=True, exclude={"version", "status"})
    if "email" in changes and changes["email"] is not None:
        changes["email"] = await assert_school_email_available(
            session, changes["email"], exclude_school_id=school.id
        )
    before = {k: getattr(school, k) for k in changes}
    for field, value in changes.items():
        setattr(school, field, value)
    if changes:
        school.version += 1
    if body.status is not None:
        tenant.status = body.status

    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=principal.user_id,
        tenant_id=tenant.id,
        action="school.updated",
        resource_type="school",
        resource_id=school.id,
        metadata={"fields": list(changes.keys()), "status": body.status.value if body.status else None},
        ip_address=_client_ip(request),
    )

    detail = await _school_detail(session, tenant, school)
    out = detail.model_dump(mode="json")
    if idempotency_key:
        await idempotency_service.store(
            session, idempotency_key, endpoint, phash, 200, out, tenant.id
        )
    await session.commit()
    await cache_service.invalidate_profile(tenant.id)
    return JSONResponse(out, status_code=200)


@router.put("/{tenant_id}/modules", response_model=SchoolDetail)
async def replace_modules(
    tenant_id: UUID,
    body: ModulesReplace,
    request: Request,
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> JSONResponse:
    endpoint = f"PUT /platform/schools/{tenant_id}/modules"
    payload = body.model_dump(mode="json")
    phash = idempotency_service.payload_hash(payload)
    if idempotency_key:
        cached = await idempotency_service.lookup(session, idempotency_key, endpoint, phash)
        if cached:
            return JSONResponse(cached["body"], status_code=cached["status"])

    repo = PlatformSchoolRepository(session)
    found = await repo.get_detail(tenant_id)
    if found is None or found[1] is None:
        raise NotFoundError("School not found.")
    tenant, school = found

    await subscription_service.replace_modules(
        session, tenant_id, body.module_keys, actor_id=principal.user_id,
        idempotency_key=idempotency_key,
    )
    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=principal.user_id,
        tenant_id=tenant_id,
        action="modules.updated",
        resource_type="tenant",
        resource_id=tenant_id,
        metadata={"modules": body.module_keys},
        ip_address=_client_ip(request),
    )
    detail = await _school_detail(session, tenant, school)
    out = detail.model_dump(mode="json")
    if idempotency_key:
        await idempotency_service.store(
            session, idempotency_key, endpoint, phash, 200, out, tenant_id
        )
    await session.commit()
    return JSONResponse(out, status_code=200)


@router.post("/{tenant_id}/badge", response_model=SchoolDetail)
async def upload_school_badge(
    tenant_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
) -> SchoolDetail:
    repo = PlatformSchoolRepository(session)
    found = await repo.get_detail(tenant_id)
    if found is None or found[1] is None:
        raise NotFoundError("School not found.")
    tenant, school = found

    await school_badge_service.save_badge(session, tenant_id, file)
    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=principal.user_id,
        tenant_id=tenant.id,
        action="school.badge_updated",
        resource_type="school",
        resource_id=school.id,
        metadata={},
        ip_address=_client_ip(request),
    )
    await session.commit()
    await cache_service.invalidate_profile(tenant.id)
    return await _school_detail(session, tenant, school)


@router.delete("/{tenant_id}/badge", response_model=SchoolDetail)
async def delete_school_badge(
    tenant_id: UUID,
    request: Request,
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
) -> SchoolDetail:
    repo = PlatformSchoolRepository(session)
    found = await repo.get_detail(tenant_id)
    if found is None or found[1] is None:
        raise NotFoundError("School not found.")
    tenant, school = found

    await school_badge_service.remove_badge(session, tenant_id)
    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=principal.user_id,
        tenant_id=tenant.id,
        action="school.badge_removed",
        resource_type="school",
        resource_id=school.id,
        metadata={},
        ip_address=_client_ip(request),
    )
    await session.commit()
    await cache_service.invalidate_profile(tenant.id)
    return await _school_detail(session, tenant, school)


@router.get("/{tenant_id}/users", response_model=list[PortalUser])
async def list_users(
    tenant_id: UUID,
    session: AsyncSession = Depends(get_platform_session),
) -> list[PortalUser]:
    repo = PlatformSchoolRepository(session)
    found = await repo.get_detail(tenant_id)
    if found is None:
        raise NotFoundError("School not found.")
    tenant = found[0]
    users = await repo.get_users(tenant_id)
    return [
        PortalUser(
            id=u.id,
            login_id=u.login_id,
            username=f"{u.login_id}@{tenant.school_code}",
            name=u.name,
            role=role_key,
            status=u.status.value,
            email=u.email,
            last_login_at=u.last_login_at,
        )
        for (u, role_key) in users
    ]


@router.post(
    "/{tenant_id}/users/{user_id}/password-reset",
    response_model=PasswordResetResponse,
)
async def reset_user_password(
    tenant_id: UUID,
    user_id: UUID,
    request: Request,
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
) -> PasswordResetResponse:
    repo = PlatformSchoolRepository(session)
    found = await repo.get_detail(tenant_id)
    if found is None or found[1] is None:
        raise NotFoundError("School not found.")
    _tenant, school = found

    result = await tenant_user_service.reset_user_password(
        session,
        tenant_id,
        user_id,
        school_name=school.name,
        reset_by="SkulPulse platform administrator",
    )
    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=principal.user_id,
        tenant_id=tenant_id,
        action="user.password_reset",
        resource_type="tenant_user",
        resource_id=user_id,
        metadata={"via": "platform"},
        ip_address=_client_ip(request),
    )
    await session.commit()
    return result


@router.post(
    "/{tenant_id}/admin/reset-credentials",
    response_model=PasswordResetResponse,
)
async def reset_admin_credentials(
    tenant_id: UUID,
    request: Request,
    principal: Principal = Depends(require_platform_admin),
    session: AsyncSession = Depends(get_platform_session),
) -> PasswordResetResponse:
    from sqlalchemy import select

    from app.models.user import Role, TenantUser

    repo = PlatformSchoolRepository(session)
    found = await repo.get_detail(tenant_id)
    if found is None or found[1] is None:
        raise NotFoundError("School not found.")
    tenant, school = found

    admin_row = await session.execute(
        select(TenantUser, Role.role_key)
        .join(Role, Role.id == TenantUser.role_id)
        .where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
            Role.role_key == "school_admin",
        )
        .order_by(TenantUser.created_at)
        .limit(1)
    )
    row = admin_row.first()
    if row is None:
        raise NotFoundError("School administrator account not found.")
    admin, _ = row

    result = await tenant_user_service.reset_user_password(
        session,
        tenant_id,
        admin.id,
        school_name=school.name,
        reset_by="SkulPulse platform administrator",
        notify=False,
    )
    temp = result.temporary_password
    if temp is None:
        raise NotFoundError("Password reset failed.")

    recipient = (school.email or admin.email or "").strip()
    email_sent = False
    if recipient:
        email_sent = await email_service.send_portal_credentials(
            to=recipient,
            school_name=school.name,
            username=f"{admin.login_id}@{tenant.school_code}",
            password=temp,
            intro=(
                f"Your SkulPulse administrator credentials for {school.name} have been "
                "reset. Sign in with the details below and choose a new password."
            ),
        )

    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=principal.user_id,
        tenant_id=tenant_id,
        action="school.admin_credentials_reset",
        resource_type="tenant_user",
        resource_id=admin.id,
        metadata={"email_sent": email_sent, "recipient": recipient or None},
        ip_address=_client_ip(request),
    )
    await session.commit()

    if email_sent:
        return PasswordResetResponse(
            message=f"New administrator credentials emailed to {recipient}.",
            temporary_password=None,
            email_sent=True,
            email_recipient=recipient,
        )
    return PasswordResetResponse(
        message=(
            "No school email on file — share this temporary password securely. "
            "The administrator must change it after signing in."
        ),
        temporary_password=temp,
        email_sent=False,
        email_recipient=None,
    )
