"""Platform administrator lifecycle — create, deactivate, delete, password reset."""
from __future__ import annotations

import datetime as dt
import secrets
import string
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.security import hash_password
from app.models.enums import UserType
from app.models.platform import PlatformAdmin
from app.models.user import RefreshToken
from app.schemas.platform_admin import (
    PlatformAdminCreate,
    PlatformAdminCreateResponse,
    PlatformAdminOut,
    PlatformAdminUpdate,
)
from app.schemas.tenant_user import PasswordResetResponse
from app.services import email_service


def _temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _out(admin: PlatformAdmin) -> PlatformAdminOut:
    return PlatformAdminOut(
        id=admin.id,
        email=admin.email,
        name=admin.name,
        is_active=admin.is_active,
        must_change_password=admin.must_change_password,
        last_login_at=admin.last_login_at,
        created_at=admin.created_at,
    )


async def _revoke_tokens(session: AsyncSession, admin_id: UUID) -> None:
    now = dt.datetime.now(dt.UTC)
    await session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == admin_id,
            RefreshToken.user_type == UserType.platform_admin,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )


async def _active_admin_count(session: AsyncSession) -> int:
    return int(
        await session.scalar(
            select(func.count())
            .select_from(PlatformAdmin)
            .where(
                PlatformAdmin.deleted_at.is_(None),
                PlatformAdmin.is_active.is_(True),
            )
        )
        or 0
    )


async def list_admins(session: AsyncSession) -> list[PlatformAdminOut]:
    rows = await session.scalars(
        select(PlatformAdmin)
        .where(PlatformAdmin.deleted_at.is_(None))
        .order_by(PlatformAdmin.created_at, PlatformAdmin.email)
    )
    return [_out(row) for row in rows]


async def create_admin(
    session: AsyncSession,
    body: PlatformAdminCreate,
    *,
    created_by: str = "Platform administrator",
) -> PlatformAdminCreateResponse:
    email = str(body.email).strip().lower()
    existing = await session.scalar(
        select(PlatformAdmin.id).where(PlatformAdmin.email == email)
    )
    if existing:
        raise ConflictError(f"An administrator with email '{email}' already exists.")

    temp = body.password or _temp_password()
    admin = PlatformAdmin(
        email=email,
        name=body.name.strip(),
        password_hash=hash_password(temp),
        is_active=True,
        must_change_password=True,
    )
    session.add(admin)
    await session.flush()

    email_sent = False
    recipient: str | None = None
    if body.notify:
        email_sent = await email_service.send_platform_admin_credentials(
            to=email,
            name=admin.name,
            email=email,
            password=temp,
            intro=(
                f"{created_by} created your SkulPulse platform administrator account. "
                "Use the credentials below to sign in to the platform console."
            ),
        )
        if email_sent:
            recipient = email

    if email_sent:
        return PlatformAdminCreateResponse(
            admin=_out(admin),
            message="Administrator created. Credentials were emailed.",
            temporary_password=None,
            email_sent=True,
            email_recipient=recipient,
        )

    return PlatformAdminCreateResponse(
        admin=_out(admin),
        message=(
            "Administrator created. Share the temporary password securely; "
            "they must change it after signing in."
        ),
        temporary_password=temp,
        email_sent=False,
        email_recipient=None,
    )


