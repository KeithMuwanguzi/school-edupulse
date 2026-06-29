"""HR & Payroll — employees, leave, and monthly pay runs."""
from __future__ import annotations

import calendar
import datetime as dt
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.enums import EmployeeDepartment, EmploymentType, LeaveRequestStatus, PaymentMethod, PayrollRunStatus
from app.models.hr_payroll import (
    EmployeeProfile,
    LeaveRequest,
    LeaveType,
    PayrollLine,
    PayrollRun,
)
from app.models.user import Role, TenantUser
from app.schemas.hr_payroll import (
    EmployeeOut,
    EmployeeProfileUpsert,
    HrPayrollSummaryOut,
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveTypeOut,
    PayrollLineOut,
    PayrollRunCreate,
    PayrollRunOut,
    PayslipOut,
)
from app.services.hr_payroll_calc import compute_payroll_line

STAFF_ROLES = frozenset({"school_admin", "deputy_head", "teacher", "bursar"})

DEFAULT_LEAVE_TYPES: tuple[tuple[str, str, int | None, bool], ...] = (
    ("annual", "Annual leave", 21, True),
    ("sick", "Sick leave", None, True),
    ("maternity", "Maternity leave", 60, True),
    ("compassionate", "Compassionate leave", 5, True),
    ("unpaid", "Unpaid leave", None, False),
)


async def ensure_leave_types(session: AsyncSession, tenant_id: UUID) -> None:
    existing = await session.scalar(
        select(func.count()).select_from(LeaveType).where(LeaveType.tenant_id == tenant_id)
    )
    if existing:
        return
    for code, label, default_days, is_paid in DEFAULT_LEAVE_TYPES:
        session.add(
            LeaveType(
                tenant_id=tenant_id,
                code=code,
                label=label,
                default_days=default_days,
                is_paid=is_paid,
            )
        )
    await session.flush()


def _leave_days(starts: dt.date, ends: dt.date) -> int:
    return (ends - starts).days + 1


def _employee_out(user: TenantUser, role: Role, profile: EmployeeProfile | None) -> EmployeeOut:
    gross = None
    if profile:
        gross = (
            profile.base_salary_ugx
            + profile.housing_allowance_ugx
            + profile.transport_allowance_ugx
            + profile.responsibility_allowance_ugx
            + profile.other_allowances_ugx
        )
    return EmployeeOut(
        user_id=user.id,
        login_id=user.login_id,
        name=user.name,
        email=user.email,
        role_key=role.role_key,
        role_label=role.name,
        status=user.status.value,
        has_profile=profile is not None,
        job_title=profile.job_title if profile else None,
        department=profile.department.value if profile else None,
        employment_type=profile.employment_type.value if profile else None,
        hire_date=profile.hire_date if profile else None,
        tin=profile.tin if profile else None,
        nssf_number=profile.nssf_number if profile else None,
        payment_method=profile.payment_method.value if profile else None,
        bank_name=profile.bank_name if profile else None,
        bank_account=profile.bank_account if profile else None,
        mobile_money_number=profile.mobile_money_number if profile else None,
        base_salary_ugx=profile.base_salary_ugx if profile else None,
        housing_allowance_ugx=profile.housing_allowance_ugx if profile else None,
        transport_allowance_ugx=profile.transport_allowance_ugx if profile else None,
        responsibility_allowance_ugx=profile.responsibility_allowance_ugx if profile else None,
        other_allowances_ugx=profile.other_allowances_ugx if profile else None,
        recurring_deduction_ugx=profile.recurring_deduction_ugx if profile else None,
        recurring_deduction_note=profile.recurring_deduction_note if profile else None,
        annual_leave_days=profile.annual_leave_days if profile else None,
        is_active=profile.is_active if profile else None,
        gross_salary_ugx=gross,
    )


async def _staff_rows(session: AsyncSession, tenant_id: UUID) -> list[tuple[TenantUser, Role, EmployeeProfile | None]]:
    rows = await session.execute(
        select(TenantUser, Role, EmployeeProfile)
        .join(Role, Role.id == TenantUser.role_id)
        .outerjoin(
            EmployeeProfile,
            (EmployeeProfile.user_id == TenantUser.id)
            & (EmployeeProfile.tenant_id == tenant_id),
        )
        .where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
            Role.role_key.in_(STAFF_ROLES),
        )
        .order_by(TenantUser.name)
    )
    return list(rows.all())


