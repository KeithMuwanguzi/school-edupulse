"""School profile — tenant-scoped (§5.2)."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pg_enum, uuid_pk
from app.models.enums import (
    BoardingStatus,
    Ownership,
    RegistrationStatus,
    SexComposition,
)


class School(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "schools"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.id"),
        unique=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    motto: Mapped[str | None] = mapped_column(Text, nullable=True)
    badge_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    ownership: Mapped[Ownership] = mapped_column(
        pg_enum(Ownership), nullable=False, default=Ownership.private
    )
    emis_number: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    license_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    registration_status: Mapped[RegistrationStatus] = mapped_column(
        pg_enum(RegistrationStatus), nullable=False, default=RegistrationStatus.unknown
    )
    boarding_status: Mapped[BoardingStatus] = mapped_column(
        pg_enum(BoardingStatus), nullable=False, default=BoardingStatus.day
    )
    sex_composition: Mapped[SexComposition] = mapped_column(
        pg_enum(SexComposition), nullable=False, default=SexComposition.mixed
    )
    is_upe: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Location (FKs into geo hierarchy — §2.2)
    district_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("districts.id"), nullable=True
    )
    county_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("counties.id"), nullable=True
    )
    sub_county_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("sub_counties.id"), nullable=True
    )
    parish_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("parishes.id"), nullable=True
    )
    address_line: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Contact
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    head_teacher_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_person_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_person_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contact_person_nin: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Preferences
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Africa/Kampala")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="UGX")
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en-UG")

    # Auto student-number scheme: <prefix><zero-padded sequence>, prefix unique per school.
    student_number_prefix: Mapped[str | None] = mapped_column(String(10), nullable=True)

    report_footer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_next_term_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    student_number_next: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
