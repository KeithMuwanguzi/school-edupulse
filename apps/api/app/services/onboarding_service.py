"""School onboarding — single atomic transaction (§4.1 onboarding flow, §6.2).

Creates tenant → school → admin user → subscriptions → academic year + terms →
audit log. The caller (route) owns the commit. Caches are warmed after commit.
"""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DuplicateEmisError, DuplicateSchoolCodeError, ValidationError
from app.models.enums import ActorType
from app.models.platform import Tenant
from app.models.school import School
from app.models.user import Role, TenantUser
from app.schemas.school import (
    AcademicYearOut,
    OnboardedAdmin,
    OnboardRequest,
    OnboardResponse,
    TermOut,
)
from app.core.security import hash_password
from app.services import cache_service
from app.services.academic_service import seed_calendar
from app.services.audit_service import record_audit
from app.services.school_email_service import assert_school_email_available
from app.services.subscription_service import create_initial_subscriptions


async def onboard_school(
    session: AsyncSession,
    data: OnboardRequest,
    actor_id: UUID,
    ip: str | None = None,
    user_agent: str | None = None,
    today: dt.date | None = None,
) -> OnboardResponse:
    today = today or dt.date.today()

    # Uniqueness pre-checks (DB constraints are the backstop).
    if await session.scalar(select(Tenant.id).where(Tenant.school_code == data.school_code)):
        raise DuplicateSchoolCodeError(f"School code '{data.school_code}' is already taken.")
    if data.emis_number and await session.scalar(
        select(School.id).where(School.emis_number == data.emis_number)
    ):
        raise DuplicateEmisError(f"EMIS number '{data.emis_number}' is already registered.")

    school_email = await assert_school_email_available(session, str(data.email))

    role = await session.scalar(select(Role).where(Role.role_key == "school_admin"))
    if role is None:
        raise ValidationError("school_admin role is not seeded.")

    # 1) tenant
    tenant = Tenant(school_code=data.school_code, status=data.status)
    session.add(tenant)
    await session.flush()

    # 2) school profile
    school = School(
        tenant_id=tenant.id,
        name=data.name,
        motto=data.motto,
        ownership=data.ownership,
        emis_number=data.emis_number,
        license_number=data.license_number,
        registration_status=data.registration_status,
        boarding_status=data.boarding_status,
        sex_composition=data.sex_composition,
        is_upe=data.is_upe,
        district_id=data.district_id,
        county_id=data.county_id,
        sub_county_id=data.sub_county_id,
        parish_id=data.parish_id,
        address_line=data.address_line,
        phone=data.phone,
        email=school_email,
        head_teacher_name=data.head_teacher_name,
        contact_person_name=data.contact_person_name,
        contact_person_phone=data.contact_person_phone,
        contact_person_nin=data.contact_person_nin,
    )
    session.add(school)
    await session.flush()

    # 3) default admin user
    admin = TenantUser(
        tenant_id=tenant.id,
        role_id=role.id,
        login_id=data.admin_user.login_id,
        email=school_email,
        password_hash=hash_password(data.admin_user.password),
        name=data.admin_user.name,
        must_change_password=True,
    )
    session.add(admin)
    await session.flush()

    # 4) module subscriptions
    module_keys = await create_initial_subscriptions(session, tenant.id, data.module_keys)

    # 5) academic year + terms
    academic_year, active_term = await seed_calendar(session, tenant.id, today.year, today)

    # 6) audit
    await record_audit(
        session,
        actor_type=ActorType.platform_admin,
        actor_id=actor_id,
        tenant_id=tenant.id,
        action="school.onboarded",
        resource_type="tenant",
        resource_id=tenant.id,
        metadata={"school_code": data.school_code, "modules": module_keys},
        ip_address=ip,
        user_agent=user_agent,
    )

    return OnboardResponse(
        tenant_id=tenant.id,
        school_id=school.id,
        school_code=tenant.school_code,
        name=school.name,
        status=tenant.status.value,
        admin_user=OnboardedAdmin(
            id=admin.id,
            username=f"{admin.login_id}@{tenant.school_code}",
            login_id=admin.login_id,
        ),
        modules=module_keys,
        academic_year=AcademicYearOut(
            id=academic_year.id,
            label=academic_year.label,
            status=academic_year.status.value,
            starts_on=academic_year.starts_on,
            ends_on=academic_year.ends_on,
        ),
        active_term=(
            TermOut(
                id=active_term.id,
                term_number=active_term.term_number,
                label=active_term.label,
                status=active_term.status.value,
                starts_on=active_term.starts_on,
                ends_on=active_term.ends_on,
            )
            if active_term
            else None
        ),
    )


async def warm_caches(school_code: str, tenant_id: UUID, module_keys: list[str]) -> None:
    """Warm Redis after commit (§4.1 step 4)."""
    await cache_service.set_cached_tenant_id(school_code, tenant_id)
    await cache_service.set_cached_modules(tenant_id, module_keys)
