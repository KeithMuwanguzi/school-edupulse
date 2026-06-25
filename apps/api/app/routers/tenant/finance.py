"""Finance — fee structures, invoicing, manual payments (Phase 2 §12–§13)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.schemas.finance import (
    FeeInvoiceDetailOut,
    FeeInvoiceOut,
    FeePaymentCreate,
    FeeStructureCreate,
    FeeStructureLineCreate,
    FeeStructureLineUpdate,
    FeeStructureOut,
    FeeStructureUpdate,
    FinanceSummaryOut,
    InvoiceGenerateOut,
)
from app.services import finance_service

router = APIRouter(prefix="/tenant", tags=["tenant:finance"])

_finance = require_module("finance")
_admin = require_role("school_admin")
_staff = require_role("school_admin", "bursar")


@router.get("/finance/summary", response_model=FinanceSummaryOut)
async def finance_summary(
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> FinanceSummaryOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await finance_service.finance_summary(session, ctx.tenant_id, term_id=term_id)


@router.get("/finance/structures", response_model=list[FeeStructureOut])
async def list_fee_structures(
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> list[FeeStructureOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await finance_service.list_structures(session, ctx.tenant_id, term_id=term_id)


@router.post("/finance/structures", response_model=FeeStructureOut, status_code=201)
async def create_fee_structure(
    body: FeeStructureCreate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> FeeStructureOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await finance_service.create_structure(session, ctx.tenant_id, body)
    await session.commit()
    return out


@router.patch("/finance/structures/{structure_id}", response_model=FeeStructureOut)
async def update_fee_structure(
    structure_id: UUID,
    body: FeeStructureUpdate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> FeeStructureOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await finance_service.update_structure(session, ctx.tenant_id, structure_id, body)
    await session.commit()
    return out


@router.post("/finance/structures/{structure_id}/activate", response_model=FeeStructureOut)
async def activate_fee_structure(
    structure_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> FeeStructureOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await finance_service.activate_structure(session, ctx.tenant_id, structure_id)
    await session.commit()
    return out


@router.post("/finance/structures/{structure_id}/lines", response_model=FeeStructureOut)
async def add_fee_structure_line(
    structure_id: UUID,
    body: FeeStructureLineCreate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> FeeStructureOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await finance_service.add_structure_line(session, ctx.tenant_id, structure_id, body)
    await session.commit()
    return out


@router.patch(
    "/finance/structures/{structure_id}/lines/{line_id}",
    response_model=FeeStructureOut,
)
async def update_fee_structure_line(
    structure_id: UUID,
    line_id: UUID,
    body: FeeStructureLineUpdate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> FeeStructureOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await finance_service.update_structure_line(
        session, ctx.tenant_id, structure_id, line_id, body
    )
    await session.commit()
    return out


@router.delete(
    "/finance/structures/{structure_id}/lines/{line_id}",
    response_model=FeeStructureOut,
)
async def delete_fee_structure_line(
    structure_id: UUID,
    line_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> FeeStructureOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await finance_service.delete_structure_line(
        session, ctx.tenant_id, structure_id, line_id
    )
    await session.commit()
    return out


@router.get("/finance/invoices", response_model=list[FeeInvoiceOut])
async def list_fee_invoices(
    term_id: UUID | None = None,
    status: str | None = None,
    class_id: UUID | None = None,
    q: str | None = None,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> list[FeeInvoiceOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await finance_service.list_invoices(
        session,
        ctx.tenant_id,
        term_id=term_id,
        status=status,
        class_id=class_id,
        q=q,
    )


@router.post("/finance/invoices/generate", response_model=InvoiceGenerateOut)
async def generate_fee_invoices(
    term_id: UUID | None = None,
    refresh_unpaid: bool = False,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> InvoiceGenerateOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await finance_service.generate_invoices(
        session,
        ctx.tenant_id,
        term_id=term_id,
        refresh_unpaid=refresh_unpaid,
    )
    await session.commit()
    return out


@router.get("/finance/invoices/{invoice_id}", response_model=FeeInvoiceDetailOut)
async def get_fee_invoice(
    invoice_id: UUID,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> FeeInvoiceDetailOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await finance_service.get_invoice(session, ctx.tenant_id, invoice_id)


@router.post(
    "/finance/invoices/{invoice_id}/payments",
    response_model=FeeInvoiceDetailOut,
    status_code=201,
)
async def record_fee_payment(
    invoice_id: UUID,
    body: FeePaymentCreate,
    ctx: TenantContext = Depends(_staff),
    _mod: TenantContext = Depends(_finance),
    session: AsyncSession = Depends(get_session),
) -> FeeInvoiceDetailOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await finance_service.record_payment(
        session,
        ctx.tenant_id,
        invoice_id,
        body,
        recorded_by_user_id=ctx.user_id,
    )
    await session.commit()
    return out
