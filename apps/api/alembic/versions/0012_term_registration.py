"""Term registration — configurable sections, requirements, and per-term records.

Revision ID: 0012
Revises: 0011
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
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
        CREATE TABLE registration_sections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            slug VARCHAR(40) NOT NULL,
            label VARCHAR(120) NOT NULL,
            description TEXT NULL,
            icon VARCHAR(40) NULL,
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
        "CREATE INDEX ix_registration_sections_tenant ON registration_sections (tenant_id, sort_order)"
    )
    _enable_rls("registration_sections")

    op.execute(
        """
        CREATE TABLE registration_requirements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            section_id UUID NOT NULL REFERENCES registration_sections(id),
            slug VARCHAR(40) NOT NULL,
            label VARCHAR(160) NOT NULL,
            description TEXT NULL,
            field_type VARCHAR(20) NOT NULL DEFAULT 'checkbox',
            is_required BOOLEAN NOT NULL DEFAULT true,
            options JSONB NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            UNIQUE (tenant_id, section_id, slug)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_registration_requirements_section "
        "ON registration_requirements (tenant_id, section_id, sort_order)"
    )
    _enable_rls("registration_requirements")

    op.execute(
        """
        CREATE TABLE student_term_registrations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            student_id UUID NOT NULL,
            term_id UUID NOT NULL REFERENCES terms(id),
            status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
            class_id UUID NULL,
            stream_id UUID NULL,
            started_by_user_id UUID NULL,
            completed_at TIMESTAMPTZ NULL,
            completed_by_user_id UUID NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (tenant_id, student_id, term_id),
            FOREIGN KEY (tenant_id, student_id) REFERENCES students (tenant_id, id)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_student_term_registrations_term "
        "ON student_term_registrations (tenant_id, term_id, status)"
    )
    _enable_rls("student_term_registrations")

    op.execute(
        """
        CREATE TABLE student_registration_responses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            registration_id UUID NOT NULL REFERENCES student_term_registrations(id),
            requirement_id UUID NOT NULL REFERENCES registration_requirements(id),
            value JSONB NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            notes TEXT NULL,
            recorded_by_user_id UUID NULL,
            recorded_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (tenant_id, registration_id, requirement_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_student_registration_responses_reg "
        "ON student_registration_responses (tenant_id, registration_id)"
    )
    _enable_rls("student_registration_responses")


def downgrade() -> None:
    for table in (
        "student_registration_responses",
        "student_term_registrations",
        "registration_requirements",
        "registration_sections",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
