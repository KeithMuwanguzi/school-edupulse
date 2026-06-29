"""Term calendar — school programme dates within a term."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.models.academic import Term, TermCalendarEvent
from app.models.enums import TermCalendarEventType
from app.schemas.term_calendar import (
    TermCalendarEventCreate,
    TermCalendarEventOut,
    TermCalendarEventUpdate,
)
from app.services.academic_service import _get_term


def _event_out(event: TermCalendarEvent, term: Term) -> TermCalendarEventOut:
    return TermCalendarEventOut(
        id=event.id,
        academic_year_id=event.academic_year_id,
        term_id=event.term_id,
        term_number=term.term_number,
        term_label=term.label,
        event_type=event.event_type.value,
        title=event.title,
        starts_on=event.starts_on,
        ends_on=event.ends_on,
        description=event.description,
    )


def _validate_within_term(
    term: Term,
    starts_on: dt.date,
    ends_on: dt.date,
) -> None:
    if term.starts_on and starts_on < term.starts_on:
        raise ValidationError(
            f"Event cannot start before {term.label} opens ({term.starts_on.isoformat()})."
        )
    if term.ends_on and ends_on > term.ends_on:
        raise ValidationError(
            f"Event cannot end after {term.label} closes ({term.ends_on.isoformat()})."
        )


async def _get_event(
    session: AsyncSession,
    tenant_id: UUID,
    year_id: UUID,
    term_id: UUID,
    event_id: UUID,
) -> tuple[TermCalendarEvent, Term]:
    term = await _get_term(session, tenant_id, year_id, term_id)
    event = await session.scalar(
        select(TermCalendarEvent).where(
            TermCalendarEvent.id == event_id,
            TermCalendarEvent.tenant_id == tenant_id,
            TermCalendarEvent.term_id == term_id,
            TermCalendarEvent.academic_year_id == year_id,
            TermCalendarEvent.deleted_at.is_(None),
        )
    )
    if event is None:
        raise NotFoundError("Calendar event not found.")
    return event, term


async def list_year_events(
    session: AsyncSession,
    tenant_id: UUID,
    year_id: UUID,
    *,
    term_id: UUID | None = None,
) -> list[TermCalendarEventOut]:
    stmt = (
        select(TermCalendarEvent, Term)
        .join(Term, Term.id == TermCalendarEvent.term_id)
        .where(
            TermCalendarEvent.tenant_id == tenant_id,
            TermCalendarEvent.academic_year_id == year_id,
            TermCalendarEvent.deleted_at.is_(None),
        )
        .order_by(TermCalendarEvent.starts_on, TermCalendarEvent.title)
    )
    if term_id is not None:
        stmt = stmt.where(TermCalendarEvent.term_id == term_id)

    rows = list(await session.execute(stmt))
    return [_event_out(event, term) for event, term in rows]


async def create_event(
    session: AsyncSession,
    tenant_id: UUID,
    year_id: UUID,
    term_id: UUID,
    body: TermCalendarEventCreate,
) -> TermCalendarEventOut:
    term = await _get_term(session, tenant_id, year_id, term_id)
    _validate_within_term(term, body.starts_on, body.ends_on)

    event = TermCalendarEvent(
        tenant_id=tenant_id,
        academic_year_id=year_id,
        term_id=term_id,
        event_type=TermCalendarEventType(body.event_type),
        title=body.title.strip(),
        starts_on=body.starts_on,
        ends_on=body.ends_on,
        description=body.description.strip() if body.description else None,
    )
    session.add(event)
    await session.flush()
    return _event_out(event, term)


async def update_event(
    session: AsyncSession,
    tenant_id: UUID,
    year_id: UUID,
    term_id: UUID,
    event_id: UUID,
    body: TermCalendarEventUpdate,
) -> TermCalendarEventOut:
    event, term = await _get_event(session, tenant_id, year_id, term_id, event_id)

    starts = body.starts_on if body.starts_on is not None else event.starts_on
    ends = body.ends_on if body.ends_on is not None else event.ends_on
    if ends < starts:
        raise ValidationError("End date must be on or after start date.")
    _validate_within_term(term, starts, ends)

    if body.event_type is not None:
        event.event_type = TermCalendarEventType(body.event_type)
    if body.title is not None:
        event.title = body.title.strip()
    if body.starts_on is not None:
        event.starts_on = body.starts_on
    if body.ends_on is not None:
        event.ends_on = body.ends_on
    if body.description is not None:
        event.description = body.description.strip() or None

    return _event_out(event, term)


async def delete_event(
    session: AsyncSession,
    tenant_id: UUID,
    year_id: UUID,
    term_id: UUID,
    event_id: UUID,
) -> None:
    event, _ = await _get_event(session, tenant_id, year_id, term_id, event_id)
    event.deleted_at = dt.datetime.now(dt.UTC)
