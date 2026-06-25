"""Module catalog + invoice schemas (§4.2)."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class ModuleCatalogItem(BaseModel):
    id: UUID
    module_key: str
    name: str
    description: str | None = None
    category: str
    price_per_term_ugx: int
    is_active: bool


class InvoiceLine(BaseModel):
    module_key: str
    name: str
    price_per_term_ugx: int


class InvoiceBreakdown(BaseModel):
    currency: str = "UGX"
    platform_base_fee_ugx: int
    modules: list[InvoiceLine]
    module_total_ugx: int
    total_per_term_ugx: int


class TenantModules(BaseModel):
    modules: list[str]
    invoice: InvoiceBreakdown