async def update_admin(
    session: AsyncSession,
    admin_id: UUID,
    body: PlatformAdminUpdate,
    *,
    actor_id: UUID,
) -> PlatformAdminOut:
    admin = await session.scalar(
        select(PlatformAdmin).where(
            PlatformAdmin.id == admin_id,
            PlatformAdmin.deleted_at.is_(None),
        )
    )
    if admin is None:
        raise NotFoundError("Platform administrator not found.")

    if body.is_active is False and admin.id == actor_id:
        raise ForbiddenError("You cannot deactivate your own account.")

    if body.is_active is False:
        remaining = await _active_admin_count(session)
        if admin.is_active and remaining <= 1:
            raise ValidationError("Cannot deactivate the last active platform administrator.")

    if body.name is not None:
        admin.name = body.name.strip()
    if body.email is not None:
        email = str(body.email).strip().lower()
        if email != admin.email:
            taken = await session.scalar(
                select(PlatformAdmin.id).where(
                    PlatformAdmin.email == email,
                    PlatformAdmin.id != admin_id,
                )
            )
            if taken:
                raise ConflictError(f"Email '{email}' is already in use.")
            admin.email = email
    if body.is_active is not None:
        admin.is_active = body.is_active
        if not body.is_active:
            await _revoke_tokens(session, admin.id)

    admin.updated_at = dt.datetime.now(dt.UTC)
    await session.flush()
    return _out(admin)


async def delete_admin(
    session: AsyncSession,
    admin_id: UUID,
    *,
    actor_id: UUID,
) -> None:
    if admin_id == actor_id:
        raise ForbiddenError("You cannot delete your own account.")

    admin = await session.scalar(
        select(PlatformAdmin).where(
            PlatformAdmin.id == admin_id,
            PlatformAdmin.deleted_at.is_(None),
        )
    )
    if admin is None:
        raise NotFoundError("Platform administrator not found.")

    if admin.is_active:
        remaining = await _active_admin_count(session)
        if remaining <= 1:
            raise ValidationError("Cannot delete the last active platform administrator.")

    now = dt.datetime.now(dt.UTC)
    admin.is_active = False
    admin.deleted_at = now
    admin.updated_at = now
    await _revoke_tokens(session, admin.id)
    await session.flush()


async def change_password(
    session: AsyncSession,
    admin_id: UUID,
    *,
    current_password: str,
    new_password: str,
) -> None:
    from app.core.security import verify_password

    admin = await session.scalar(
        select(PlatformAdmin).where(
            PlatformAdmin.id == admin_id,
            PlatformAdmin.deleted_at.is_(None),
        )
    )
    if admin is None or not admin.is_active:
        raise NotFoundError("Platform administrator not found.")
    if not verify_password(current_password, admin.password_hash):
        raise ValidationError("Current password is incorrect.")
    from app.core.password_policy import validate_password_strength

    validate_password_strength(new_password)
    if verify_password(new_password, admin.password_hash):
        raise ValidationError("New password must be different from the current password.")

    admin.password_hash = hash_password(new_password)
    admin.must_change_password = False
    await _revoke_tokens(session, admin.id)


async def reset_admin_password(
    session: AsyncSession,
    admin_id: UUID,
    *,
    reset_by: str = "Platform administrator",
    notify: bool = True,
) -> PasswordResetResponse:
    admin = await session.scalar(
        select(PlatformAdmin).where(
            PlatformAdmin.id == admin_id,
            PlatformAdmin.deleted_at.is_(None),
        )
    )
    if admin is None:
        raise NotFoundError("Platform administrator not found.")
    if not admin.is_active:
        raise ValidationError("Cannot reset password for a deactivated account.")

    temp = _temp_password()
    admin.password_hash = hash_password(temp)
    admin.must_change_password = True
    admin.updated_at = dt.datetime.now(dt.UTC)
    await _revoke_tokens(session, admin.id)

    email_sent = False
    recipient: str | None = None
    if notify:
        email_sent = await email_service.send_platform_admin_password_reset(
            to=admin.email,
            name=admin.name,
            email=admin.email,
            password=temp,
            reset_by=reset_by,
        )
        if email_sent:
            recipient = admin.email

    if email_sent:
        return PasswordResetResponse(
            message="A temporary password was emailed to the administrator.",
            temporary_password=None,
            email_sent=True,
            email_recipient=recipient,
        )

    return PasswordResetResponse(
        message=(
            "Share this temporary password securely. "
            "The administrator must change it after signing in."
        ),
        temporary_password=temp,
        email_sent=False,
        email_recipient=None,
    )
