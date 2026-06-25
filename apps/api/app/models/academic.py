"""Academic calendar — years + terms (§5.5). Seeded on onboard."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Date, ForeignKey, SmallInteger, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, pg_enum, uuid_pk
from app.models.enums import AcademicYearStatus, TermStatus


class AcademicYear(Base):
    __tablename__ = "academic_years"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(4), nullable=False)  # "2025"
    status: Mapped[AcademicYearStatus] = mapped_column(
        pg_enum(AcademicYearStatus), nullable=False, default=AcademicYearStatus.active
    )
    starts_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)


class Term(Base):
    __tablename__ = "terms"

    id: Mapped[uuid.UUID] = uuid_pk()
    # Denormalized tenant_id for RLS + tenant_id-leading index (§5.5).
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    term_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1..3
    label: Mapped[str] = mapped_column(String(20), nullable=False)
    starts_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    status: Mapped[TermStatus] = mapped_column(
        pg_enum(TermStatus), nullable=False, default=TermStatus.upcoming
    )
