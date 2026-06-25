"""Finance — fee structures, invoices, manual payments (Phase 2 §12–§13)."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ClassLevel

FEE_APPLIES_TO = frozenset({"all", "class_level", "day", "boarder"})
FEE_STRUCTURE_STATUS = frozenset({"draft", "active", "archived"})
INVOICE_STATUS = frozenset({"unpaid", "partial", "paid", "waived"})
PAYMENT_METHODS = frozenset({"cash", "bank_transfer", "mtn_momo", "airtel_money", "other"})


class FeeStructureLineOut(BaseModel):
    id: UUID
    label: str
    amount_ugx: int
    applies_to: str
    class_level: str | None = None
    sort_order: int
    is_optional: bool


class FeeStructureLineCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    amount_ugx: int = Field(ge=0)
    applies_to: str = "all"
    class_level: str | None = None
    sort_order: int | None = None
    is_optional: bool = False

    @field_validator("applies_to")
    @classmethod
    def _applies_to(cls, v: str) -> str:
        v = v.strip()
        if v not in FEE_APPLIES_TO:
            raise ValueError("applies_to must be all, class_level, day, or boarder")
        return v

    @field_validator("class_level")
    @classmethod
    def _class_level(cls, v: str | None, info) -> str | None:
        applies = info.data.get("applies_to", "all")
        if applies == "class_level":
            if not v:
                raise ValueError("class_level is required when applies_to is class_level")
            if v not in {c.value for c in ClassLevel}:
                raise ValueError("class_level must be P1–P7")
        return v


class FeeStructureLineUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    amount_ugx: int | None = Field(default=None, ge=0)
    applies_to: str | None = None
    class_level: str | None = None
    sort_order: int | None = None
    is_optional: bool | None = None

    @field_validator("applies_to")
    @classmethod
    def _applies_to(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if v not in FEE_APPLIES_TO:
            raise ValueError("applies_to must be all, class_level, day, or boarder")
        return v


class FeeStructureOut(BaseModel):
    id: UUID
    term_id: UUID
    term_label: str
    name: str
    status: str
    due_on: dt.date | None = None
    notes: str | None = None
    activated_at: dt.datetime | None = None
    line_count: int
    total_ugx: int
    lines: list[FeeStructureLineOut]


class FeeStructureCreate(BaseModel):
    term_id: UUID | None = None
    name: str = Field(min_length=1, max_length=160)
    due_on: dt.date | None = None
    notes: str | None = Field(default=None, max_length=2000)


class FeeStructureUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    due_on: dt.date | None = None
    notes: str | None = Field(default=None, max_length=2000)


class FeePaymentOut(BaseModel):
    id: UUID
    amount_ugx: int
    method: str
    reference: str | None = None
    paid_on: dt.date
    note: str | None = None
    recorded_by_user_id: UUID
    created_at: dt.datetime


class FeePaymentCreate(BaseModel):
    amount_ugx: int = Field(gt=0)
    method: str = "cash"
    reference: str | None = Field(default=None, max_length=80)
    paid_on: dt.date | None = None
    note: str | None = Field(default=None, max_length=500)

    @field_validator("method")
    @classmethod
    def _method(cls, v: str) -> str:
        v = v.strip()
        if v not in PAYMENT_METHODS:
            raise ValueError("method must be cash, bank_transfer, mtn_momo, airtel_money, or other")
        return v


class FeeInvoiceLineOut(BaseModel):
    id: UUID
    label: str
    amount_ugx: int
    sort_order: int


class FeeInvoiceOut(BaseModel):
    id: UUID
    invoice_number: str
    student_id: UUID
    student_number: str
    first_name: str
    last_name: str
    class_label: str | None = None
    term_id: UUID
    term_label: str
    total_ugx: int
    amount_paid_ugx: int
    balance_ugx: int
    status: str
    is_overdue: bool
    issued_at: dt.datetime
    due_on: dt.date | None = None


class FeeInvoiceDetailOut(FeeInvoiceOut):
    structure_id: UUID
    structure_name: str
    lines: list[FeeInvoiceLineOut]
    payments: list[FeePaymentOut]


class FinanceSummaryOut(BaseModel):
    term_id: UUID
    term_label: str
    active_structure_id: UUID | None = None
    active_structure_name: str | None = None
    registered_count: int
    invoiced_count: int
    not_invoiced_count: int
    total_invoiced_ugx: int
    total_collected_ugx: int
    total_outstanding_ugx: int
    counts: dict[str, int]


class InvoiceGenerateOut(BaseModel):
    created: int
    skipped_existing: int
    refreshed: int = 0
    term_id: UUID
