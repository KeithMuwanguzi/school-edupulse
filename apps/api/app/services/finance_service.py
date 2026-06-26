"""Fee structures, invoicing, and manual payment recording — Phase 2 §12–§13."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError, ValidationError
from app.core.school_levels import ALL_LEVELS
from app.models.academic import Term
from app.models.finance import (
    FeeInvoice,
    FeeInvoiceLine,
    FeePayment,
    FeeStructure,
    FeeStructureLine,
)
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import Student
from app.schemas.finance import (
    FeeInvoiceDetailOut,
    FeeInvoiceLineOut,
    FeeInvoiceOut,
    FeePaymentCreate,
    FeePaymentOut,
    FeeStructureCreate,
    FeeStructureLineCreate,
    FeeStructureLineOut,
    FeeStructureLineUpdate,
    FeeStructureOut,
    FeeStructureUpdate,
    FinanceSummaryOut,
    InvoiceGenerateOut,
)
from app.services.term_registration_service import _resolve_term
from app.services.term_roster_service import registered_roster_summary, registered_students_stmt


def _norm_class_level(level: str | None) -> str | None:
    if level is None:
        return None
    return str(level).strip().upper()


def _line_applies(line: FeeStructureLine, class_level: str | None, residence: str | None) -> bool:
    if line.applies_to == "all":
        return True
    if line.applies_to == "class_level":
        student_level = _norm_class_level(class_level)
        line_level = _norm_class_level(line.class_level)
        return student_level is not None and student_level == line_level
    if line.applies_to == "day":
        return residence == "day"
    if line.applies_to == "boarder":
        return residence == "boarder"
    return False


def _applicable_structure_lines(
    structure: FeeStructure,
    class_level: str | None,
    residence: str | None,
) -> list[FeeStructureLine]:
    return [
        ln
        for ln in sorted(structure.lines, key=lambda x: (x.sort_order, x.label))
        if _line_applies(ln, class_level, residence) and not ln.is_optional
    ]


async def _write_invoice_lines(
    session: AsyncSession,
    tenant_id: UUID,
    invoice: FeeInvoice,
    applicable: list[FeeStructureLine],
    *,
    replace_existing: bool = False,
) -> int:
    if replace_existing:
        await session.execute(
            delete(FeeInvoiceLine).where(
                FeeInvoiceLine.tenant_id == tenant_id,
                FeeInvoiceLine.invoice_id == invoice.id,
            )
        )
        await session.flush()
    total = 0
    for ln in applicable:
        session.add(
            FeeInvoiceLine(
                tenant_id=tenant_id,
                invoice_id=invoice.id,
                label=ln.label,
                amount_ugx=ln.amount_ugx,
                sort_order=ln.sort_order,
            )
        )
        total += ln.amount_ugx
    return total


def _invoice_status(total: int, paid: int, current: str) -> str:
    if current == "waived":
        return "waived"
    if paid <= 0:
        return "unpaid"
    if paid >= total:
        return "paid"
    return "partial"


def _is_overdue(status: str, due_on: dt.date | None) -> bool:
    if status in {"paid", "waived"} or due_on is None:
        return False
    return due_on < dt.date.today()


async def _load_structure(
    session: AsyncSession, tenant_id: UUID, structure_id: UUID
) -> FeeStructure:
    structure = await session.scalar(
        select(FeeStructure)
        .options(selectinload(FeeStructure.lines))
        .where(
            FeeStructure.tenant_id == tenant_id,
            FeeStructure.id == structure_id,
        )
    )
    if structure is None:
        raise NotFoundError("Fee structure not found.")
    return structure


async def _term_label(session: AsyncSession, tenant_id: UUID, term_id: UUID) -> str:
    term = await session.scalar(
        select(Term).where(Term.tenant_id == tenant_id, Term.id == term_id)
    )
    return term.label if term else "Term"


def _catalog_total(structure: FeeStructure) -> int:
    return sum(ln.amount_ugx for ln in structure.lines if not ln.is_optional)


def _level_base_amount(structure: FeeStructure, level: str) -> int:
    """Per-student amount for a class level (all + matching class_level lines only)."""
    total = 0
    norm = _norm_class_level(level)
    for ln in structure.lines:
        if ln.is_optional:
            continue
        if ln.applies_to == "all":
            total += ln.amount_ugx
        elif ln.applies_to == "class_level" and _norm_class_level(ln.class_level) == norm:
            total += ln.amount_ugx
    return total


async def _structure_projection(
    session: AsyncSession,
    tenant_id: UUID,
    term_id: UUID,
    structure: FeeStructure,
) -> tuple[dict[str, int], int]:
    level_amounts = {
        level.value: _level_base_amount(structure, level.value) for level in ALL_LEVELS
    }
    level_amounts = {k: v for k, v in level_amounts.items() if v > 0}

    students = list(await session.scalars(registered_students_stmt(tenant_id, term_id)))
    expected = 0
    for student in students:
        class_level, _, residence = await _student_context(session, tenant_id, student)
        applicable = _applicable_structure_lines(structure, class_level, residence)
        expected += sum(ln.amount_ugx for ln in applicable)
    return level_amounts, expected


async def _structure_out(
    session: AsyncSession,
    tenant_id: UUID,
    structure: FeeStructure,
    term_label: str,
) -> FeeStructureOut:
    lines = sorted(structure.lines, key=lambda ln: (ln.sort_order, ln.label))
    catalog = _catalog_total(structure)
    level_amounts, expected = await _structure_projection(
        session, tenant_id, structure.term_id, structure
    )
    return FeeStructureOut(
        id=structure.id,
        term_id=structure.term_id,
        term_label=term_label,
        name=structure.name,
        status=structure.status,
        due_on=structure.due_on,
        notes=structure.notes,
        activated_at=structure.activated_at,
        line_count=len(lines),
        total_ugx=catalog,
        catalog_total_ugx=catalog,
        expected_invoiced_ugx=expected,
        level_amounts_ugx=level_amounts,
        lines=[
            FeeStructureLineOut(
                id=ln.id,
                label=ln.label,
                amount_ugx=ln.amount_ugx,
                applies_to=ln.applies_to,
                class_level=ln.class_level,
                sort_order=ln.sort_order,
                is_optional=ln.is_optional,
            )
            for ln in lines
        ],
    )


async def list_structures(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID | None = None,
) -> list[FeeStructureOut]:
    term = await _resolve_term(session, tenant_id, term_id)
    rows = list(
        await session.scalars(
            select(FeeStructure)
            .options(selectinload(FeeStructure.lines))
            .where(FeeStructure.tenant_id == tenant_id, FeeStructure.term_id == term.id)
            .order_by(FeeStructure.created_at.desc())
        )
    )
    return [await _structure_out(session, tenant_id, s, term.label) for s in rows]


async def create_structure(
    session: AsyncSession,
    tenant_id: UUID,
    body: FeeStructureCreate,
) -> FeeStructureOut:
    term = await _resolve_term(session, tenant_id, body.term_id)
    structure = FeeStructure(
        tenant_id=tenant_id,
        term_id=term.id,
        name=body.name.strip(),
        status="draft",
        due_on=body.due_on,
        notes=body.notes,
    )
    session.add(structure)
    await session.flush()
    await session.refresh(structure, ["lines"])
    return await _structure_out(session, tenant_id, structure, term.label)


async def update_structure(
    session: AsyncSession,
    tenant_id: UUID,
    structure_id: UUID,
    body: FeeStructureUpdate,
) -> FeeStructureOut:
    structure = await _load_structure(session, tenant_id, structure_id)
    if structure.status != "draft":
        raise ValidationError("Only draft fee structures can be edited.")
    if body.name is not None:
        structure.name = body.name.strip()
    if body.due_on is not None or "due_on" in body.model_fields_set:
        structure.due_on = body.due_on
    if body.notes is not None or "notes" in body.model_fields_set:
        structure.notes = body.notes
    await session.flush()
    term_label = await _term_label(session, tenant_id, structure.term_id)
    return await _structure_out(session, tenant_id, structure, term_label)


async def activate_structure(
    session: AsyncSession,
    tenant_id: UUID,
    structure_id: UUID,
) -> FeeStructureOut:
    structure = await _load_structure(session, tenant_id, structure_id)
    if structure.status != "draft":
        raise ValidationError("Only draft fee structures can be activated.")
    if not structure.lines:
        raise ValidationError("Add at least one fee line before activating.")
    active = await session.scalar(
        select(FeeStructure).where(
            FeeStructure.tenant_id == tenant_id,
            FeeStructure.term_id == structure.term_id,
            FeeStructure.status == "active",
            FeeStructure.id != structure.id,
        )
    )
    if active is not None:
        active.status = "archived"
    structure.status = "active"
    structure.activated_at = dt.datetime.now(dt.UTC)
    await session.flush()
    term_label = await _term_label(session, tenant_id, structure.term_id)
    return await _structure_out(session, tenant_id, structure, term_label)


async def add_structure_line(
    session: AsyncSession,
    tenant_id: UUID,
    structure_id: UUID,
    body: FeeStructureLineCreate,
) -> FeeStructureOut:
    structure = await _load_structure(session, tenant_id, structure_id)
    if structure.status != "draft":
        raise ValidationError("Fee lines can only be added to draft structures.")
    sort_order = body.sort_order
    if sort_order is None:
        sort_order = max((ln.sort_order for ln in structure.lines), default=-1) + 1
    line = FeeStructureLine(
        tenant_id=tenant_id,
        structure_id=structure.id,
        label=body.label.strip(),
        amount_ugx=body.amount_ugx,
        applies_to=body.applies_to,
        class_level=body.class_level,
        sort_order=sort_order,
        is_optional=body.is_optional,
    )
    session.add(line)
    await session.flush()
    await session.refresh(structure, ["lines"])
    term_label = await _term_label(session, tenant_id, structure.term_id)
    return await _structure_out(session, tenant_id, structure, term_label)


async def update_structure_line(
    session: AsyncSession,
    tenant_id: UUID,
    structure_id: UUID,
    line_id: UUID,
    body: FeeStructureLineUpdate,
) -> FeeStructureOut:
    structure = await _load_structure(session, tenant_id, structure_id)
    if structure.status != "draft":
        raise ValidationError("Fee lines can only be edited on draft structures.")
    line = next((ln for ln in structure.lines if ln.id == line_id), None)
    if line is None:
        raise NotFoundError("Fee line not found.")
    if body.label is not None:
        line.label = body.label.strip()
    if body.amount_ugx is not None:
        line.amount_ugx = body.amount_ugx
    if body.applies_to is not None:
        line.applies_to = body.applies_to
    if body.class_level is not None or "class_level" in body.model_fields_set:
        line.class_level = body.class_level
    if body.sort_order is not None:
        line.sort_order = body.sort_order
    if body.is_optional is not None:
        line.is_optional = body.is_optional
    await session.flush()
    term_label = await _term_label(session, tenant_id, structure.term_id)
    return await _structure_out(session, tenant_id, structure, term_label)


async def delete_structure_line(
    session: AsyncSession,
    tenant_id: UUID,
    structure_id: UUID,
    line_id: UUID,
) -> FeeStructureOut:
    structure = await _load_structure(session, tenant_id, structure_id)
    if structure.status != "draft":
        raise ValidationError("Fee lines can only be removed from draft structures.")
    line = next((ln for ln in structure.lines if ln.id == line_id), None)
    if line is None:
        raise NotFoundError("Fee line not found.")
    await session.delete(line)
    await session.flush()
    await session.refresh(structure, ["lines"])
    term_label = await _term_label(session, tenant_id, structure.term_id)
    return await _structure_out(session, tenant_id, structure, term_label)


async def _student_context(
    session: AsyncSession, tenant_id: UUID, student: Student
) -> tuple[str | None, str | None, str | None]:
    class_level: str | None = None
    class_label: str | None = None
    if student.class_id:
        school_class = await session.scalar(
            select(SchoolClass).where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.id == student.class_id,
            )
        )
        if school_class:
            class_level = school_class.level.value
            class_label = school_class.label
            if student.stream_id:
                stream = await session.scalar(
                    select(ClassStream).where(
                        ClassStream.tenant_id == tenant_id,
                        ClassStream.id == student.stream_id,
                    )
                )
                if stream:
                    class_label = f"{school_class.label} {stream.name}"
    return class_level, class_label, student.residence


async def _next_invoice_number(
    session: AsyncSession, tenant_id: UUID, term: Term
) -> str:
    count = int(
        await session.scalar(
            select(func.count())
            .select_from(FeeInvoice)
            .where(FeeInvoice.tenant_id == tenant_id, FeeInvoice.term_id == term.id)
        )
        or 0
    )
    return f"T{term.term_number}-{count + 1:04d}"


async def generate_invoices(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID | None = None,
    refresh_unpaid: bool = False,
) -> InvoiceGenerateOut:
    term = await _resolve_term(session, tenant_id, term_id)
    structure = await session.scalar(
        select(FeeStructure)
        .options(selectinload(FeeStructure.lines))
        .where(
            FeeStructure.tenant_id == tenant_id,
            FeeStructure.term_id == term.id,
            FeeStructure.status == "active",
        )
    )
    if structure is None:
        raise ValidationError("Activate a fee structure for this term before generating invoices.")

    students = list(
        await session.scalars(registered_students_stmt(tenant_id, term.id))
    )
    if not students:
        raise ValidationError("No registered students found for this term.")

    existing_invoices = {
        inv.student_id: inv
        for inv in await session.scalars(
            select(FeeInvoice).where(
                FeeInvoice.tenant_id == tenant_id,
                FeeInvoice.term_id == term.id,
            )
        )
    }

    created = 0
    skipped = 0
    refreshed = 0
    for student in students:
        class_level, _, residence = await _student_context(session, tenant_id, student)
        applicable = _applicable_structure_lines(structure, class_level, residence)
        total = sum(ln.amount_ugx for ln in applicable)

        existing = existing_invoices.get(student.id)
        if existing is not None:
            if (
                refresh_unpaid
                and existing.amount_paid_ugx == 0
                and existing.status == "unpaid"
            ):
                existing.structure_id = structure.id
                existing.due_on = structure.due_on
                existing.total_ugx = await _write_invoice_lines(
                    session, tenant_id, existing, applicable, replace_existing=True
                )
                existing.status = "unpaid" if existing.total_ugx > 0 else "paid"
                refreshed += 1
            else:
                skipped += 1
            continue

        invoice = FeeInvoice(
            tenant_id=tenant_id,
            student_id=student.id,
            term_id=term.id,
            structure_id=structure.id,
            invoice_number=await _next_invoice_number(session, tenant_id, term),
            total_ugx=total,
            amount_paid_ugx=0,
            status="unpaid" if total > 0 else "paid",
            issued_at=dt.datetime.now(dt.UTC),
            due_on=structure.due_on,
        )
        session.add(invoice)
        await session.flush()
        await _write_invoice_lines(session, tenant_id, invoice, applicable)
        created += 1

    await session.flush()
    return InvoiceGenerateOut(
        created=created,
        skipped_existing=skipped,
        refreshed=refreshed,
        term_id=term.id,
    )


async def _invoice_out(
    session: AsyncSession,
    tenant_id: UUID,
    invoice: FeeInvoice,
    *,
    student: Student | None = None,
    term: Term | None = None,
) -> FeeInvoiceOut:
    if student is None:
        student = await session.scalar(
            select(Student).where(
                Student.tenant_id == tenant_id,
                Student.id == invoice.student_id,
            )
        )
    if term is None:
        term = await session.scalar(
            select(Term).where(Term.tenant_id == tenant_id, Term.id == invoice.term_id)
        )
    _, class_label, _ = await _student_context(session, tenant_id, student) if student else (None, None, None)
    balance = max(invoice.total_ugx - invoice.amount_paid_ugx, 0)
    return FeeInvoiceOut(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        student_id=invoice.student_id,
        student_number=student.student_number if student else "",
        first_name=student.first_name if student else "",
        last_name=student.last_name if student else "",
        class_label=class_label,
        term_id=invoice.term_id,
        term_label=term.label if term else "",
        total_ugx=invoice.total_ugx,
        amount_paid_ugx=invoice.amount_paid_ugx,
        balance_ugx=balance,
        status=invoice.status,
        is_overdue=_is_overdue(invoice.status, invoice.due_on),
        issued_at=invoice.issued_at,
        due_on=invoice.due_on,
    )


async def list_invoices(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID | None = None,
    status: str | None = None,
    class_id: UUID | None = None,
    q: str | None = None,
    limit: int = 200,
) -> list[FeeInvoiceOut]:
    term = await _resolve_term(session, tenant_id, term_id)
    stmt = (
        select(FeeInvoice, Student)
        .join(
            Student,
            (Student.id == FeeInvoice.student_id) & (Student.tenant_id == FeeInvoice.tenant_id),
        )
        .where(FeeInvoice.tenant_id == tenant_id, FeeInvoice.term_id == term.id)
        .order_by(Student.student_number, FeeInvoice.invoice_number)
        .limit(limit)
    )
    if status:
        if status == "overdue":
            stmt = stmt.where(
                FeeInvoice.status.notin_(["paid", "waived"]),
                FeeInvoice.due_on.isnot(None),
                FeeInvoice.due_on < dt.date.today(),
            )
        else:
            stmt = stmt.where(FeeInvoice.status == status)
    if class_id:
        stmt = stmt.where(Student.class_id == class_id)
    if q:
        needle = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Student.first_name.ilike(needle),
                Student.last_name.ilike(needle),
                Student.student_number.ilike(needle),
                FeeInvoice.invoice_number.ilike(needle),
            )
        )
    rows = list(await session.execute(stmt))
    return [await _invoice_out(session, tenant_id, inv, student=stu, term=term) for inv, stu in rows]


async def get_invoice(
    session: AsyncSession,
    tenant_id: UUID,
    invoice_id: UUID,
) -> FeeInvoiceDetailOut:
    invoice = await session.scalar(
        select(FeeInvoice)
        .options(
            selectinload(FeeInvoice.lines),
            selectinload(FeeInvoice.payments),
        )
        .where(FeeInvoice.tenant_id == tenant_id, FeeInvoice.id == invoice_id)
    )
    if invoice is None:
        raise NotFoundError("Invoice not found.")
    structure = await session.scalar(
        select(FeeStructure).where(
            FeeStructure.tenant_id == tenant_id,
            FeeStructure.id == invoice.structure_id,
        )
    )
    summary = await _invoice_out(session, tenant_id, invoice)
    return FeeInvoiceDetailOut(
        **summary.model_dump(),
        structure_id=invoice.structure_id,
        structure_name=structure.name if structure else "",
        lines=[
            FeeInvoiceLineOut(
                id=ln.id,
                label=ln.label,
                amount_ugx=ln.amount_ugx,
                sort_order=ln.sort_order,
            )
            for ln in sorted(invoice.lines, key=lambda x: (x.sort_order, x.label))
        ],
        payments=[
            FeePaymentOut(
                id=p.id,
                amount_ugx=p.amount_ugx,
                method=p.method,
                reference=p.reference,
                paid_on=p.paid_on,
                note=p.note,
                recorded_by_user_id=p.recorded_by_user_id,
                created_at=p.created_at,
            )
            for p in invoice.payments
        ],
    )


async def record_payment(
    session: AsyncSession,
    tenant_id: UUID,
    invoice_id: UUID,
    body: FeePaymentCreate,
    *,
    recorded_by_user_id: UUID,
) -> FeeInvoiceDetailOut:
    invoice = await session.scalar(
        select(FeeInvoice)
        .options(selectinload(FeeInvoice.lines), selectinload(FeeInvoice.payments))
        .where(FeeInvoice.tenant_id == tenant_id, FeeInvoice.id == invoice_id)
    )
    if invoice is None:
        raise NotFoundError("Invoice not found.")
    if invoice.status == "waived":
        raise ValidationError("Cannot record payments on a waived invoice.")
    balance = invoice.total_ugx - invoice.amount_paid_ugx
    if body.amount_ugx > balance:
        raise ValidationError(f"Payment exceeds outstanding balance of {balance:,} UGX.")

    payment = FeePayment(
        tenant_id=tenant_id,
        invoice_id=invoice.id,
        amount_ugx=body.amount_ugx,
        method=body.method,
        reference=body.reference,
        paid_on=body.paid_on or dt.date.today(),
        note=body.note,
        recorded_by_user_id=recorded_by_user_id,
    )
    session.add(payment)
    invoice.amount_paid_ugx += body.amount_ugx
    invoice.status = _invoice_status(invoice.total_ugx, invoice.amount_paid_ugx, invoice.status)
    await session.flush()
    await session.refresh(invoice, attribute_names=["payments", "lines"])
    return await get_invoice(session, tenant_id, invoice_id)


async def finance_summary(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    term_id: UUID | None = None,
    class_id: UUID | None = None,
) -> FinanceSummaryOut:
    term = await _resolve_term(session, tenant_id, term_id)
    roster = await registered_roster_summary(session, tenant_id, term_id=term.id)

    class_label: str | None = None
    registered_count = roster.total_registered
    if class_id is not None:
        match = next((c for c in roster.classes if c.class_id == class_id), None)
        if match is None:
            school_class = await session.scalar(
                select(SchoolClass).where(
                    SchoolClass.tenant_id == tenant_id,
                    SchoolClass.id == class_id,
                    SchoolClass.deleted_at.is_(None),
                )
            )
            if school_class is None:
                raise NotFoundError("Class not found.")
            class_label = f"{school_class.level.value} · {school_class.label}"
            registered_count = 0
        else:
            class_label = f"{match.level} · {match.label}"
            registered_count = match.count

    invoice_stmt = select(FeeInvoice).where(
        FeeInvoice.tenant_id == tenant_id,
        FeeInvoice.term_id == term.id,
    )
    if class_id is not None:
        invoice_stmt = invoice_stmt.join(
            Student,
            (Student.id == FeeInvoice.student_id) & (Student.tenant_id == FeeInvoice.tenant_id),
        ).where(Student.class_id == class_id)

    invoices = list(await session.scalars(invoice_stmt))

    active_structure = await session.scalar(
        select(FeeStructure)
        .options(selectinload(FeeStructure.lines))
        .where(
            FeeStructure.tenant_id == tenant_id,
            FeeStructure.term_id == term.id,
            FeeStructure.status == "active",
        )
    )

    expected_invoiced: int | None = None
    if active_structure is not None:
        if class_id is not None:
            students = list(
                await session.scalars(
                    registered_students_stmt(tenant_id, term.id, class_id=class_id)
                )
            )
            expected_invoiced = 0
            for student in students:
                class_level, _, residence = await _student_context(session, tenant_id, student)
                applicable = _applicable_structure_lines(
                    active_structure, class_level, residence
                )
                expected_invoiced += sum(ln.amount_ugx for ln in applicable)
        else:
            _, expected_invoiced = await _structure_projection(
                session, tenant_id, term.id, active_structure
            )

    counts = {"unpaid": 0, "partial": 0, "paid": 0, "waived": 0, "overdue": 0}
    total_invoiced = 0
    total_collected = 0
    for inv in invoices:
        total_invoiced += inv.total_ugx
        total_collected += inv.amount_paid_ugx
        if inv.status in counts:
            counts[inv.status] += 1
        if _is_overdue(inv.status, inv.due_on):
            counts["overdue"] += 1

    return FinanceSummaryOut(
        term_id=term.id,
        term_label=term.label,
        active_structure_id=active_structure.id if active_structure else None,
        active_structure_name=active_structure.name if active_structure else None,
        class_id=class_id,
        class_label=class_label,
        registered_count=registered_count,
        invoiced_count=len(invoices),
        not_invoiced_count=max(registered_count - len(invoices), 0),
        total_invoiced_ugx=total_invoiced,
        total_collected_ugx=total_collected,
        total_outstanding_ugx=max(total_invoiced - total_collected, 0),
        expected_invoiced_ugx=expected_invoiced,
        counts=counts,
    )
