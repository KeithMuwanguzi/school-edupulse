"""Admission applications pipeline.

Revision ID: 0017
Revises: 0016
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
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
        CREATE TABLE admission_applications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            reference_number VARCHAR(24) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'application',
            first_name VARCHAR(120) NOT NULL,
            last_name VARCHAR(120) NOT NULL,
            middle_name VARCHAR(120) NULL,
            gender VARCHAR(10) NULL,
            date_of_birth DATE NULL,
            applied_class_level VARCHAR(10) NULL,
            applied_class_id UUID NULL REFERENCES classes(id),
            applied_stream_id UUID NULL REFERENCES streams(id),
            guardian_name VARCHAR(160) NULL,
            guardian_relationship VARCHAR(30) NULL,
            guardian_phone VARCHAR(30) NULL,
            guardian_email VARCHAR(255) NULL,
            previous_school VARCHAR(160) NULL,
            notes TEXT NULL,
            interview_date DATE NULL,
            interview_score INTEGER NULL,
            applied_at DATE NOT NULL,
            student_id UUID NULL,
            enrolled_at DATE NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            UNIQUE (tenant_id, id),
            UNIQUE (tenant_id, reference_number)
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_admission_applications_tenant_status "
        "ON admission_applications (tenant_id, status) "
        "WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX idx_admission_applications_tenant_applied "
        "ON admission_applications (tenant_id, applied_at DESC) "
        "WHERE deleted_at IS NULL"
    )
    _enable_rls("admission_applications")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS admission_applications")
