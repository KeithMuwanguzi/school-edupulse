"""HR & Payroll API schemas."""
from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class HrPayrollSummaryOut(BaseModel):
    active_employees: int
    pending_leave: int
    on_leave_today: int
    latest_payroll_label: str | None
    latest_payroll_net_ugx: int | None
    monthly_payroll_ugx: int


class EmployeeOut(BaseModel):
    user_id: UUID
    login_id: str
    name: str
    email: str | None
    role_key: str
    role_label: str
    status: str
    has_profile: bool
    job_title: str | None = None
    department: str | None = None
    employment_type: str | None = None
    hire_date: dt.date | None = None
    tin: str | None = None
    nssf_number: str | None = None
    payment_method: str | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    mobile_money_number: str | None = None
    base_salary_ugx: int | None = None
    housing_allowance_ugx: int | None = None
    transport_allowance_ugx: int | None = None
    responsibility_allowance_ugx: int | None = None
    other_allowances_ugx: int | None = None
    recurring_deduction_ugx: int | None = None
    recurring_deduction_note: str | None = None
    annual_leave_days: int | None = None
    is_active: bool | None = None
    gross_salary_ugx: int | None = None


class EmployeeProfileUpsert(BaseModel):
    job_title: str | None = Field(default=None, max_length=120)
    department: str = Field(default="teaching", pattern="^(teaching|administration|support|leadership)$")
    employment_type: str = Field(default="permanent", pattern="^(permanent|contract|casual)$")
    hire_date: dt.date | None = None
    tin: str | None = Field(default=None, max_length=20)
    nssf_number: str | None = Field(default=None, max_length=30)
    payment_method: str = Field(default="mobile_money", pattern="^(bank|mobile_money|cash)$")
    bank_name: str | None = Field(default=None, max_length=80)
    bank_account: str | None = Field(default=None, max_length=40)
    mobile_money_number: str | None = Field(default=None, max_length=20)
    base_salary_ugx: int = Field(default=0, ge=0)
    housing_allowance_ugx: int = Field(default=0, ge=0)
    transport_allowance_ugx: int = Field(default=0, ge=0)
    responsibility_allowance_ugx: int = Field(default=0, ge=0)
    other_allowances_ugx: int = Field(default=0, ge=0)
    recurring_deduction_ugx: int = Field(default=0, ge=0)
    recurring_deduction_note: str | None = Field(default=None, max_length=160)
    annual_leave_days: int = Field(default=21, ge=0, le=60)
    is_active: bool = True


class LeaveTypeOut(BaseModel):
    id: UUID
    code: str
    label: str
    default_days: int | None
    is_paid: bool
    is_active: bool


class LeaveRequestOut(BaseModel):
    id: UUID
    user_id: UUID
    employee_name: str
    login_id: str
    leave_type_id: UUID
    leave_type_label: str
    starts_on: dt.date
    ends_on: dt.date
    days: int
    reason: str | None
    status: str
    reviewed_by: UUID | None
    reviewer_name: str | None
    reviewed_at: dt.datetime | None
    review_note: str | None
    created_at: dt.datetime


class LeaveRequestCreate(BaseModel):
    leave_type_id: UUID
    starts_on: dt.date
    ends_on: dt.date
    reason: str | None = Field(default=None, max_length=2000)

    @field_validator("ends_on")
    @classmethod
    def _end_after_start(cls, ends_on: dt.date, info) -> dt.date:
        starts = info.data.get("starts_on")
        if starts and ends_on < starts:
            raise ValueError("End date must be on or after start date.")
        return ends_on


class LeaveReviewBody(BaseModel):
    review_note: str | None = Field(default=None, max_length=500)


class PayrollLineOut(BaseModel):
    id: UUID
    user_id: UUID
    employee_name: str
    login_id: str
    job_title: str | None
    base_salary_ugx: int
    housing_allowance_ugx: int
    transport_allowance_ugx: int
    responsibility_allowance_ugx: int
    other_allowances_ugx: int
    gross_ugx: int
    nssf_employee_ugx: int
    nssf_employer_ugx: int
    paye_ugx: int
    other_deductions_ugx: int
    net_ugx: int
    payment_method: str | None


class PayrollRunOut(BaseModel):
    id: UUID
    year: int
    month: int
    label: str
    status: str
    notes: str | None
    total_gross_ugx: int
    total_deductions_ugx: int
    total_net_ugx: int
    staff_count: int
    finalized_at: dt.datetime | None
    lines: list[PayrollLineOut] = []


class PayrollRunCreate(BaseModel):
    year: int = Field(ge=2020, le=2100)
    month: int = Field(ge=1, le=12)
    notes: str | None = Field(default=None, max_length=2000)


class PayslipOut(BaseModel):
    run_id: UUID
    label: str
    year: int
    month: int
    status: str
    finalized_at: dt.datetime | None
    line: PayrollLineOut
