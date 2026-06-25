"""P1–P7 classes and streams — Phase 2 §3."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pg_enum, uuid_pk
from app.models.enums import ClassLevel


class SchoolClass(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("tenant_id", "id", name="uq_classes_tenant_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    level: Mapped[ClassLevel] = mapped_column(pg_enum(ClassLevel), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    streams: Mapped[list["ClassStream"]] = relationship(
        back_populates="school_class",
        order_by="ClassStream.sort_order, ClassStream.name",
    )


class ClassStream(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "streams"
    __table_args__ = (UniqueConstraint("tenant_id", "id", name="uq_streams_tenant_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    school_class: Mapped[SchoolClass] = relationship(back_populates="streams")
