"""Tenant read-only module view + module-gated stub (§6.3, §4.2).

Module subscriptions are managed by platform administrators only.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import get_session
from app.core.dependencies import get_tenant_context, require_module
from app.schemas.module import ModuleCatalogItem, TenantModules
from app.services import subscription_service

router = APIRouter(prefix="/tenant", tags=["tenant:modules"])


async def _tenant_modules(session: AsyncSession, tenant_id) -> TenantModules:
    keys = await subscription_service.get_active_module_keys(session, tenant_id)
    invoice = await subscription_service.build_invoice(session, keys)
    return TenantModules(modules=keys, invoice=invoice)


@router.get("/module-catalog", response_model=list[ModuleCatalogItem])
async def tenant_module_catalog(
    _: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_session),
) -> list[ModuleCatalogItem]:
    """Catalog visible to tenant users (read-only subscription view)."""
    return await subscription_service.list_catalog(session)


@router.get("/modules", response_model=TenantModules)
async def get_modules(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_session),
) -> TenantModules:
    return await _tenant_modules(session, ctx.tenant_id)


# --- Module gate proof (§9 Step 6) --------------------------------------
@router.get("/students/overview")
async def students_overview(
    ctx: TenantContext = Depends(require_module("students")),
) -> dict:
    """Stub endpoint proving module entitlement gating. 403 if 'students' is not
    in the caller's active modules."""
    return {"module": "students", "ok": True, "tenant_id": str(ctx.tenant_id)}
