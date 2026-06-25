"""Grading scales per NCDC section — subjects link to reusable scales.

Revision ID: 0016
Revises: 0015
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
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
    op.execute("DROP TABLE IF EXISTS grade_ranges CASCADE")

    op.execute(
        """
        CREATE TABLE grading_scales (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            name VARCHAR(120) NOT NULL,
            ncdc_cycle ncdc_cycle NOT NULL,
            description TEXT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_grading_scales_tenant_cycle "
        "ON grading_scales (tenant_id, ncdc_cycle, sort_order)"
    )
    _enable_rls("grading_scales")

    op.execute(
        """
        CREATE TABLE grade_ranges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            scale_id UUID NOT NULL REFERENCES grading_scales(id),
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
        "CREATE INDEX ix_grade_ranges_scale ON grade_ranges (tenant_id, scale_id, sort_order)"
    )
    _enable_rls("grade_ranges")

    op.execute(
        """
        ALTER TABLE subjects
        ADD COLUMN grading_scale_id UUID NULL REFERENCES grading_scales(id)
        """
    )
    op.execute(
        "CREATE INDEX ix_subjects_grading_scale ON subjects (tenant_id, grading_scale_id)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE subjects DROP COLUMN IF EXISTS grading_scale_id")
    op.execute("DROP TABLE IF EXISTS grade_ranges CASCADE")
    op.execute("DROP TABLE IF EXISTS grading_scales CASCADE")

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
