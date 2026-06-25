"""Uganda geographic hierarchy (EMIS-aligned) — §2.2. Platform reference data."""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid_pk


class Region(Base):
    __tablename__ = "regions"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)


class District(Base):
    __tablename__ = "districts"

    id: Mapped[uuid.UUID] = uuid_pk()
    region_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("regions.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str | None] = mapped_column(String(16), nullable=True)


class County(Base):
    __tablename__ = "counties"

    id: Mapped[uuid.UUID] = uuid_pk()
    district_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("districts.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)


class SubCounty(Base):
    __tablename__ = "sub_counties"

    id: Mapped[uuid.UUID] = uuid_pk()
    county_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("counties.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)


class Parish(Base):
    __tablename__ = "parishes"

    id: Mapped[uuid.UUID] = uuid_pk()
    sub_county_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("sub_counties.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
