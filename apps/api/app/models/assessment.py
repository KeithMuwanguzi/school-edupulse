"""Assessment — term sets, CA policy, student marks (Phase 2 §9)."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, uuid_pk


class AssessmentSet(Base, TimestampMixin, SoftDeleteMixin):
    """A test or exam set within a term (admin opens/closes for teacher entry)."""

    __tablename__ = "assessment_sets"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_assessment_sets_tenant_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    term_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_mark: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    entry_status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")


class TermCaPolicy(Base, TimestampMixin):
    """How continuous assessment is computed for a term."""

    __tablename__ = "term_ca_policies"
    __table_args__ = (UniqueConstraint("tenant_id", "term_id", name="uq_term_ca_policies_term"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    term_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    method: Mapped[str] = mapped_column(String(30), nullable=False, default="average")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class CaSetInclusion(Base, TimestampMixin):
    """Assessment sets included in the term CA calculation."""

    __tablename__ = "ca_set_inclusions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "term_id", "set_id", name="uq_ca_set_inclusions_set"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    term_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    set_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=1.0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class StudentAssessmentMark(Base, TimestampMixin):
    """Mark entered by a teacher for one student, subject, and assessment set."""

    __tablename__ = "student_assessment_marks"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "set_id",
            "student_id",
            "subject_id",
            name="uq_student_assessment_marks_row",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    term_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    set_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    score: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    competence_level: Mapped[str | None] = mapped_column(String(40), nullable=True)
    remark: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    entered_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
