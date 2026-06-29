"""HR & Payroll tables — employee profiles, leave, monthly pay runs.

Revision ID: 0039
Revises: 0038
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _enable_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (
            current_setting('app.bypass_rls', true) = 'on'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
            current_setting('app.bypass_rls', true) = 'on'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        """
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO skulpulse_app")


def upgrade() -> None:
    op.execute(
        """
        CREATE TYPE employment_type AS ENUM ('permanent', 'contract', 'casual')
        """
    )
    op.execute(
        """
        CREATE TYPE employee_department AS ENUM (
            'teaching', 'administration', 'support', 'leadership'
        )
        """
    )
    op.execute(
        """
        CREATE TYPE payment_method AS ENUM ('bank', 'mobile_money', 'cash')
        """
    )
    op.execute(
        """
        CREATE TYPE leave_request_status AS ENUM (
            'pending', 'approved', 'rejected', 'cancelled'
        )
        """
    )
    op.execute(
        """
        CREATE TYPE payroll_run_status AS ENUM ('draft', 'finalized')
        """
    )
    op.execute(
        """
        CREATE TABLE employee_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            user_id UUID NOT NULL REFERENCES tenant_users(id),
            job_title VARCHAR(120) NULL,
            department employee_department NOT NULL DEFAULT 'teaching',
            employment_type employment_type NOT NULL DEFAULT 'permanent',
            hire_date DATE NULL,
            tin VARCHAR(20) NULL,
            nssf_number VARCHAR(30) NULL,
            payment_method payment_method NOT NULL DEFAULT 'mobile_money',
            bank_name VARCHAR(80) NULL,
            bank_account VARCHAR(40) NULL,
            mobile_money_number VARCHAR(20) NULL,
            base_salary_ugx INTEGER NOT NULL DEFAULT 0,
            housing_allowance_ugx INTEGER NOT NULL DEFAULT 0,
            transport_allowance_ugx INTEGER NOT NULL DEFAULT 0,
            responsibility_allowance_ugx INTEGER NOT NULL DEFAULT 0,
            other_allowances_ugx INTEGER NOT NULL DEFAULT 0,
            recurring_deduction_ugx INTEGER NOT NULL DEFAULT 0,
            recurring_deduction_note VARCHAR(160) NULL,
            annual_leave_days SMALLINT NOT NULL DEFAULT 21,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_employee_profiles_user UNIQUE (tenant_id, user_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE leave_types (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            code VARCHAR(30) NOT NULL,
            label VARCHAR(80) NOT NULL,
            default_days SMALLINT NULL,
            is_paid BOOLEAN NOT NULL DEFAULT TRUE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_leave_types_code UNIQUE (tenant_id, code)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE leave_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            user_id UUID NOT NULL REFERENCES tenant_users(id),
            leave_type_id UUID NOT NULL REFERENCES leave_types(id),
            starts_on DATE NOT NULL,
            ends_on DATE NOT NULL,
            days SMALLINT NOT NULL,
            reason TEXT NULL,
            status leave_request_status NOT NULL DEFAULT 'pending',
            reviewed_by UUID NULL REFERENCES tenant_users(id),
            reviewed_at TIMESTAMPTZ NULL,
            review_note VARCHAR(500) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT leave_requests_dates_check CHECK (ends_on >= starts_on)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE payroll_runs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            year SMALLINT NOT NULL,
            month SMALLINT NOT NULL,
            label VARCHAR(40) NOT NULL,
            status payroll_run_status NOT NULL DEFAULT 'draft',
            notes TEXT NULL,
            total_gross_ugx INTEGER NOT NULL DEFAULT 0,
            total_deductions_ugx INTEGER NOT NULL DEFAULT 0,
            total_net_ugx INTEGER NOT NULL DEFAULT 0,
            staff_count SMALLINT NOT NULL DEFAULT 0,
            finalized_at TIMESTAMPTZ NULL,
            finalized_by UUID NULL REFERENCES tenant_users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_payroll_runs_period UNIQUE (tenant_id, year, month),
            CONSTRAINT payroll_runs_month_check CHECK (month BETWEEN 1 AND 12)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE payroll_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES tenant_users(id),
            base_salary_ugx INTEGER NOT NULL DEFAULT 0,
            housing_allowance_ugx INTEGER NOT NULL DEFAULT 0,
            transport_allowance_ugx INTEGER NOT NULL DEFAULT 0,
            responsibility_allowance_ugx INTEGER NOT NULL DEFAULT 0,
            other_allowances_ugx INTEGER NOT NULL DEFAULT 0,
            gross_ugx INTEGER NOT NULL DEFAULT 0,
            nssf_employee_ugx INTEGER NOT NULL DEFAULT 0,
            nssf_employer_ugx INTEGER NOT NULL DEFAULT 0,
            paye_ugx INTEGER NOT NULL DEFAULT 0,
            other_deductions_ugx INTEGER NOT NULL DEFAULT 0,
            net_ugx INTEGER NOT NULL DEFAULT 0,
            breakdown JSONB NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_payroll_lines_run_user UNIQUE (run_id, user_id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX ix_leave_requests_tenant_status
        ON leave_requests (tenant_id, status, starts_on DESC)
        """
    )
    op.execute(
        """
        CREATE INDEX ix_payroll_runs_tenant_period
        ON payroll_runs (tenant_id, year DESC, month DESC)
        """
    )
    for table in (
        "employee_profiles",
        "leave_types",
        "leave_requests",
        "payroll_runs",
        "payroll_lines",
    ):
        _enable_rls(table)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS payroll_lines")
    op.execute("DROP TABLE IF EXISTS payroll_runs")
    op.execute("DROP TABLE IF EXISTS leave_requests")
    op.execute("DROP TABLE IF EXISTS leave_types")
    op.execute("DROP TABLE IF EXISTS employee_profiles")
    op.execute("DROP TYPE IF EXISTS payroll_run_status")
    op.execute("DROP TYPE IF EXISTS leave_request_status")
    op.execute("DROP TYPE IF EXISTS payment_method")
    op.execute("DROP TYPE IF EXISTS employee_department")
    op.execute("DROP TYPE IF EXISTS employment_type")