async def list_employees(session: AsyncSession, tenant_id: UUID) -> list[EmployeeOut]:
    return [_employee_out(u, r, p) for u, r, p in await _staff_rows(session, tenant_id)]


async def upsert_employee_profile(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    body: EmployeeProfileUpsert,
) -> EmployeeOut:
    row = await session.execute(
        select(TenantUser, Role)
        .join(Role, Role.id == TenantUser.role_id)
        .where(
            TenantUser.id == user_id,
            TenantUser.tenant_id == tenant_id,
            TenantUser.deleted_at.is_(None),
            Role.role_key.in_(STAFF_ROLES),
        )
    )
    matched = row.one_or_none()
    if matched is None:
        raise NotFoundError("Staff member not found.")
    user, role = matched

    profile = await session.scalar(
        select(EmployeeProfile).where(
            EmployeeProfile.tenant_id == tenant_id,
            EmployeeProfile.user_id == user_id,
        )
    )
    if profile is None:
        profile = EmployeeProfile(tenant_id=tenant_id, user_id=user_id)
        session.add(profile)

    profile.job_title = body.job_title.strip() if body.job_title else None
    profile.department = EmployeeDepartment(body.department)
    profile.employment_type = EmploymentType(body.employment_type)
    profile.hire_date = body.hire_date
    profile.tin = body.tin.strip() if body.tin else None
    profile.nssf_number = body.nssf_number.strip() if body.nssf_number else None
    profile.payment_method = PaymentMethod(body.payment_method)
    profile.bank_name = body.bank_name.strip() if body.bank_name else None
    profile.bank_account = body.bank_account.strip() if body.bank_account else None
    profile.mobile_money_number = (
        body.mobile_money_number.strip() if body.mobile_money_number else None
    )
    profile.base_salary_ugx = body.base_salary_ugx
    profile.housing_allowance_ugx = body.housing_allowance_ugx
    profile.transport_allowance_ugx = body.transport_allowance_ugx
    profile.responsibility_allowance_ugx = body.responsibility_allowance_ugx
    profile.other_allowances_ugx = body.other_allowances_ugx
    profile.recurring_deduction_ugx = body.recurring_deduction_ugx
    profile.recurring_deduction_note = (
        body.recurring_deduction_note.strip() if body.recurring_deduction_note else None
    )
    profile.annual_leave_days = body.annual_leave_days
    profile.is_active = body.is_active
    await session.flush()
    return _employee_out(user, role, profile)


async def hr_summary(session: AsyncSession, tenant_id: UUID) -> HrPayrollSummaryOut:
    await ensure_leave_types(session, tenant_id)
    today = dt.date.today()
    staff = await _staff_rows(session, tenant_id)
    active = sum(1 for _, _, p in staff if p is None or p.is_active)
    pending = int(
        await session.scalar(
            select(func.count())
            .select_from(LeaveRequest)
            .where(
                LeaveRequest.tenant_id == tenant_id,
                LeaveRequest.status == LeaveRequestStatus.pending,
            )
        )
        or 0
    )
    on_leave = int(
        await session.scalar(
            select(func.count())
            .select_from(LeaveRequest)
            .where(
                LeaveRequest.tenant_id == tenant_id,
                LeaveRequest.status == LeaveRequestStatus.approved,
                LeaveRequest.starts_on <= today,
                LeaveRequest.ends_on >= today,
            )
        )
        or 0
    )
    latest = await session.scalar(
        select(PayrollRun)
        .where(PayrollRun.tenant_id == tenant_id)
        .order_by(PayrollRun.year.desc(), PayrollRun.month.desc())
        .limit(1)
    )
    monthly = sum(
        (p.base_salary_ugx + p.housing_allowance_ugx + p.transport_allowance_ugx + p.responsibility_allowance_ugx + p.other_allowances_ugx)
        for _, _, p in staff
        if p and p.is_active
    )
    return HrPayrollSummaryOut(
        active_employees=active,
        pending_leave=pending,
        on_leave_today=on_leave,
        latest_payroll_label=latest.label if latest else None,
        latest_payroll_net_ugx=latest.total_net_ugx if latest else None,
        monthly_payroll_ugx=monthly,
    )


