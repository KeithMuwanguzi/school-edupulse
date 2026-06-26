"""Per-cycle subject → grading scale assignments.

Revision ID: 0034
Revises: 0033
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0034"
down_revision: Union[str, None] = "0033"
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
        CREATE TABLE subject_grading_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            subject_id UUID NOT NULL REFERENCES subjects(id),
            ncdc_cycle ncdc_cycle NOT NULL,
            grading_scale_id UUID NOT NULL REFERENCES grading_scales(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (tenant_id, subject_id, ncdc_cycle)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_subject_grading_assignments_lookup "
        "ON subject_grading_assignments (tenant_id, subject_id, ncdc_cycle)"
    )
    op.execute(
        "CREATE INDEX ix_subject_grading_assignments_scale "
        "ON subject_grading_assignments (tenant_id, grading_scale_id)"
    )
    _enable_rls("subject_grading_assignments")

    op.execute(
        """
        INSERT INTO subject_grading_assignments (tenant_id, subject_id, ncdc_cycle, grading_scale_id)
        SELECT s.tenant_id, s.id, gs.ncdc_cycle, s.grading_scale_id
        FROM subjects s
        INNER JOIN grading_scales gs ON gs.id = s.grading_scale_id AND gs.deleted_at IS NULL
        WHERE s.grading_scale_id IS NOT NULL
          AND s.deleted_at IS NULL
          AND gs.ncdc_cycle = ANY(s.ncdc_cycles)
        """
    )

    op.execute("DROP INDEX IF EXISTS ix_subjects_grading_scale")
    op.execute("ALTER TABLE subjects DROP COLUMN IF EXISTS grading_scale_id")


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE subjects
        ADD COLUMN grading_scale_id UUID NULL REFERENCES grading_scales(id)
        """
    )
    op.execute(
        """
        UPDATE subjects s
        SET grading_scale_id = a.grading_scale_id
        FROM (
            SELECT DISTINCT ON (subject_id) subject_id, grading_scale_id
            FROM subject_grading_assignments
            ORDER BY subject_id, ncdc_cycle
        ) a
        WHERE s.id = a.subject_id
        """
    )
    op.execute(
        "CREATE INDEX ix_subjects_grading_scale ON subjects (tenant_id, grading_scale_id)"
    )
    op.execute("DROP TABLE IF EXISTS subject_grading_assignments CASCADE")
