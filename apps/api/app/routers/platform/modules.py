"""Platform module catalog + invoice estimate (§6.2)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_platform_session
from app.schemas.module import InvoiceBreakdown, ModuleCatalogItem
from app.services import subscription_service

router = APIRouter(prefix="/platform", tags=["platform:modules"])


class EstimateRequest(BaseModel):
    module_keys: list[str] = Field(min_length=1)


@router.get("/module-catalog", response_model=list[ModuleCatalogItem])
async def module_catalog(
    session: AsyncSession = Depends(get_platform_session),
) -> list[ModuleCatalogItem]:
    return await subscription_service.list_catalog(session)


@router.post("/module-catalog/estimate", response_model=InvoiceBreakdown)
async def estimate(
    body: EstimateRequest,
    session: AsyncSession = Depends(get_platform_session),
) -> InvoiceBreakdown:
    return await subscription_service.build_invoice(session, body.module_keys)
