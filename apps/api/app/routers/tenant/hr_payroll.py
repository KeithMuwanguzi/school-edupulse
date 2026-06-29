"""HR & Payroll — staff records, leave, and monthly pay runs."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext
from app.core.db import apply_tenant_guc, get_session
from app.core.dependencies import get_tenant_context, require_module, require_role
from app.models.enums import LeaveRequestStatus
from app.schemas.hr_payroll import (
    EmployeeOut,
    EmployeeProfileUpsert,
    HrPayrollSummaryOut,
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveReviewBody,
    LeaveTypeOut,
    PayrollRunCreate,
    PayrollRunOut,
    PayslipOut,
)
from app.services import hr_payroll_service

router = APIRouter(prefix="/tenant", tags=["tenant:hr-payroll"])

_hr = require_module("hr_payroll")
_admin = require_role("school_admin")
_hr_staff = require_role("school_admin", "bursar")
_any_staff = require_role("school_admin", "deputy_head", "teacher", "bursar")


@router.get("/hr-payroll/summary", response_model=HrPayrollSummaryOut)
async def hr_payroll_summary(
    ctx: TenantContext = Depends(_hr_staff),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> HrPayrollSummaryOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await hr_payroll_service.hr_summary(session, ctx.tenant_id)


@router.get("/hr-payroll/employees", response_model=list[EmployeeOut])
async def list_employees(
    ctx: TenantContext = Depends(_hr_staff),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> list[EmployeeOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await hr_payroll_service.list_employees(session, ctx.tenant_id)


@router.put("/hr-payroll/employees/{user_id}/profile", response_model=EmployeeOut)
async def upsert_employee_profile(
    user_id: UUID,
    body: EmployeeProfileUpsert,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> EmployeeOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await hr_payroll_service.upsert_employee_profile(
        session, ctx.tenant_id, user_id, body
    )
    await session.commit()
    return out


@router.get("/hr-payroll/leave-types", response_model=list[LeaveTypeOut])
async def list_leave_types(
    ctx: TenantContext = Depends(_any_staff),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> list[LeaveTypeOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await hr_payroll_service.list_leave_types(session, ctx.tenant_id)


@router.get("/hr-payroll/leave-requests", response_model=list[LeaveRequestOut])
async def list_leave_requests(
    status: str | None = Query(default=None, pattern="^(pending|approved|rejected|cancelled)$"),
    ctx: TenantContext = Depends(_hr_staff),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> list[LeaveRequestOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    parsed = LeaveRequestStatus(status) if status else None
    return await hr_payroll_service.list_leave_requests(
        session, ctx.tenant_id, status=parsed
    )


@router.post("/hr-payroll/leave-requests/{request_id}/approve", response_model=LeaveRequestOut)
async def approve_leave(
    request_id: UUID,
    body: LeaveReviewBody,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> LeaveRequestOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await hr_payroll_service.approve_leave(
        session, ctx.tenant_id, request_id, ctx.user_id, body.review_note
    )
    await session.commit()
    return out


@router.post("/hr-payroll/leave-requests/{request_id}/reject", response_model=LeaveRequestOut)
async def reject_leave(
    request_id: UUID,
    body: LeaveReviewBody,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> LeaveRequestOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await hr_payroll_service.reject_leave(
        session, ctx.tenant_id, request_id, ctx.user_id, body.review_note
    )
    await session.commit()
    return out


@router.get("/hr-payroll/me/leave", response_model=list[LeaveRequestOut])
async def my_leave_requests(
    ctx: TenantContext = Depends(_any_staff),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> list[LeaveRequestOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await hr_payroll_service.list_leave_requests(
        session, ctx.tenant_id, user_id=ctx.user_id
    )


@router.post("/hr-payroll/me/leave", response_model=LeaveRequestOut, status_code=201)
async def request_my_leave(
    body: LeaveRequestCreate,
    ctx: TenantContext = Depends(_any_staff),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> LeaveRequestOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await hr_payroll_service.create_leave_request(
        session, ctx.tenant_id, ctx.user_id, body
    )
    await session.commit()
    return out


@router.get("/hr-payroll/payroll-runs", response_model=list[PayrollRunOut])
async def list_payroll_runs(
    ctx: TenantContext = Depends(_hr_staff),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> list[PayrollRunOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await hr_payroll_service.list_payroll_runs(session, ctx.tenant_id)


@router.get("/hr-payroll/payroll-runs/{run_id}", response_model=PayrollRunOut)
async def get_payroll_run(
    run_id: UUID,
    ctx: TenantContext = Depends(_hr_staff),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> PayrollRunOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await hr_payroll_service.get_payroll_run(session, ctx.tenant_id, run_id)


@router.post("/hr-payroll/payroll-runs", response_model=PayrollRunOut, status_code=201)
async def create_payroll_run(
    body: PayrollRunCreate,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> PayrollRunOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await hr_payroll_service.create_payroll_run(session, ctx.tenant_id, body)
    await session.commit()
    return out


@router.post("/hr-payroll/payroll-runs/{run_id}/compute", response_model=PayrollRunOut)
async def compute_payroll_run(
    run_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> PayrollRunOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await hr_payroll_service.compute_payroll_run(session, ctx.tenant_id, run_id)
    await session.commit()
    return out


@router.post("/hr-payroll/payroll-runs/{run_id}/finalize", response_model=PayrollRunOut)
async def finalize_payroll_run(
    run_id: UUID,
    ctx: TenantContext = Depends(_admin),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> PayrollRunOut:
    await apply_tenant_guc(session, ctx.tenant_id)
    out = await hr_payroll_service.finalize_payroll_run(
        session, ctx.tenant_id, run_id, ctx.user_id
    )
    await session.commit()
    return out


@router.get("/hr-payroll/me/payslips", response_model=list[PayslipOut])
async def my_payslips(
    ctx: TenantContext = Depends(_any_staff),
    _mod: TenantContext = Depends(_hr),
    session: AsyncSession = Depends(get_session),
) -> list[PayslipOut]:
    await apply_tenant_guc(session, ctx.tenant_id)
    return await hr_payroll_service.list_my_payslips(session, ctx.tenant_id, ctx.user_id)
