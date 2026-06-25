"""P7 PLE candidacy — Phase 2 §11."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Date, ForeignKey, ForeignKeyConstraint, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, uuid_pk


class PleCandidate(Base, TimestampMixin, SoftDeleteMixin):
    """A P7 learner registered as a PLE candidate for an academic year."""

    __tablename__ = "ple_candidates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_ple_candidates_tenant_id"),
        UniqueConstraint(
            "tenant_id",
            "student_id",
            "academic_year_id",
            name="uq_ple_candidates_student_year",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "student_id"],
            ["students.tenant_id", "students.id"],
            name="fk_ple_candidates_student",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="nominated")
    candidate_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    registered_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    withdrawn_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    withdrawal_reason: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    nominated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), nullable=True
    )
