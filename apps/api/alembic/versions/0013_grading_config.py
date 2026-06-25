"""Grading configuration — policy, competence levels, grade bands, CA components.

Revision ID: 0013
Revises: 0012
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
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
        CREATE TABLE assessment_policies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            ca_weight_pct SMALLINT NOT NULL DEFAULT 25,
            use_ple_grading BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (tenant_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_assessment_policies_tenant ON assessment_policies (tenant_id)"
    )
    _enable_rls("assessment_policies")

    op.execute(
        """
        CREATE TABLE competence_levels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            code VARCHAR(12) NOT NULL,
            label VARCHAR(80) NOT NULL,
            description TEXT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            UNIQUE (tenant_id, code)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_competence_levels_tenant ON competence_levels (tenant_id, sort_order)"
    )
    _enable_rls("competence_levels")

    op.execute(
        """
        CREATE TABLE grade_bands (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            label VARCHAR(80) NOT NULL,
            min_mark SMALLINT NOT NULL,
            max_mark SMALLINT NOT NULL,
            ple_grade SMALLINT NULL,
            descriptor VARCHAR(160) NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_grade_bands_tenant ON grade_bands (tenant_id, sort_order)"
    )
    _enable_rls("grade_bands")

    op.execute(
        """
        CREATE TABLE ca_components (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            slug VARCHAR(40) NOT NULL,
            label VARCHAR(120) NOT NULL,
            description TEXT NULL,
            weight_pct SMALLINT NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            UNIQUE (tenant_id, slug)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_ca_components_tenant ON ca_components (tenant_id, sort_order)"
    )
    _enable_rls("ca_components")


def downgrade() -> None:
    for table in (
        "ca_components",
        "grade_bands",
        "competence_levels",
        "assessment_policies",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