async def list_leave_types(session: AsyncSession, tenant_id: UUID) -> list[LeaveTypeOut]:
    await ensure_leave_types(session, tenant_id)
    rows = list(
        await session.scalars(
            select(LeaveType)
            .where(LeaveType.tenant_id == tenant_id, LeaveType.is_active.is_(True))
            .order_by(LeaveType.label)
        )
    )
    return [
        LeaveTypeOut(
            id=r.id,
            code=r.code,
            label=r.label,
            default_days=r.default_days,
            is_paid=r.is_paid,
            is_active=r.is_active,
        )
        for r in rows
    ]


async def _leave_request_out(session: AsyncSession, req: LeaveRequest) -> LeaveRequestOut:
    user = await session.get(TenantUser, req.user_id)
    leave_type = await session.get(LeaveType, req.leave_type_id)
    reviewer = await session.get(TenantUser, req.reviewed_by) if req.reviewed_by else None
    return LeaveRequestOut(
        id=req.id,
        user_id=req.user_id,
        employee_name=user.name if user else "—",
        login_id=user.login_id if user else "—",
        leave_type_id=req.leave_type_id,
        leave_type_label=leave_type.label if leave_type else "—",
        starts_on=req.starts_on,
        ends_on=req.ends_on,
        days=req.days,
        reason=req.reason,
        status=req.status.value,
        reviewed_by=req.reviewed_by,
        reviewer_name=reviewer.name if reviewer else None,
        reviewed_at=req.reviewed_at,
        review_note=req.review_note,
        created_at=req.created_at,
    )


async def list_leave_requests(
    session: AsyncSession,
    tenant_id: UUID,
    *,
    status: LeaveRequestStatus | None = None,
    user_id: UUID | None = None,
) -> list[LeaveRequestOut]:
    await ensure_leave_types(session, tenant_id)
    stmt = (
        select(LeaveRequest)
        .where(LeaveRequest.tenant_id == tenant_id)
        .order_by(LeaveRequest.created_at.desc())
    )
    if status is not None:
        stmt = stmt.where(LeaveRequest.status == status)
    if user_id is not None:
        stmt = stmt.where(LeaveRequest.user_id == user_id)
    rows = list(await session.scalars(stmt))
    return [await _leave_request_out(session, r) for r in rows]


async def create_leave_request(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    body: LeaveRequestCreate,
) -> LeaveRequestOut:
    await ensure_leave_types(session, tenant_id)
    leave_type = await session.scalar(
        select(LeaveType).where(
            LeaveType.id == body.leave_type_id,
            LeaveType.tenant_id == tenant_id,
            LeaveType.is_active.is_(True),
        )
    )
    if leave_type is None:
        raise ValidationError("Leave type not found.")
    days = _leave_days(body.starts_on, body.ends_on)
    req = LeaveRequest(
        tenant_id=tenant_id,
        user_id=user_id,
        leave_type_id=body.leave_type_id,
        starts_on=body.starts_on,
        ends_on=body.ends_on,
        days=days,
        reason=body.reason.strip() if body.reason else None,
    )
    session.add(req)
    await session.flush()
    return await _leave_request_out(session, req)


async def _get_leave_request(
    session: AsyncSession,
    tenant_id: UUID,
    request_id: UUID,
) -> LeaveRequest:
    req = await session.scalar(
        select(LeaveRequest).where(
            LeaveRequest.id == request_id,
            LeaveRequest.tenant_id == tenant_id,
        )
    )
    if req is None:
        raise NotFoundError("Leave request not found.")
    return req


async def approve_leave(
    session: AsyncSession,
    tenant_id: UUID,
    request_id: UUID,
    reviewer_id: UUID,
    note: str | None,
) -> LeaveRequestOut:
    req = await _get_leave_request(session, tenant_id, request_id)
    if req.status != LeaveRequestStatus.pending:
        raise ValidationError("Only pending requests can be approved.")
    req.status = LeaveRequestStatus.approved
    req.reviewed_by = reviewer_id
    req.reviewed_at = dt.datetime.now(dt.UTC)
    req.review_note = note.strip() if note else None
    return await _leave_request_out(session, req)


async def reject_leave(
    session: AsyncSession,
    tenant_id: UUID,
    request_id: UUID,
    reviewer_id: UUID,
    note: str | None,
) -> LeaveRequestOut:
    req = await _get_leave_request(session, tenant_id, request_id)
    if req.status != LeaveRequestStatus.pending:
        raise ValidationError("Only pending requests can be rejected.")
    req.status = LeaveRequestStatus.rejected
    req.reviewed_by = reviewer_id
    req.reviewed_at = dt.datetime.now(dt.UTC)
    req.review_note = note.strip() if note else None
    return await _leave_request_out(session, req)


