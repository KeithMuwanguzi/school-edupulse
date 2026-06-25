"""Admissions pipeline — Phase 2 §14 (pre-enrollment applications)."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, uuid_pk


class AdmissionApplication(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "admission_applications"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_admission_applications_tenant_id"),
        UniqueConstraint("tenant_id", "reference_number", name="uq_admission_applications_ref"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    reference_number: Mapped[str] = mapped_column(String(24), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="application")

    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    date_of_birth: Mapped[dt.date | None] = mapped_column(Date, nullable=True)

    applied_class_level: Mapped[str | None] = mapped_column(String(10), nullable=True)
    applied_class_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id"), nullable=True
    )
    applied_stream_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("streams.id"), nullable=True
    )

    guardian_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    guardian_relationship: Mapped[str | None] = mapped_column(String(30), nullable=True)
    guardian_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    guardian_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    previous_school: Mapped[str | None] = mapped_column(String(160), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    interview_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    interview_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    applied_at: Mapped[dt.date] = mapped_column(Date, nullable=False)

    withdrawal_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)
    withdrawal_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    student_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    enrolled_at: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
