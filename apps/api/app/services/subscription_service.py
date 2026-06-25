"""Module subscription reads/writes + entitlement cache (§4.1, §4.2).

Reads set the tenant RLS GUC so they pass row-level security even when called
from the auth flow (which has no ambient tenant context yet). Platform/tenant
writes run with RLS already satisfied (bypass on platform routes, tenant GUC on
tenant routes).
"""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import apply_tenant_guc
from app.core.errors import ValidationError
from app.models.enums import SubscriptionAction
from app.models.platform import ModuleCatalog
from app.models.subscription import SchoolModuleSubscription, SubscriptionChangeLog
from app.schemas.module import InvoiceBreakdown, InvoiceLine, ModuleCatalogItem
from app.services import cache_service


# --- Catalog helpers ----------------------------------------------------
async def list_catalog(session: AsyncSession) -> list[ModuleCatalogItem]:
    rows = await session.scalars(
        select(ModuleCatalog).where(ModuleCatalog.is_active.is_(True)).order_by(
            ModuleCatalog.sort_order
        )
    )
    return [ModuleCatalogItem.model_validate(r, from_attributes=True) for r in rows]


async def _catalog_by_key(session: AsyncSession) -> dict[str, ModuleCatalog]:
    rows = await session.scalars(select(ModuleCatalog))
    return {r.module_key: r for r in rows}


async def _resolve_ids(session: AsyncSession, keys: list[str]) -> dict[str, ModuleCatalog]:
    catalog = await _catalog_by_key(session)
    unknown = [k for k in keys if k not in catalog]
    if unknown:
        raise ValidationError(f"Unknown module(s): {', '.join(unknown)}")
    return {k: catalog[k] for k in keys}


async def validate_module_keys(session: AsyncSession, keys: list[str]) -> None:
    """Raise ValidationError if any key is not in the module catalog."""
    if keys:
        await _resolve_ids(session, keys)


def effective_module_keys(
    tenant_modules: list[str],
    role: str | None,
    allowed_modules: list[str] | None,
) -> list[str]:
    """Narrow a tenant's subscribed modules to what a single user may access.

    - ``school_admin`` always gets the full subscribed set.
    - ``allowed_modules is None`` means no per-user restriction (full set).
    - Otherwise: the intersection of subscribed and allowed, always keeping
      ``core`` so the dashboard/shell stays reachable.
    """
    if role == "school_admin" or allowed_modules is None:
        return list(tenant_modules)
    allowed = set(allowed_modules) | {"core"}
    return [m for m in tenant_modules if m in allowed]


# --- Entitlements read (cached) -----------------------------------------
async def get_active_module_keys(session: AsyncSession, tenant_id: UUID) -> list[str]:
    cached = await cache_service.get_cached_modules(tenant_id)
    if cached is not None:
        return cached

    await apply_tenant_guc(session, tenant_id)
    rows = await session.execute(
        select(ModuleCatalog.module_key)
        .join(SchoolModuleSubscription, SchoolModuleSubscription.module_id == ModuleCatalog.id)
        .where(
            SchoolModuleSubscription.tenant_id == tenant_id,
            SchoolModuleSubscription.is_active.is_(True),
        )
    )
    keys = sorted(r[0] for r in rows)
    await cache_service.set_cached_modules(tenant_id, keys)
    return keys


# --- Onboard: create initial subscriptions ------------------------------
async def create_initial_subscriptions(
    session: AsyncSession, tenant_id: UUID, module_keys: list[str]
) -> list[str]:
    resolved = await _resolve_ids(session, module_keys)
    for key, module in resolved.items():
        session.add(
            SchoolModuleSubscription(
                tenant_id=tenant_id, module_id=module.id, is_active=True
            )
        )
        session.add(
            SubscriptionChangeLog(
                tenant_id=tenant_id, module_id=module.id, action=SubscriptionAction.activated
            )
        )
    return sorted(resolved.keys())


# --- Replace the active module set --------------------------------------
async def replace_modules(
    session: AsyncSession,
    tenant_id: UUID,
    module_keys: list[str],
    actor_id: UUID | None = None,
    idempotency_key: str | None = None,
) -> list[str]:
    resolved = await _resolve_ids(session, module_keys)
    target_ids = {m.id for m in resolved.values()}

    current = await session.scalars(
        select(SchoolModuleSubscription).where(
            SchoolModuleSubscription.tenant_id == tenant_id,
            SchoolModuleSubscription.is_active.is_(True),
        )
    )
    current_rows = list(current)
    current_ids = {r.module_id for r in current_rows}
    now = dt.datetime.now(dt.timezone.utc)

    # Deactivate removed modules.
    for row in current_rows:
        if row.module_id not in target_ids:
            row.is_active = False
            row.deactivated_at = now
            session.add(
                SubscriptionChangeLog(
                    tenant_id=tenant_id,
                    module_id=row.module_id,
                    action=SubscriptionAction.deactivated,
                    actor_id=actor_id,
                    idempotency_key=idempotency_key,
                )
            )

    # Activate newly added modules.
    for module_id in target_ids - current_ids:
        session.add(
            SchoolModuleSubscription(
                tenant_id=tenant_id, module_id=module_id, is_active=True, activated_at=now
            )
        )
        session.add(
            SubscriptionChangeLog(
                tenant_id=tenant_id,
                module_id=module_id,
                action=SubscriptionAction.activated,
                actor_id=actor_id,
                idempotency_key=idempotency_key,
            )
        )

    keys = sorted(resolved.keys())
    # Refresh the entitlement cache (§4.1 invalidate on change).
    await cache_service.set_cached_modules(tenant_id, keys)
    return keys


# --- Invoice breakdown --------------------------------------------------
async def build_invoice(session: AsyncSession, module_keys: list[str]) -> InvoiceBreakdown:
    resolved = await _resolve_ids(session, module_keys)
    lines = [
        InvoiceLine(
            module_key=m.module_key, name=m.name, price_per_term_ugx=m.price_per_term_ugx
        )
        for m in sorted(resolved.values(), key=lambda x: x.sort_order)
        if m.price_per_term_ugx > 0
    ]
    module_total = sum(line.price_per_term_ugx for line in lines)
    base = settings.platform_base_fee_ugx
    return InvoiceBreakdown(
        platform_base_fee_ugx=base,
        modules=lines,
        module_total_ugx=module_total,
        total_per_term_ugx=base + module_total,
    )