def _line_out(
    line: PayrollLine,
    user: TenantUser,
    profile: EmployeeProfile | None,
) -> PayrollLineOut:
    return PayrollLineOut(
        id=line.id,
        user_id=line.user_id,
        employee_name=user.name,
        login_id=user.login_id,
        job_title=profile.job_title if profile else None,
        base_salary_ugx=line.base_salary_ugx,
        housing_allowance_ugx=line.housing_allowance_ugx,
        transport_allowance_ugx=line.transport_allowance_ugx,
        responsibility_allowance_ugx=line.responsibility_allowance_ugx,
        other_allowances_ugx=line.other_allowances_ugx,
        gross_ugx=line.gross_ugx,
        nssf_employee_ugx=line.nssf_employee_ugx,
        nssf_employer_ugx=line.nssf_employer_ugx,
        paye_ugx=line.paye_ugx,
        other_deductions_ugx=line.other_deductions_ugx,
        net_ugx=line.net_ugx,
        payment_method=profile.payment_method.value if profile else None,
    )


async def _run_out(session: AsyncSession, run: PayrollRun, *, with_lines: bool) -> PayrollRunOut:
    lines: list[PayrollLineOut] = []
    if with_lines:
        line_rows = list(
            await session.scalars(
                select(PayrollLine)
                .where(PayrollLine.run_id == run.id)
                .order_by(PayrollLine.net_ugx.desc())
            )
        )
        for line in line_rows:
            user = await session.get(TenantUser, line.user_id)
            profile = await session.scalar(
                select(EmployeeProfile).where(
                    EmployeeProfile.tenant_id == run.tenant_id,
                    EmployeeProfile.user_id == line.user_id,
                )
            )
            if user:
                lines.append(_line_out(line, user, profile))
    return PayrollRunOut(
        id=run.id,
        year=run.year,
        month=run.month,
        label=run.label,
        status=run.status.value,
        notes=run.notes,
        total_gross_ugx=run.total_gross_ugx,
        total_deductions_ugx=run.total_deductions_ugx,
        total_net_ugx=run.total_net_ugx,
        staff_count=run.staff_count,
        finalized_at=run.finalized_at,
        lines=lines,
    )


async def list_payroll_runs(session: AsyncSession, tenant_id: UUID) -> list[PayrollRunOut]:
    rows = list(
        await session.scalars(
            select(PayrollRun)
            .where(PayrollRun.tenant_id == tenant_id)
            .order_by(PayrollRun.year.desc(), PayrollRun.month.desc())
        )
    )
    return [await _run_out(session, r, with_lines=False) for r in rows]


async def get_payroll_run(
    session: AsyncSession,
    tenant_id: UUID,
    run_id: UUID,
) -> PayrollRunOut:
    run = await session.scalar(
        select(PayrollRun).where(PayrollRun.id == run_id, PayrollRun.tenant_id == tenant_id)
    )
    if run is None:
        raise NotFoundError("Payroll run not found.")
    return await _run_out(session, run, with_lines=True)


async def create_payroll_run(
    session: AsyncSession,
    tenant_id: UUID,
    body: PayrollRunCreate,
) -> PayrollRunOut:
    existing = await session.scalar(
        select(PayrollRun).where(
            PayrollRun.tenant_id == tenant_id,
            PayrollRun.year == body.year,
            PayrollRun.month == body.month,
        )
    )
    if existing:
        raise ConflictError(f"Payroll for {body.year}-{body.month:02d} already exists.")
    label = f"{calendar.month_name[body.month]} {body.year}"
    run = PayrollRun(
        tenant_id=tenant_id,
        year=body.year,
        month=body.month,
        label=label,
        notes=body.notes.strip() if body.notes else None,
    )
    session.add(run)
    await session.flush()
    return await compute_payroll_run(session, tenant_id, run.id)


