"""HR & Payroll — employee profiles, leave, and monthly pay runs."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, pg_enum, uuid_pk
from app.models.enums import (
    EmployeeDepartment,
    EmploymentType,
    LeaveRequestStatus,
    PaymentMethod,
    PayrollRunStatus,
)


class EmployeeProfile(Base, TimestampMixin):
    __tablename__ = "employee_profiles"
    __table_args__ = (UniqueConstraint("tenant_id", "user_id", name="uq_employee_profiles_user"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenant_users.id"), nullable=False
    )
    job_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    department: Mapped[EmployeeDepartment] = mapped_column(
        pg_enum(EmployeeDepartment), nullable=False, default=EmployeeDepartment.teaching
    )
    employment_type: Mapped[EmploymentType] = mapped_column(
        pg_enum(EmploymentType), nullable=False, default=EmploymentType.permanent
    )
    hire_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    tin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nssf_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        pg_enum(PaymentMethod), nullable=False, default=PaymentMethod.mobile_money
    )
    bank_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(40), nullable=True)
    mobile_money_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    base_salary_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    housing_allowance_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    transport_allowance_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    responsibility_allowance_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    other_allowances_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    recurring_deduction_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    recurring_deduction_note: Mapped[str | None] = mapped_column(String(160), nullable=True)
    annual_leave_days: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=21)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LeaveType(Base, TimestampMixin):
    __tablename__ = "leave_types"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_leave_types_code"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    default_days: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LeaveRequest(Base, TimestampMixin):
    __tablename__ = "leave_requests"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenant_users.id"), nullable=False
    )
    leave_type_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("leave_types.id"), nullable=False
    )
    starts_on: Mapped[dt.date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[dt.date] = mapped_column(Date, nullable=False)
    days: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[LeaveRequestStatus] = mapped_column(
        pg_enum(LeaveRequestStatus), nullable=False, default=LeaveRequestStatus.pending
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenant_users.id"), nullable=True
    )
    reviewed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[str | None] = mapped_column(String(500), nullable=True)


class PayrollRun(Base, TimestampMixin):
    __tablename__ = "payroll_runs"
    __table_args__ = (UniqueConstraint("tenant_id", "year", "month", name="uq_payroll_runs_period"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    label: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[PayrollRunStatus] = mapped_column(
        pg_enum(PayrollRunStatus), nullable=False, default=PayrollRunStatus.draft
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_gross_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_deductions_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_net_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    staff_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    finalized_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finalized_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenant_users.id"), nullable=True
    )


class PayrollLine(Base, TimestampMixin):
    __tablename__ = "payroll_lines"
    __table_args__ = (UniqueConstraint("run_id", "user_id", name="uq_payroll_lines_run_user"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("payroll_runs.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tenant_users.id"), nullable=False
    )
    base_salary_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    housing_allowance_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    transport_allowance_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    responsibility_allowance_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    other_allowances_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    gross_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    nssf_employee_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    nssf_employer_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    paye_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    other_deductions_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    net_ugx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    breakdown: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
