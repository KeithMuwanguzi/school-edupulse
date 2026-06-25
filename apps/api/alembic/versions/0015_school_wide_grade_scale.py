"""School-wide grade scale — one scale applies to all subjects.

Revision ID: 0015
Revises: 0014
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
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
    op.execute("DROP TABLE IF EXISTS subject_grade_ranges CASCADE")

    op.execute(
        """
        CREATE TABLE grade_ranges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            label VARCHAR(80) NOT NULL,
            aggregate_weight SMALLINT NOT NULL,
            min_mark SMALLINT NOT NULL,
            max_mark SMALLINT NOT NULL,
            comment TEXT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_grade_ranges_tenant ON grade_ranges (tenant_id, sort_order)"
    )
    _enable_rls("grade_ranges")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS grade_ranges CASCADE")

    op.execute(
        """
        CREATE TABLE subject_grade_ranges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            subject_id UUID NOT NULL REFERENCES subjects(id),
            label VARCHAR(80) NOT NULL,
            aggregate_weight SMALLINT NOT NULL,
            min_mark SMALLINT NOT NULL,
            max_mark SMALLINT NOT NULL,
            comment TEXT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_subject_grade_ranges_tenant_subject "
        "ON subject_grade_ranges (tenant_id, subject_id, sort_order)"
    )
    _enable_rls("subject_grade_ranges")
