"""Declarative base + shared mixins."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, Enum, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.models.enums import PG_ENUM_NAMES


class Base(DeclarativeBase):
    pass


def pg_enum(enum_cls):
    """Native PG enum bound to the type created by the migration (create_type=False)."""
    return Enum(
        enum_cls,
        name=PG_ENUM_NAMES[enum_cls],
        native_enum=True,
        create_type=False,
        values_callable=lambda e: [m.value for m in e],
    )


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class TimestampMixin:
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    deleted_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
