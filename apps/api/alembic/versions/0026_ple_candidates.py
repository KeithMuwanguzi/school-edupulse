"""P7 PLE candidacy tracking — Phase 2 §11.

Revision ID: 0026
Revises: 0025
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0026"
down_revision: Union[str, None] = "0025"
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
        CREATE TABLE ple_candidates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            student_id UUID NOT NULL,
            academic_year_id UUID NOT NULL REFERENCES academic_years(id),
            status VARCHAR(20) NOT NULL DEFAULT 'nominated',
            candidate_number VARCHAR(40) NULL,
            registered_on DATE NULL,
            withdrawn_on DATE NULL,
            withdrawal_reason VARCHAR(120) NULL,
            notes TEXT NULL,
            nominated_by_user_id UUID NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            UNIQUE (tenant_id, id),
            UNIQUE (tenant_id, student_id, academic_year_id),
            FOREIGN KEY (tenant_id, student_id)
                REFERENCES students (tenant_id, id)
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_ple_candidates_tenant_year "
        "ON ple_candidates (tenant_id, academic_year_id) "
        "WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX idx_ple_candidates_tenant_status "
        "ON ple_candidates (tenant_id, status) "
        "WHERE deleted_at IS NULL"
    )
    _enable_rls("ple_candidates")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ple_candidates")
