"""Weekly timetable slots — drives teacher attendance gating (§ timetable)."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import ForeignKey, Integer, String, Time
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, uuid_pk


class TimetableSlot(Base, TimestampMixin, SoftDeleteMixin):
    """A recurring weekly lesson: a class/stream taught a subject by a teacher.

    ``day_of_week`` follows ISO weekday numbering (1 = Monday … 7 = Sunday).
    """

    __tablename__ = "timetable_slots"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    starts_at: Mapped[dt.time] = mapped_column(Time, nullable=False)
    ends_at: Mapped[dt.time] = mapped_column(Time, nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    stream_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    teacher_user_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    period_label: Mapped[str | None] = mapped_column(String(40), nullable=True)
    room: Mapped[str | None] = mapped_column(String(40), nullable=True)
