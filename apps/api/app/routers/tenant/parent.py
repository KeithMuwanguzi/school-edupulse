"""Parent portal — guardian-facing routes (one login per pupil)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import require_module, require_role
from app.schemas.finance import FeeInvoiceDetailOut, FeeInvoiceOut
from app.schemas.parent import ParentPortalOverviewOut
from app.schemas.reportcard import ReportCardPreviewOut
from app.services import parent_portal_service

router = APIRouter(prefix="/tenant", tags=["tenant:parent"])

_parent = require_role("parent")
_portal = require_module("parents_portal")


@router.get("/parent/overview", response_model=ParentPortalOverviewOut)
async def get_parent_overview(
    ctx: TenantContext = Depends(_parent),
    _mod: TenantContext = Depends(_portal),
    session: AsyncSession = Depends(get_session),
) -> ParentPortalOverviewOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await parent_portal_service.get_overview(
        session,
        ctx.tenant_id,
        ctx.user_id,
        modules=ctx.modules,
    )


@router.get("/parent/report-card/preview", response_model=ReportCardPreviewOut)
async def get_parent_report_card_preview(
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_parent),
    _portal_mod: TenantContext = Depends(_portal),
    _reportcards: TenantContext = Depends(require_module("reportcards")),
    session: AsyncSession = Depends(get_session),
) -> ReportCardPreviewOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await parent_portal_service.get_report_card_preview(
        session,
        ctx.tenant_id,
        ctx.user_id,
        term_id=term_id,
    )


@router.get("/parent/report-card/pdf")
async def get_parent_report_card_pdf(
    term_id: UUID | None = None,
    ctx: TenantContext = Depends(_parent),
    _portal_mod: TenantContext = Depends(_portal),
    _reportcards: TenantContext = Depends(require_module("reportcards")),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await apply_tenant_guc(session, ctx.tenant_id)
    pdf_bytes = await parent_portal_service.get_report_card_pdf(
        session,
        ctx.tenant_id,
        ctx.user_id,
        term_id=term_id,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="report-card.pdf"'},
    )


@router.get("/parent/fees", response_model=list[FeeInvoiceOut])
async def list_parent_fees(
    ctx: TenantContext = Depends(_parent),
    _portal_mod: TenantContext = Depends(_portal),
    _finance: TenantContext = Depends(require_module("finance")),
    session: AsyncSession = Depends(get_session),
) -> list[FeeInvoiceOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await parent_portal_service.list_fee_invoices(
        session, ctx.tenant_id, ctx.user_id
    )


@router.get("/parent/fees/{invoice_id}", response_model=FeeInvoiceDetailOut)
async def get_parent_fee_invoice(
    invoice_id: UUID,
    ctx: TenantContext = Depends(_parent),
    _portal_mod: TenantContext = Depends(_portal),
    _finance: TenantContext = Depends(require_module("finance")),
    session: AsyncSession = Depends(get_session),
) -> FeeInvoiceDetailOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await parent_portal_service.get_fee_invoice(
        session, ctx.tenant_id, ctx.user_id, invoice_id
    )
