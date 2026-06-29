"""Parent circulars — school announcements."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pg_enum, uuid_pk
from app.models.enums import CircularAudience, CircularPriority, CircularStatus


class Circular(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "circulars"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[CircularStatus] = mapped_column(
        pg_enum(CircularStatus), nullable=False, default=CircularStatus.draft
    )
    audience: Mapped[CircularAudience] = mapped_column(
        pg_enum(CircularAudience), nullable=False, default=CircularAudience.all_parents
    )
    priority: Mapped[CircularPriority] = mapped_column(
        pg_enum(CircularPriority), nullable=False, default=CircularPriority.normal
    )
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id"), nullable=True
    )
    stream_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("streams.id"), nullable=True
    )
    published_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenant_users.id"), nullable=True
    )
    attachment_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
