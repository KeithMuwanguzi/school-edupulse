"""Authentication: credential checks, JWT issuance, refresh rotation (§4.8, §6.1).

Refresh tokens are opaque, stored only as SHA-256 hashes. Rotation revokes the
presented token and issues a new one; presenting an already-revoked token is
treated as reuse and revokes the whole family (reuse detection).
"""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import apply_bypass_guc, apply_tenant_guc
from app.core.errors import (
    InvalidCredentialsError,
    SchoolSuspendedError,
    TokenError,
    TokenReuseError,
)
from app.core.logging import get_logger
from app.core.redis import redis_client, refresh_key
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    refresh_expiry,
    verify_password,
)
from app.models.enums import TenantStatus, UserStatus, UserType
from app.models.platform import PlatformAdmin, Tenant
from app.models.user import RefreshToken, Role, TenantUser
from app.schemas.auth import TokenResponse
from app.services import cache_service

log = get_logger("skulpulse.auth")


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


# --- Credential verification --------------------------------------------
async def authenticate_platform(session: AsyncSession, email: str, password: str) -> PlatformAdmin:
    admin = await session.scalar(
        select(PlatformAdmin).where(PlatformAdmin.email == email.lower())
    )
    if not admin or not admin.is_active or not verify_password(password, admin.password_hash):
        raise InvalidCredentialsError("Email or password is incorrect.")
    return admin


def parse_username(username: str) -> tuple[str, str]:
    """Split `login_id@school_code` on the LAST '@' (§2.6)."""
    if "@" not in username:
        raise InvalidCredentialsError("Username must be in the form login_id@SCHOOLCODE.")
    login_id, school_code = username.rsplit("@", 1)
    login_id = login_id.strip()
    school_code = school_code.strip().upper()
    if not login_id or not school_code:
        raise InvalidCredentialsError("Username must be in the form login_id@SCHOOLCODE.")
    return login_id, school_code


async def authenticate_tenant(
    session: AsyncSession, username: str, password: str
) -> tuple[TenantUser, Tenant]:
    login_id, school_code = parse_username(username)

    tenant = await session.scalar(select(Tenant).where(Tenant.school_code == school_code))
    if tenant is None or tenant.deleted_at is not None:
        # Do not reveal whether the school or the user is the problem.
        raise InvalidCredentialsError("Invalid username or password.")
    if tenant.status in (TenantStatus.suspended, TenantStatus.inactive):
        raise SchoolSuspendedError("This school account is not active. Contact SkulPulse.")

    # Reading tenant_users requires the RLS GUC for this tenant.
    await apply_tenant_guc(session, tenant.id)
    user = await session.scalar(
        select(TenantUser).where(
            TenantUser.tenant_id == tenant.id,
            TenantUser.login_id == login_id,
            TenantUser.deleted_at.is_(None),
        )
    )
    if (
        user is None
        or user.status != UserStatus.active
        or not verify_password(password, user.password_hash)
    ):
        raise InvalidCredentialsError("Invalid username or password.")

    # Keep the code→tenant lookup warm (§4.1).
    await cache_service.set_cached_tenant_id(school_code, tenant.id)
    return user, tenant


# --- Claims -------------------------------------------------------------
async def build_claims(session: AsyncSession, user_type: UserType, user_id: UUID) -> dict:
    """Build fresh JWT claims from current DB state (so role/module changes
    propagate on refresh)."""
    if user_type == UserType.platform_admin:
        admin = await session.get(PlatformAdmin, user_id)
        if not admin or not admin.is_active:
            raise TokenError("Account is no longer active.")
        return {"sub": str(admin.id), "type": "platform_admin", "role": "platform_admin"}

    # tenant_user — auth paths have no tenant GUC yet; bypass RLS to load claims.
    await apply_bypass_guc(session)
    user = await session.get(TenantUser, user_id)
    if not user or user.status.value != "active" or user.deleted_at is not None:
        raise TokenError("Account is no longer active.")
    role = await session.get(Role, user.role_id)
    tenant = await session.get(Tenant, user.tenant_id)
    from app.services.subscription_service import (
        effective_module_keys,
        get_active_module_keys,
    )

    role_key = role.role_key if role else None
    tenant_modules = await get_active_module_keys(session, user.tenant_id)
    modules = effective_module_keys(tenant_modules, role_key, user.allowed_modules)
    return {
        "sub": str(user.id),
        "type": "tenant_user",
        "tenant_id": str(user.tenant_id),
        "role": role_key,
        "school_code": tenant.school_code if tenant else None,
        "modules": modules,
    }


# --- Token issuance / rotation ------------------------------------------
async def issue_tokens(
    session: AsyncSession, user_type: UserType, user_id: UUID, claims: dict
) -> TokenResponse:
    access = create_access_token(claims)
    refresh = generate_refresh_token()
    token_hash = hash_refresh_token(refresh)
    expires = refresh_expiry()

    session.add(
        RefreshToken(
            user_type=user_type,
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires,
        )
    )
    await session.flush()
    await redis_client.set(
        refresh_key(token_hash),
        str(user_id),
        ex=settings.jwt_refresh_expire_days * 24 * 60 * 60,
    )
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.jwt_access_expire_minutes * 60,
    )


async def rotate_tokens(session: AsyncSession, refresh_token: str) -> TokenResponse:
    token_hash = hash_refresh_token(refresh_token)
    row = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    if row is None:
        raise TokenError("Refresh token is invalid.")

    if row.revoked_at is not None:
        # Reuse of a rotated token → revoke the whole family for this user.
        # Commit the revocation here: the raised error aborts the route's commit.
        await _revoke_all_for_user(session, row.user_type, row.user_id)
        await session.commit()
        log.log(50, "refresh.reuse_detected", user_id=str(row.user_id))
        raise TokenReuseError("Refresh token has already been used.")

    if row.expires_at <= _now():
        raise TokenError("Refresh token has expired.")

    claims = await build_claims(session, row.user_type, row.user_id)
    new_tokens = await issue_tokens(session, row.user_type, row.user_id, claims)

    # Revoke the presented token, link to its replacement.
    new_hash = hash_refresh_token(new_tokens.refresh_token)
    replacement = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == new_hash)
    )
    row.revoked_at = _now()
    row.replaced_by = replacement.id if replacement else None
    await redis_client.delete(refresh_key(token_hash))
    return new_tokens


async def revoke_token(session: AsyncSession, refresh_token: str) -> None:
    token_hash = hash_refresh_token(refresh_token)
    row = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    if row and row.revoked_at is None:
        row.revoked_at = _now()
    await redis_client.delete(refresh_key(token_hash))


async def _revoke_all_for_user(
    session: AsyncSession, user_type: UserType, user_id: UUID
) -> None:
    await session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.user_type == user_type,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=_now())
    )
