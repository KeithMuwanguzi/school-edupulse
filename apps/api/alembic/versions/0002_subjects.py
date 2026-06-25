"""Phase 2 §2 — tenant subject catalogue with NCDC cycle tags.

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE ncdc_cycle AS ENUM ('cycle_1','cycle_2','cycle_3')"
    )
    op.execute(
        """
        CREATE TABLE subjects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            code VARCHAR(20) NOT NULL,
            name VARCHAR(120) NOT NULL,
            ncdc_cycle ncdc_cycle NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_subjects_code ON subjects (tenant_id, code) "
        "WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX idx_subjects_tenant_active ON subjects (tenant_id, is_active) "
        "WHERE deleted_at IS NULL"
    )

    op.execute("ALTER TABLE subjects ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE subjects FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON subjects
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
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON subjects TO skulpulse_app")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS subjects CASCADE")
    op.execute("DROP TYPE IF EXISTS ncdc_cycle")
