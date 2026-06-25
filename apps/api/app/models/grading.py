"""Grading scales per NCDC section with reusable grade bands."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pg_enum, uuid_pk
from app.models.enums import NcdcCycle


class GradingScale(Base, TimestampMixin, SoftDeleteMixin):
    """Named grading scale for a curriculum section (P1–P3, P4, or P5–P7)."""

    __tablename__ = "grading_scales"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    ncdc_cycle: Mapped[NcdcCycle] = mapped_column(pg_enum(NcdcCycle), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class GradeRange(Base, TimestampMixin, SoftDeleteMixin):
    """Mark band within a grading scale."""

    __tablename__ = "grade_ranges"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    scale_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("grading_scales.id"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    aggregate_weight: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    min_mark: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    max_mark: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    class_teacher_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    head_teacher_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class AggregateDivision(Base, TimestampMixin, SoftDeleteMixin):
    """PLE aggregate band — e.g. Division I (aggregate 4–12)."""

    __tablename__ = "aggregate_divisions"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    min_aggregate: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    max_aggregate: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    class_teacher_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    head_teacher_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
