"""Learner registry & profile — Phase 2 §5 enrollment.

The student profile is intentionally rich: identity/demographics live on the
``students`` row, while guardians (1→many), health (1→1) and discipline
incidents (1→many) hang off it via composite ``(tenant_id, student_id)`` FKs.
"""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, uuid_pk


class Student(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "students"
    __table_args__ = (UniqueConstraint("tenant_id", "id", name="uq_students_tenant_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    student_number: Mapped[str] = mapped_column(String(20), nullable=False)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    preferred_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    lin: Mapped[str | None] = mapped_column(String(30), nullable=True)
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("classes.id"), nullable=True
    )
    stream_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("streams.id"), nullable=True
    )
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    date_of_birth: Mapped[dt.date | None] = mapped_column(Date, nullable=True)

    # Demographics
    nationality: Mapped[str | None] = mapped_column(String(60), nullable=True)
    religion: Mapped[str | None] = mapped_column(String(60), nullable=True)

    # Enrollment
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="enrolled")
    residence: Mapped[str | None] = mapped_column(String(20), nullable=True)  # day | boarder
    house: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # Boarding allocation (hostel add-on). Composite FKs added in migration 0028.
    hostel_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    hostel_room_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), nullable=True
    )
    admission_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    previous_school: Mapped[str | None] = mapped_column(String(160), nullable=True)

    # Contact / location
    home_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    village: Mapped[str | None] = mapped_column(String(120), nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class StudentGuardian(Base, TimestampMixin, SoftDeleteMixin):
    """A guardian/contact for a student; may optionally link to a portal login."""

    __tablename__ = "student_guardians"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "student_id"],
            ["students.tenant_id", "students.id"],
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    relationship: Mapped[str] = mapped_column(String(30), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    phone_primary: Mapped[str | None] = mapped_column(String(30), nullable=True)
    phone_alt: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    occupation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    national_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_emergency: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_pickup: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    portal_user_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)


class StudentHealth(Base, TimestampMixin, SoftDeleteMixin):
    """One health record per student (medical/emergency profile)."""

    __tablename__ = "student_health"
    __table_args__ = (
        UniqueConstraint("tenant_id", "student_id", name="uq_student_health_student"),
        ForeignKeyConstraint(
            ["tenant_id", "student_id"],
            ["students.tenant_id", "students.id"],
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    blood_group: Mapped[str | None] = mapped_column(String(5), nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    chronic_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    medications: Mapped[str | None] = mapped_column(Text, nullable=True)
    disabilities: Mapped[str | None] = mapped_column(Text, nullable=True)
    dietary_needs: Mapped[str | None] = mapped_column(String(255), nullable=True)
    doctor_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    doctor_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    insurance_provider: Mapped[str | None] = mapped_column(String(120), nullable=True)
    insurance_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    emergency_notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class StudentDisciplineRecord(Base, TimestampMixin, SoftDeleteMixin):
    """A discipline incident logged against a student."""

    __tablename__ = "student_discipline_records"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "student_id"],
            ["students.tenant_id", "students.id"],
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    incident_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    action_taken: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), nullable=True
    )
