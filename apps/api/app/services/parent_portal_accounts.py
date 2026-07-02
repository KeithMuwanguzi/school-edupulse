"""Parent portal accounts — one shared login per pupil (login_id = student_number).

Guardian contact records (StudentGuardian) are always available with the Students
module. Portal credentials and parent login require the ``parents_portal`` module.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError
from app.core.security import hash_password
from app.models.enums import UserStatus
from app.models.school import School
from app.models.student import Student, StudentGuardian
from app.models.user import Role, TenantUser
from app.schemas.student import ParentPortalAccountOut
from app.services import email_service, subscription_service
from app.services.tenant_user_service import _school_code, _temp_password

PARENTS_PORTAL_MODULE = "parents_portal"


class ParentPortalNotSubscribedError(ForbiddenError):
    code = "PARENT_PORTAL_NOT_SUBSCRIBED"
    title = "Parent Portal not subscribed"

    def __init__(self) -> None:
        super().__init__(
            detail=(
                "The Parent Portal module is not active for this school "
                "(UGX 1,350,000 per term). Subscribe under Settings → Modules "
                "to create guardian logins."
            ),
            extra={"module": PARENTS_PORTAL_MODULE},
        )


class ParentPortalUnavailableError(ForbiddenError):
    code = "PARENT_PORTAL_UNAVAILABLE"
    title = "Parent portal unavailable"

    def __init__(self) -> None:
        super().__init__(
            detail=(
                "The parent portal is not available for this school. "
                "Contact the school office for assistance."
            ),
            extra={"module": PARENTS_PORTAL_MODULE},
        )


async def tenant_has_parents_portal(session: AsyncSession, tenant_id: UUID) -> bool:
    keys = await subscription_service.get_active_module_keys(session, tenant_id)
    return PARENTS_PORTAL_MODULE in keys


async def assert_can_manage_parent_credentials(
    session: AsyncSession, tenant_id: UUID
) -> None:
    if not await tenant_has_parents_portal(session, tenant_id):
        raise ParentPortalNotSubscribedError()


async def assert_parent_portal_login_allowed(
    session: AsyncSession, tenant_id: UUID
) -> None:
    if not await tenant_has_parents_portal(session, tenant_id):
        raise ParentPortalUnavailableError()


async def _parent_role(session: AsyncSession) -> Role:
    role = await session.scalar(
        select(Role).where(
            Role.role_key == "parent",
            Role.is_platform_role.is_(False),
        )
    )
    if role is None:
        raise ForbiddenError("Parent role is not configured.")
    return role


async def find_parent_account(
    session: AsyncSession, tenant_id: UUID, student_number: str
) -> TenantUser | None:
    return await session.scalar(
        select(TenantUser)
        .join(Role, Role.id == TenantUser.role_id)
        .where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.login_id == student_number,
            TenantUser.deleted_at.is_(None),
            Role.role_key == "parent",
        )
    )


async def _school_name(session: AsyncSession, tenant_id: UUID) -> str:
    code = await _school_code(session, tenant_id)
    name = await session.scalar(select(School.name).where(School.tenant_id == tenant_id))
    return name or code


async def _guardian_contact_emails(
    session: AsyncSession, tenant_id: UUID, student_id: UUID
) -> list[str]:
    rows = list(
        await session.scalars(
            select(StudentGuardian.email).where(
                StudentGuardian.tenant_id == tenant_id,
                StudentGuardian.student_id == student_id,
                StudentGuardian.deleted_at.is_(None),
            )
        )
    )
    return [email.strip() for email in rows if email and email.strip()]


def _unique_emails(*sources: str | None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in sources:
        if not raw:
            continue
        addr = str(raw).strip()
        if not addr:
            continue
        key = addr.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(addr)
    return out


async def notify_guardians_of_new_portal_account(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    student_id: UUID,
    username: str,
    password: str,
    extra_emails: list[str] | None = None,
    child_name: str | None = None,
) -> int:
    """Email shared portal credentials to guardian contacts when subscribed."""
    if not await tenant_has_parents_portal(session, tenant_id):
        return 0

    contact_emails = await _guardian_contact_emails(session, tenant_id, student_id)
    recipients = _unique_emails(*(extra_emails or []), *contact_emails)
    if not recipients:
        return 0

    school_name = await _school_name(session, tenant_id)
    sent = 0
    for to in recipients:
        if await email_service.send_guardian_portal_credentials(
            to=to,
            school_name=school_name,
            username=username,
            password=password,
            child_name=child_name,
        ):
            sent += 1
    return sent


async def ensure_parent_portal_account(
    session: AsyncSession,
    tenant_id: UUID,
    student: Student,
    *,
    guardian_name: str,
    password: str | None = None,
) -> ParentPortalAccountOut | None:
    """Create a shared guardian login for this pupil when the school is subscribed."""
    if not await tenant_has_parents_portal(session, tenant_id):
        return None

    existing = await find_parent_account(session, tenant_id, student.student_number)
    if existing is not None:
        return None

    temp = password or _temp_password()
    if len(temp) < 8:
        raise ForbiddenError("Generated parent portal password was too short.")

    role = await _parent_role(session)
    school_code = await _school_code(session, tenant_id)
    display_name = guardian_name.strip() or f"{student.first_name} {student.last_name}".strip()

    user = TenantUser(
        tenant_id=tenant_id,
        role_id=role.id,
        login_id=student.student_number,
        email=None,
        password_hash=hash_password(temp),
        name=display_name,
        status=UserStatus.active,
        must_change_password=True,
    )
    session.add(user)
    await session.flush()

    username = f"{student.student_number}@{school_code}"
    child_name = f"{student.first_name} {student.last_name}".strip()
    emails_sent = await notify_guardians_of_new_portal_account(
        session,
        tenant_id,
        student_id=student.id,
        username=username,
        password=temp,
        child_name=child_name,
    )

    return ParentPortalAccountOut(
        username=username,
        temporary_password=temp,
        auto_created=True,
        emails_sent=emails_sent,
    )
