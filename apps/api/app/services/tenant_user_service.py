"""Tenant portal user management — Phase 2 §4."""
from __future__ import annotations

import secrets
import string
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.security import hash_password
from app.models.enums import UserStatus, UserType
from app.models.platform import Tenant
from app.models.school import School
from app.models.user import RefreshToken, Role, TenantUser
from app.schemas.tenant_user import (
    PasswordResetResponse,
    RoleOption,
    TenantUserCreate,
    TenantUserOut,
    TenantUserUpdate,
)
from app.services import email_service, subscription_service

ASSIGNABLE_ROLES = frozenset(
    {"school_admin", "deputy_head", "teacher", "bursar", "parent"}
)


def _temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def _school_code(session: AsyncSession, tenant_id: UUID) -> str:
    code = await session.scalar(select(Tenant.school_code).where(Tenant.id == tenant_id))
    if code is None:
        raise NotFoundError("School not found.")
    return code


async def allocate_next_login_id(session: AsyncSession, tenant_id: UUID) -> str:
    """Next zero-padded staff login id (0001, 0002, …) for this tenant."""
    rows = await session.scalars(
        select(TenantUser.login_id).where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    max_num = 0
    for lid in rows:
        if lid.strip().isdigit():
            max_num = max(max_num, int(lid.strip()))
    return f"{max_num + 1:04d}"


async def _resolve_role(session: AsyncSession, role_key: str) -> Role:
    if role_key not in ASSIGNABLE_ROLES:
        raise ValidationError(f"Role '{role_key}' cannot be assigned.")
    role = await session.scalar(
        select(Role).where(Role.role_key == role_key, Role.is_platform_role.is_(False))
    )
    if role is None:
        raise ValidationError(f"Unknown role '{role_key}'.")
    return role


def _out(user: TenantUser, role_key: str, school_code: str) -> TenantUserOut:
    return TenantUserOut(
        id=user.id,
        login_id=user.login_id,
        username=f"{user.login_id}@{school_code}",
        name=user.name,
        role=role_key,
        status=user.status.value,
        email=user.email,
        allowed_modules=user.allowed_modules,
        must_change_password=user.must_change_password,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


async def list_assignable_roles(session: AsyncSession) -> list[RoleOption]:
    rows = await session.scalars(
        select(Role)
        .where(Role.is_platform_role.is_(False), Role.role_key.in_(ASSIGNABLE_ROLES))
        .order_by(Role.name)
    )
    return [
        RoleOption(role_key=r.role_key, name=r.name, description=r.description) for r in rows
    ]


async def list_users(
    session: AsyncSession, tenant_id: UUID, role_key: str | None = None
) -> list[TenantUserOut]:
    school_code = await _school_code(session, tenant_id)
    stmt = (
        select(TenantUser, Role.role_key)
        .join(Role, Role.id == TenantUser.role_id)
        .where(TenantUser.tenant_id == tenant_id, TenantUser.deleted_at.is_(None))
        .order_by(TenantUser.login_id)
    )
    if role_key:
        stmt = stmt.where(Role.role_key == role_key)
    rows = await session.execute(stmt)
    return [_out(u, rk, school_code) for (u, rk) in rows]


async def create_user(
    session: AsyncSession, tenant_id: UUID, body: TenantUserCreate
) -> TenantUserOut:
    school_code = await _school_code(session, tenant_id)
    role = await _resolve_role(session, body.role_key)

    if body.role_key == "parent":
        if not body.login_id:
            raise ValidationError(
                "Parent accounts require the student's number as the login ID."
            )
        login_id = body.login_id
    else:
        login_id = body.login_id or await allocate_next_login_id(session, tenant_id)

    existing = await session.scalar(
        select(TenantUser.id).where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.login_id == login_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    if existing:
        raise ConflictError(f"Login ID '{login_id}' is already in use.")

    # school_admin always has full access — per-user scoping is meaningless there.
    allowed_modules = None
    if body.role_key != "school_admin" and body.allowed_modules is not None:
        await subscription_service.validate_module_keys(session, body.allowed_modules)
        allowed_modules = body.allowed_modules

    email = str(body.email) if body.email else None
    if body.role_key != "parent" and not email:
        raise ValidationError("Email is required for staff accounts.")

    user = TenantUser(
        tenant_id=tenant_id,
        role_id=role.id,
        login_id=login_id,
        email=email,
        password_hash=hash_password(body.password),
        name=body.name.strip(),
        status=UserStatus.active,
        allowed_modules=allowed_modules,
        must_change_password=True,
    )
    session.add(user)
    await session.flush()

    if body.role_key != "parent" and email:
        school_name = await session.scalar(
            select(School.name).where(School.tenant_id == tenant_id)
        )
        await email_service.send_portal_credentials(
            to=email,
            school_name=school_name or school_code,
            username=f"{login_id}@{school_code}",
            password=body.password,
            intro=(
                f"Your SkulPulse portal account for {school_name or school_code} is ready. "
                "Sign in with the credentials below, then choose a new password."
            ),
        )

    return _out(user, role.role_key, school_code)


async def update_user(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    body: TenantUserUpdate,
    actor_id: UUID,
) -> TenantUserOut:
    school_code = await _school_code(session, tenant_id)
    result = await session.execute(
        select(TenantUser, Role.role_key)
        .join(Role, Role.id == TenantUser.role_id)
        .where(
            TenantUser.id == user_id,
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    row = result.first()
    if row is None:
        raise NotFoundError("User not found.")
    user, current_role = row

    if body.status == UserStatus.disabled and user.id == actor_id:
        raise ForbiddenError("You cannot disable your own account.")

    if body.role_key is not None and body.role_key != current_role and user.id == actor_id:
        raise ForbiddenError("You cannot change your own role.")

    if body.name is not None:
        user.name = body.name.strip()
    if body.email is not None:
        user.email = str(body.email)
    if body.role_key is not None:
        role = await _resolve_role(session, body.role_key)
        user.role_id = role.id
        current_role = role.role_key
    # Module scoping: only touch when the field was explicitly supplied.
    if "allowed_modules" in body.model_fields_set:
        if body.allowed_modules is not None:
            await subscription_service.validate_module_keys(session, body.allowed_modules)
        user.allowed_modules = body.allowed_modules
    # Promoting to school_admin removes any narrowing (admins see everything).
    if current_role == "school_admin":
        user.allowed_modules = None
    if body.status is not None:
        if body.status not in (UserStatus.active, UserStatus.disabled):
            raise ValidationError("Status must be active or disabled.")
        user.status = body.status
        if body.status == UserStatus.disabled:
            await _revoke_tokens(session, user.id)

    return _out(user, current_role, school_code)


async def reset_user_password(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    *,
    school_name: str | None = None,
    reset_by: str = "School administrator",
    notify: bool = True,
) -> PasswordResetResponse:
    school_code = await _school_code(session, tenant_id)
    row = await session.execute(
        select(TenantUser, Role.role_key)
        .join(Role, Role.id == TenantUser.role_id)
        .where(
            TenantUser.id == user_id,
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    found = row.first()
    if found is None:
        raise NotFoundError("User not found.")
    user, _role_key = found

    if user.status == UserStatus.disabled:
        raise ValidationError("Cannot reset password for a disabled account.")

    temp = _temp_password()
    user.password_hash = hash_password(temp)
    user.must_change_password = True
    await _revoke_tokens(session, user.id)

    username = f"{user.login_id}@{school_code}"
    email_sent = False
    recipient: str | None = None
    if notify and user.email:
        email_sent = await email_service.send_password_reset_notice(
            to=user.email,
            school_name=school_name or school_code,
            username=username,
            password=temp,
            reset_by=reset_by,
        )
        if email_sent:
            recipient = user.email

    if email_sent:
        return PasswordResetResponse(
            message="A temporary password was emailed to the account holder.",
            temporary_password=None,
            email_sent=True,
            email_recipient=recipient,
        )

    return PasswordResetResponse(
        message=(
            "Share this temporary password securely. "
            "The user must change it after signing in."
        ),
        temporary_password=temp,
        email_sent=False,
        email_recipient=None,
    )


async def reset_password_stub(
    session: AsyncSession, tenant_id: UUID, user_id: UUID
) -> PasswordResetResponse:
    return await reset_user_password(
        session,
        tenant_id,
        user_id,
        reset_by="School administrator",
    )


async def change_password(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    *,
    current_password: str,
    new_password: str,
) -> None:
    from app.core.security import verify_password

    user = await session.scalar(
        select(TenantUser).where(
            TenantUser.id == user_id,
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    if user is None or user.status != UserStatus.active:
        raise NotFoundError("User not found.")
    if not verify_password(current_password, user.password_hash):
        raise ValidationError("Current password is incorrect.")
    from app.core.password_policy import validate_password_strength

    validate_password_strength(new_password)
    if verify_password(new_password, user.password_hash):
        raise ValidationError("New password must be different from the current password.")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    await _revoke_tokens(session, user.id)


async def _revoke_tokens(session: AsyncSession, user_id: UUID) -> None:
    from datetime import UTC, datetime

    await session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.user_type == UserType.tenant_user,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