async def compute_payroll_run(
    session: AsyncSession,
    tenant_id: UUID,
    run_id: UUID,
) -> PayrollRunOut:
    run = await session.scalar(
        select(PayrollRun).where(PayrollRun.id == run_id, PayrollRun.tenant_id == tenant_id)
    )
    if run is None:
        raise NotFoundError("Payroll run not found.")
    if run.status == PayrollRunStatus.finalized:
        raise ValidationError("Finalized payroll cannot be recomputed.")

    await session.execute(delete(PayrollLine).where(PayrollLine.run_id == run.id))

    staff = await _staff_rows(session, tenant_id)
    total_gross = 0
    total_deductions = 0
    total_net = 0
    count = 0

    for user, _role, profile in staff:
        if profile is None or not profile.is_active or profile.base_salary_ugx <= 0:
            continue
        calc = compute_payroll_line(
            base_salary_ugx=profile.base_salary_ugx,
            housing_allowance_ugx=profile.housing_allowance_ugx,
            transport_allowance_ugx=profile.transport_allowance_ugx,
            responsibility_allowance_ugx=profile.responsibility_allowance_ugx,
            other_allowances_ugx=profile.other_allowances_ugx,
            recurring_deduction_ugx=profile.recurring_deduction_ugx,
        )
        line = PayrollLine(
            tenant_id=tenant_id,
            run_id=run.id,
            user_id=user.id,
            base_salary_ugx=calc.base_salary_ugx,
            housing_allowance_ugx=calc.housing_allowance_ugx,
            transport_allowance_ugx=calc.transport_allowance_ugx,
            responsibility_allowance_ugx=calc.responsibility_allowance_ugx,
            other_allowances_ugx=calc.other_allowances_ugx,
            gross_ugx=calc.gross_ugx,
            nssf_employee_ugx=calc.nssf_employee_ugx,
            nssf_employer_ugx=calc.nssf_employer_ugx,
            paye_ugx=calc.paye_ugx,
            other_deductions_ugx=calc.other_deductions_ugx,
            net_ugx=calc.net_ugx,
            breakdown={
                "nssf_employer_ugx": calc.nssf_employer_ugx,
                "deduction_note": profile.recurring_deduction_note,
            },
        )
        session.add(line)
        total_gross += calc.gross_ugx
        total_deductions += calc.nssf_employee_ugx + calc.paye_ugx + calc.other_deductions_ugx
        total_net += calc.net_ugx
        count += 1

    run.total_gross_ugx = total_gross
    run.total_deductions_ugx = total_deductions
    run.total_net_ugx = total_net
    run.staff_count = count
    await session.flush()
    return await _run_out(session, run, with_lines=True)


async def finalize_payroll_run(
    session: AsyncSession,
    tenant_id: UUID,
    run_id: UUID,
    user_id: UUID,
) -> PayrollRunOut:
    run = await session.scalar(
        select(PayrollRun).where(PayrollRun.id == run_id, PayrollRun.tenant_id == tenant_id)
    )
    if run is None:
        raise NotFoundError("Payroll run not found.")
    if run.status == PayrollRunStatus.finalized:
        raise ValidationError("Payroll run is already finalized.")
    if run.staff_count == 0:
        raise ValidationError("Compute payroll before finalizing.")
    run.status = PayrollRunStatus.finalized
    run.finalized_at = dt.datetime.now(dt.UTC)
    run.finalized_by = user_id
    return await _run_out(session, run, with_lines=True)


async def list_my_payslips(
    session: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
) -> list[PayslipOut]:
    lines = list(
        await session.scalars(
            select(PayrollLine)
            .join(PayrollRun, PayrollRun.id == PayrollLine.run_id)
            .where(
                PayrollLine.tenant_id == tenant_id,
                PayrollLine.user_id == user_id,
                PayrollRun.status == PayrollRunStatus.finalized,
            )
            .order_by(PayrollRun.year.desc(), PayrollRun.month.desc())
        )
    )
    out: list[PayslipOut] = []
    user = await session.get(TenantUser, user_id)
    profile = await session.scalar(
        select(EmployeeProfile).where(
            EmployeeProfile.tenant_id == tenant_id,
            EmployeeProfile.user_id == user_id,
        )
    )
    for line in lines:
        run = await session.get(PayrollRun, line.run_id)
        if run and user:
            out.append(
                PayslipOut(
                    run_id=run.id,
                    label=run.label,
                    year=run.year,
                    month=run.month,
                    status=run.status.value,
                    finalized_at=run.finalized_at,
                    line=_line_out(line, user, profile),
                )
            )
    return out
