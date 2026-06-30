"""Parent portal — one shared login per pupil (login_id = student_number)."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.models.academic import AcademicYear, Term
from app.models.enums import AcademicYearStatus, TermStatus
from app.models.finance import FeeInvoice
from app.models.school_class import ClassStream, SchoolClass
from app.models.student import Student, StudentGuardian
from app.models.user import Role, TenantUser
from app.schemas.parent import (
    ParentChildOut,
    ParentFeeSummaryOut,
    ParentGuardianContactOut,
    ParentPortalOverviewOut,
)
from app.services import circular_service
from app.services.attendance_service import _active_term, _active_year, _term_rate
from app.services.finance_service import _is_overdue
from app.services.parent_student import resolve_parent_student
from app.services.tenant_user_service import _school_code


async def _child_out(session: AsyncSession, tenant_id: UUID, student: Student) -> ParentChildOut:
    class_label: str | None = None
    stream_name: str | None = None

    if student.class_id:
        school_class = await session.scalar(
            select(SchoolClass).where(
                SchoolClass.tenant_id == tenant_id,
                SchoolClass.id == student.class_id,
                SchoolClass.deleted_at.is_(None),
            )
        )
        if school_class:
            class_label = school_class.label

    if student.stream_id:
        stream = await session.scalar(
            select(ClassStream).where(
                ClassStream.tenant_id == tenant_id,
                ClassStream.id == student.stream_id,
                ClassStream.deleted_at.is_(None),
            )
        )
        if stream:
            stream_name = stream.name

    return ParentChildOut(
        id=student.id,
        student_number=student.student_number,
        first_name=student.first_name,
        last_name=student.last_name,
        preferred_name=student.preferred_name,
        class_label=class_label,
        stream_name=stream_name,
        photo_url=student.photo_url,
        status=student.status,
    )


async def _guardian_contacts(
    session: AsyncSession, tenant_id: UUID, student_id: UUID
) -> list[ParentGuardianContactOut]:
    rows = list(
        await session.scalars(
            select(StudentGuardian)
            .where(
                StudentGuardian.tenant_id == tenant_id,
                StudentGuardian.student_id == student_id,
                StudentGuardian.deleted_at.is_(None),
            )
            .order_by(StudentGuardian.is_primary.desc(), StudentGuardian.full_name)
        )
    )
    return [
        ParentGuardianContactOut(
            relationship=row.relationship,
            full_name=row.full_name,
            is_primary=row.is_primary,
        )
        for row in rows
    ]


async def _fee_summary(
    session: AsyncSession, tenant_id: UUID, student_id: UUID
) -> ParentFeeSummaryOut | None:
    year = await session.scalar(
        select(AcademicYear).where(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.status == AcademicYearStatus.active,
        )
    )
    if year is None:
        return None

    term = await session.scalar(
        select(Term).where(
            Term.tenant_id == tenant_id,
            Term.academic_year_id == year.id,
            Term.status == TermStatus.active,
        )
    )
    if term is None:
        return None

    invoice = await session.scalar(
        select(FeeInvoice).where(
            FeeInvoice.tenant_id == tenant_id,
            FeeInvoice.student_id == student_id,
            FeeInvoice.term_id == term.id,
        )
    )
    if invoice is None:
        return None

    balance = max(invoice.total_ugx - invoice.amount_paid_ugx, 0)
    return ParentFeeSummaryOut(
        term_label=term.label,
        balance_ugx=balance,
        status=invoice.status,
        is_overdue=_is_overdue(invoice.status, invoice.due_on),
    )


async def get_overview(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    *,
    modules: tuple[str, ...],
) -> ParentPortalOverviewOut:
    user = await session.scalar(
        select(TenantUser)
        .join(Role, Role.id == TenantUser.role_id)
        .where(
            TenantUser.id == user_id,
            TenantUser.tenant_id == tenant_id,
            Role.role_key == "parent",
        )
    )
    if user is None:
        raise NotFoundError("Parent account not found.")

    student = await resolve_parent_student(session, tenant_id, user_id)
    if student is None:
        raise NotFoundError(
            "No learner is linked to this portal account. Contact the school office."
        )

    school_code = await _school_code(session, tenant_id)
    child = await _child_out(session, tenant_id, student)
    guardians = await _guardian_contacts(session, tenant_id, student.id)

    attendance_rate: float | None = None
    if "attendance" in modules:
        try:
            year = await _active_year(session, tenant_id)
            term = await _active_term(session, tenant_id, year.id)
            attendance_rate = await _term_rate(
                session,
                tenant_id,
                student.id,
                academic_year_id=year.id,
                term_id=term.id if term else None,
            )
        except ValidationError:
            attendance_rate = None

    fee: ParentFeeSummaryOut | None = None
    if "finance" in modules:
        fee = await _fee_summary(session, tenant_id, student.id)

    inbox = await circular_service.list_inbox(
        session, tenant_id, user_id, "parent"
    )

    return ParentPortalOverviewOut(
        portal_username=f"{user.login_id}@{school_code}",
        child=child,
        guardians=guardians,
        attendance_rate=attendance_rate,
        fee=fee,
        circular_count=len(inbox),
    )


async def _require_linked_student(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
) -> Student:
    student = await resolve_parent_student(session, tenant_id, user_id)
    if student is None:
        raise NotFoundError(
            "No learner is linked to this portal account. Contact the school office."
        )
    return student


async def get_report_card_preview(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    *,
    term_id: UUID | None = None,
):
    from app.services import reportcard_service

    student = await _require_linked_student(session, tenant_id, user_id)
    return await reportcard_service.get_preview(
        session,
        tenant_id,
        student_id=student.id,
        term_id=term_id,
    )


async def get_report_card_pdf(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    *,
    term_id: UUID | None = None,
) -> bytes:
    from app.services import report_card_pdf_service

    student = await _require_linked_student(session, tenant_id, user_id)
    return await report_card_pdf_service.render_pdf(
        session,
        tenant_id,
        student_id=student.id,
        term_id=term_id,
    )


async def list_fee_invoices(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
):
    from app.models.finance import FeeInvoice
    from app.services import finance_service

    student = await _require_linked_student(session, tenant_id, user_id)
    invoices = list(
        await session.scalars(
            select(FeeInvoice)
            .where(
                FeeInvoice.tenant_id == tenant_id,
                FeeInvoice.student_id == student.id,
            )
            .order_by(FeeInvoice.issued_at.desc())
        )
    )
    return [
        await finance_service._invoice_out(session, tenant_id, invoice)
        for invoice in invoices
    ]


async def get_fee_invoice(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    invoice_id: UUID,
):
    from app.models.finance import FeeInvoice
    from app.services import finance_service

    student = await _require_linked_student(session, tenant_id, user_id)
    invoice = await session.scalar(
        select(FeeInvoice).where(
            FeeInvoice.tenant_id == tenant_id,
            FeeInvoice.id == invoice_id,
        )
    )
    if invoice is None or invoice.student_id != student.id:
        raise NotFoundError("Invoice not found.")
    return await finance_service.get_invoice(session, tenant_id, invoice_id)
