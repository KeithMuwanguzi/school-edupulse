"""Academic calendar — seed on onboard + tenant self-service (Phase 2 §1)."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.academic import AcademicYear, Term
from app.models.enums import AcademicYearStatus, TermStatus
from app.schemas.academic import (
    AcademicContextEnriched,
    AcademicYearCreate,
    AcademicYearUpdate,
    AcademicYearWithTerms,
    TermUpdate,
)
from app.schemas.school import AcademicYearOut, TermOut

# MoES term template: (term_number, label, (start_month, start_day), (end_month, end_day))
TERM_TEMPLATE = [
    (1, "Term 1", (2, 1), (5, 2)),
    (2, "Term 2", (5, 26), (8, 22)),
    (3, "Term 3", (9, 15), (12, 5)),
]


def _year_out(ay: AcademicYear) -> AcademicYearOut:
    return AcademicYearOut(
        id=ay.id,
        label=ay.label,
        status=ay.status.value,
        starts_on=ay.starts_on,
        ends_on=ay.ends_on,
    )


def _term_out(term: Term) -> TermOut:
    return TermOut(
        id=term.id,
        term_number=term.term_number,
        label=term.label,
        status=term.status.value,
        starts_on=term.starts_on,
        ends_on=term.ends_on,
    )


def _year_with_terms(ay: AcademicYear, terms: list[Term]) -> AcademicYearWithTerms:
    return AcademicYearWithTerms(
        **_year_out(ay).model_dump(),
        terms=[_term_out(t) for t in sorted(terms, key=lambda x: x.term_number)],
    )


def _validate_dates(starts_on: dt.date | None, ends_on: dt.date | None) -> None:
    if starts_on and ends_on and ends_on < starts_on:
        raise ValidationError("End date must be on or after start date.")


async def _get_year(session: AsyncSession, tenant_id: UUID, year_id: UUID) -> AcademicYear:
    ay = await session.scalar(
        select(AcademicYear).where(
            AcademicYear.id == year_id,
            AcademicYear.tenant_id == tenant_id,
        )
    )
    if ay is None:
        raise NotFoundError("Academic year not found.")
    return ay


async def _get_term(
    session: AsyncSession, tenant_id: UUID, year_id: UUID, term_id: UUID
) -> Term:
    term = await session.scalar(
        select(Term).where(
            Term.id == term_id,
            Term.tenant_id == tenant_id,
            Term.academic_year_id == year_id,
        )
    )
    if term is None:
        raise NotFoundError("Term not found.")
    return term


async def _terms_for_year(session: AsyncSession, tenant_id: UUID, year_id: UUID) -> list[Term]:
    rows = await session.scalars(
        select(Term)
        .where(Term.tenant_id == tenant_id, Term.academic_year_id == year_id)
        .order_by(Term.term_number)
    )
    return list(rows)


async def seed_calendar(
    session: AsyncSession, tenant_id: UUID, year: int, today: dt.date | None = None
) -> tuple[AcademicYear, Term | None]:
    """Create the first academic year + MoES 3-term template (onboard)."""
    today = today or dt.date.today()
    ay = AcademicYear(
        tenant_id=tenant_id,
        label=str(year),
        status=AcademicYearStatus.active,
        starts_on=dt.date(year, 1, 1),
        ends_on=dt.date(year, 12, 31),
    )
    session.add(ay)
    await session.flush()
    active_term = await _seed_terms(session, tenant_id, ay, year, today)
    return ay, active_term


async def _seed_terms(
    session: AsyncSession,
    tenant_id: UUID,
    ay: AcademicYear,
    year: int,
    today: dt.date | None = None,
) -> Term | None:
    today = today or dt.date.today()
    active_term: Term | None = None
    for number, label, (sm, sd), (em, ed) in TERM_TEMPLATE:
        starts = dt.date(year, sm, sd)
        ends = dt.date(year, em, ed)
        if today < starts:
            status = TermStatus.upcoming
        elif starts <= today <= ends:
            status = TermStatus.active
        else:
            status = TermStatus.closed
        term = Term(
            tenant_id=tenant_id,
            academic_year_id=ay.id,
            term_number=number,
            label=label,
            starts_on=starts,
            ends_on=ends,
            status=status,
        )
        session.add(term)
        if status == TermStatus.active:
            active_term = term
    await session.flush()
    return active_term


async def list_years(session: AsyncSession, tenant_id: UUID) -> list[AcademicYearWithTerms]:
    result: list[AcademicYearWithTerms] = []
    year_list = list(
        await session.scalars(
            select(AcademicYear)
            .where(AcademicYear.tenant_id == tenant_id)
            .order_by(AcademicYear.label.desc())
        )
    )
    for ay in year_list:
        terms = await _terms_for_year(session, tenant_id, ay.id)
        result.append(_year_with_terms(ay, terms))
    return result


async def create_year(
    session: AsyncSession, tenant_id: UUID, body: AcademicYearCreate
) -> AcademicYearWithTerms:
    existing = await session.scalar(
        select(AcademicYear).where(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.label == body.label,
        )
    )
    if existing:
        raise ConflictError(f"Academic year {body.label} already exists for this school.")

    year = int(body.label)
    ay = AcademicYear(
        tenant_id=tenant_id,
        label=body.label,
        status=AcademicYearStatus.upcoming,
        starts_on=dt.date(year, 1, 1),
        ends_on=dt.date(year, 12, 31),
    )
    session.add(ay)
    await session.flush()
    await _seed_terms(session, tenant_id, ay, year)
    terms = await _terms_for_year(session, tenant_id, ay.id)
    return _year_with_terms(ay, terms)


async def update_year(
    session: AsyncSession, tenant_id: UUID, year_id: UUID, body: AcademicYearUpdate
) -> AcademicYearWithTerms:
    ay = await _get_year(session, tenant_id, year_id)
    starts = body.starts_on if body.starts_on is not None else ay.starts_on
    ends = body.ends_on if body.ends_on is not None else ay.ends_on
    _validate_dates(starts, ends)

    if body.starts_on is not None:
        ay.starts_on = body.starts_on
    if body.ends_on is not None:
        ay.ends_on = body.ends_on
    if body.status is not None:
        ay.status = AcademicYearStatus(body.status)

    terms = await _terms_for_year(session, tenant_id, ay.id)
    return _year_with_terms(ay, terms)


async def activate_year(
    session: AsyncSession, tenant_id: UUID, year_id: UUID
) -> AcademicYearWithTerms:
    ay = await _get_year(session, tenant_id, year_id)

    await session.execute(
        update(AcademicYear)
        .where(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.id != year_id,
            AcademicYear.status == AcademicYearStatus.active,
        )
        .values(status=AcademicYearStatus.archived)
    )
    ay.status = AcademicYearStatus.active

    active_term = await session.scalar(
        select(Term).where(Term.tenant_id == tenant_id, Term.status == TermStatus.active)
    )
    if active_term is None or active_term.academic_year_id != ay.id:
        # Promote the first upcoming term in this year, else term 1.
        term = await session.scalar(
            select(Term)
            .where(Term.tenant_id == tenant_id, Term.academic_year_id == ay.id)
            .order_by(Term.term_number)
        )
        if term:
            await session.execute(
                update(Term)
                .where(Term.tenant_id == tenant_id, Term.status == TermStatus.active)
                .values(status=TermStatus.closed)
            )
            term.status = TermStatus.active

    terms = await _terms_for_year(session, tenant_id, ay.id)
    return _year_with_terms(ay, terms)


async def update_term(
    session: AsyncSession,
    tenant_id: UUID,
    year_id: UUID,
    term_id: UUID,
    body: TermUpdate,
) -> TermOut:
    term = await _get_term(session, tenant_id, year_id, term_id)
    starts = body.starts_on if body.starts_on is not None else term.starts_on
    ends = body.ends_on if body.ends_on is not None else term.ends_on
    _validate_dates(starts, ends)

    if body.label is not None:
        term.label = body.label
    if body.starts_on is not None:
        term.starts_on = body.starts_on
    if body.ends_on is not None:
        term.ends_on = body.ends_on
    if body.status is not None:
        term.status = TermStatus(body.status)

    return _term_out(term)


async def activate_term(
    session: AsyncSession, tenant_id: UUID, year_id: UUID, term_id: UUID
) -> TermOut:
    term = await _get_term(session, tenant_id, year_id, term_id)
    ay = await _get_year(session, tenant_id, year_id)

    await session.execute(
        update(Term)
        .where(Term.tenant_id == tenant_id, Term.status == TermStatus.active)
        .values(status=TermStatus.closed)
    )
    term.status = TermStatus.active

    if ay.status != AcademicYearStatus.active:
        await session.execute(
            update(AcademicYear)
            .where(
                AcademicYear.tenant_id == tenant_id,
                AcademicYear.id != year_id,
                AcademicYear.status == AcademicYearStatus.active,
            )
            .values(status=AcademicYearStatus.archived)
        )
        ay.status = AcademicYearStatus.active

    return _term_out(term)


async def get_context(session: AsyncSession, tenant_id: UUID) -> AcademicContextEnriched:
    year = await session.scalar(
        select(AcademicYear).where(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.status == AcademicYearStatus.active,
        )
    )
    term = await session.scalar(
        select(Term).where(Term.tenant_id == tenant_id, Term.status == TermStatus.active)
    )
    terms: list[TermOut] = []
    if year:
        rows = await _terms_for_year(session, tenant_id, year.id)
        terms = [_term_out(t) for t in rows]

    return AcademicContextEnriched(
        academic_year=_year_out(year) if year else None,
        active_term=_term_out(term) if term else None,
        terms=terms,
    )
