"""Boarding & Hostel add-on — Phase 2 §19.

A ``hostel`` is a boarding house (dormitory building). Each hostel may hold
``hostel_rooms`` (dorms/cubicles). Learners are allocated by setting
``students.hostel_id`` / ``students.hostel_room_id`` (see student model).
"""
from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, uuid_pk


class Hostel(Base, TimestampMixin, SoftDeleteMixin):
    """A boarding house / dormitory building."""

    __tablename__ = "hostels"
    __table_args__ = (UniqueConstraint("tenant_id", "id", name="uq_hostels_tenant_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # boys | girls | mixed
    gender: Mapped[str] = mapped_column(String(10), nullable=False, default="mixed")
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    warden_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), nullable=True
    )
    location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class HostelRoom(Base, TimestampMixin, SoftDeleteMixin):
    """A room / dorm / cubicle inside a hostel."""

    __tablename__ = "hostel_rooms"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id", name="uq_hostel_rooms_tenant_id"),
        ForeignKeyConstraint(
            ["tenant_id", "hostel_id"],
            ["hostels.tenant_id", "hostels.id"],
            name="fk_hostel_rooms_hostel",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    hostel_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    floor: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
