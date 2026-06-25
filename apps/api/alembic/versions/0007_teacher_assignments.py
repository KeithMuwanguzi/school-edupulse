"""Phase 2 §6 — teacher class/subject assignments.

Revision ID: 0007
Revises: 0006
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE tenant_users
        ADD CONSTRAINT uq_tenant_users_tenant_id UNIQUE (tenant_id, id)
        """
    )
    op.execute(
        """
        ALTER TABLE academic_years
        ADD CONSTRAINT uq_academic_years_tenant_id UNIQUE (tenant_id, id)
        """
    )
    op.execute(
        """
        ALTER TABLE terms
        ADD CONSTRAINT uq_terms_tenant_id UNIQUE (tenant_id, id)
        """
    )
    op.execute(
        """
        ALTER TABLE subjects
        ADD CONSTRAINT uq_subjects_tenant_id UNIQUE (tenant_id, id)
        """
    )
    op.execute(
        """
        CREATE TABLE teacher_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            teacher_user_id UUID NOT NULL,
            academic_year_id UUID NOT NULL,
            term_id UUID NULL,
            class_id UUID NOT NULL,
            stream_id UUID NULL,
            subject_id UUID NOT NULL,
            is_class_teacher BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            FOREIGN KEY (tenant_id, teacher_user_id)
                REFERENCES tenant_users (tenant_id, id),
            FOREIGN KEY (tenant_id, academic_year_id)
                REFERENCES academic_years (tenant_id, id),
            FOREIGN KEY (tenant_id, term_id)
                REFERENCES terms (tenant_id, id),
            FOREIGN KEY (tenant_id, class_id)
                REFERENCES classes (tenant_id, id),
            FOREIGN KEY (tenant_id, stream_id)
                REFERENCES streams (tenant_id, id),
            FOREIGN KEY (tenant_id, subject_id)
                REFERENCES subjects (tenant_id, id),
            UNIQUE (tenant_id, id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_teacher_assignments_teacher
        ON teacher_assignments (tenant_id, teacher_user_id)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX idx_teacher_assignments_class
        ON teacher_assignments (tenant_id, class_id)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX idx_teacher_assignments_year_term
        ON teacher_assignments (tenant_id, academic_year_id, term_id)
        WHERE deleted_at IS NULL
        """
    )

    op.execute("ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE teacher_assignments FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON teacher_assignments
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
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_assignments TO skulpulse_app"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS teacher_assignments CASCADE")
    op.execute("ALTER TABLE subjects DROP CONSTRAINT IF EXISTS uq_subjects_tenant_id")
    op.execute("ALTER TABLE terms DROP CONSTRAINT IF EXISTS uq_terms_tenant_id")
    op.execute(
        "ALTER TABLE academic_years DROP CONSTRAINT IF EXISTS uq_academic_years_tenant_id"
    )
    op.execute(
        "ALTER TABLE tenant_users DROP CONSTRAINT IF EXISTS uq_tenant_users_tenant_id"
    )
