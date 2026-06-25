"""Phase 2 §9 — assessment sets, CA config, student marks.

Revision ID: 0023
Revises: 0022
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0023"
down_revision: Union[str, None] = "0022"
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
        CREATE TABLE assessment_sets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            term_id UUID NOT NULL,
            name VARCHAR(120) NOT NULL,
            description TEXT NULL,
            max_mark INTEGER NOT NULL DEFAULT 100 CHECK (max_mark > 0),
            sort_order INTEGER NOT NULL DEFAULT 0,
            entry_status VARCHAR(20) NOT NULL DEFAULT 'draft',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            FOREIGN KEY (tenant_id, term_id) REFERENCES terms (tenant_id, id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_assessment_sets_term
        ON assessment_sets (tenant_id, term_id, entry_status, sort_order)
        """
    )
    op.execute(
        "ALTER TABLE assessment_sets ADD CONSTRAINT uq_assessment_sets_tenant_id UNIQUE (tenant_id, id)"
    )
    _enable_rls("assessment_sets")

    op.execute(
        """
        CREATE TABLE term_ca_policies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            term_id UUID NOT NULL,
            method VARCHAR(30) NOT NULL DEFAULT 'average',
            notes TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (tenant_id, term_id) REFERENCES terms (tenant_id, id),
            UNIQUE (tenant_id, term_id)
        )
        """
    )
    _enable_rls("term_ca_policies")

    op.execute(
        """
        CREATE TABLE ca_set_inclusions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            term_id UUID NOT NULL,
            set_id UUID NOT NULL,
            weight NUMERIC(8, 2) NOT NULL DEFAULT 1.0 CHECK (weight > 0),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (tenant_id, term_id) REFERENCES terms (tenant_id, id),
            FOREIGN KEY (tenant_id, set_id) REFERENCES assessment_sets (tenant_id, id) ON DELETE CASCADE,
            UNIQUE (tenant_id, term_id, set_id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_ca_set_inclusions_term
        ON ca_set_inclusions (tenant_id, term_id, sort_order)
        """
    )
    _enable_rls("ca_set_inclusions")

    op.execute(
        """
        CREATE TABLE student_assessment_marks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            term_id UUID NOT NULL,
            set_id UUID NOT NULL,
            student_id UUID NOT NULL,
            subject_id UUID NOT NULL,
            score NUMERIC(6, 2) NULL CHECK (score IS NULL OR score >= 0),
            competence_level VARCHAR(40) NULL,
            remark VARCHAR(255) NULL,
            entered_by_user_id UUID NULL,
            entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (tenant_id, term_id) REFERENCES terms (tenant_id, id),
            FOREIGN KEY (tenant_id, set_id) REFERENCES assessment_sets (tenant_id, id),
            FOREIGN KEY (tenant_id, student_id) REFERENCES students (tenant_id, id),
            FOREIGN KEY (tenant_id, subject_id) REFERENCES subjects (tenant_id, id),
            UNIQUE (tenant_id, set_id, student_id, subject_id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_student_assessment_marks_lookup
        ON student_assessment_marks (tenant_id, term_id, set_id, subject_id)
        """
    )
    op.execute(
        """
        CREATE INDEX idx_student_assessment_marks_student
        ON student_assessment_marks (tenant_id, student_id, term_id)
        """
    )
    _enable_rls("student_assessment_marks")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS student_assessment_marks")
    op.execute("DROP TABLE IF EXISTS ca_set_inclusions")
    op.execute("DROP TABLE IF EXISTS term_ca_policies")
    op.execute("DROP TABLE IF EXISTS assessment_sets")
