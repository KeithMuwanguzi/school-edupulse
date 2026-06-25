"""Append-only audit logging for business events (§4.5).

Never updates or deletes audit rows. Correlated to requests via request_id.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import get_request_id
from app.models.audit import AuditLog
from app.models.enums import ActorType


async def record_audit(
    session: AsyncSession,
    *,
    actor_type: ActorType | str,
    action: str,
    actor_id: UUID | None = None,
    tenant_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: UUID | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Add an audit row to the given session (committed by the caller's unit of work)."""
    session.add(
        AuditLog(
            actor_type=actor_type.value if isinstance(actor_type, ActorType) else actor_type,
            actor_id=actor_id,
            tenant_id=tenant_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            request_id=get_request_id(),
            audit_metadata=metadata,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
