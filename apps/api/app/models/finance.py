"""Fee structures, student invoices, and manual payment records — Phase 2 §12–§13."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class FeeStructure(Base, TimestampMixin):
    __tablename__ = "fee_structures"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_fee_structures_tenant_id"),
        ForeignKeyConstraint(
            ["tenant_id", "term_id"],
            ["terms.tenant_id", "terms.id"],
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    term_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    due_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    activated_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    lines: Mapped[list["FeeStructureLine"]] = relationship(
        back_populates="structure",
        order_by="FeeStructureLine.sort_order, FeeStructureLine.label",
    )


class FeeStructureLine(Base, TimestampMixin):
    __tablename__ = "fee_structure_lines"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "structure_id"],
            ["fee_structures.tenant_id", "fee_structures.id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    structure_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    amount_ugx: Mapped[int] = mapped_column(Integer, nullable=False)
    applies_to: Mapped[str] = mapped_column(String(20), nullable=False, default="all")
    class_level: Mapped[str | None] = mapped_column(String(3), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_optional: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    structure: Mapped[FeeStructure] = relationship(back_populates="lines")


class FeeInvoice(Base, TimestampMixin):
    __tablename__ = "fee_invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_fee_invoices_tenant_id"),
        ForeignKeyConstraint(
            ["tenant_id", "student_id"],
            ["students.tenant_id", "students.id"],
        ),
        ForeignKeyConstraint(
            ["tenant_id", "term_id"],
            ["terms.tenant_id", "terms.id"],
        ),
        ForeignKeyConstraint(
            ["tenant_id", "structure_id"],
            ["fee_structures.tenant_id", "fee_structures.id"],
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    term_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    structure_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(40), nullable=False)
    total_ugx: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_paid_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="unpaid")
    issued_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    due_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)

    lines: Mapped[list["FeeInvoiceLine"]] = relationship(
        back_populates="invoice",
        order_by="FeeInvoiceLine.sort_order, FeeInvoiceLine.label",
    )
    payments: Mapped[list["FeePayment"]] = relationship(
        back_populates="invoice",
        order_by="FeePayment.paid_on.desc(), FeePayment.created_at.desc()",
    )


class FeeInvoiceLine(Base, TimestampMixin):
    __tablename__ = "fee_invoice_lines"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "invoice_id"],
            ["fee_invoices.tenant_id", "fee_invoices.id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    amount_ugx: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    invoice: Mapped[FeeInvoice] = relationship(back_populates="lines")


class FeePayment(Base, TimestampMixin):
    __tablename__ = "fee_payments"
    __table_args__ = (
        CheckConstraint("amount_ugx > 0", name="ck_fee_payments_amount_positive"),
        ForeignKeyConstraint(
            ["tenant_id", "invoice_id"],
            ["fee_invoices.tenant_id", "fee_invoices.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "recorded_by_user_id"],
            ["tenant_users.tenant_id", "tenant_users.id"],
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    amount_ugx: Mapped[int] = mapped_column(Integer, nullable=False)
    method: Mapped[str] = mapped_column(String(30), nullable=False, default="cash")
    reference: Mapped[str | None] = mapped_column(String(80), nullable=True)
    paid_on: Mapped[dt.date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by_user_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)

    invoice: Mapped[FeeInvoice] = relationship(back_populates="payments")
