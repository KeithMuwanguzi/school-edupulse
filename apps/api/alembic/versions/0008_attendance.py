"""Phase 2 §7 — daily attendance records.

Revision ID: 0008
Revises: 0007
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE attendance_status AS ENUM ('present','absent','late','excused')"
    )
    op.execute(
        """
        CREATE TABLE attendance_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            student_id UUID NOT NULL,
            attendance_date DATE NOT NULL,
            status attendance_status NOT NULL DEFAULT 'present',
            remarks VARCHAR(255) NULL,
            marked_by_user_id UUID NOT NULL,
            academic_year_id UUID NOT NULL,
            term_id UUID NULL,
            class_id UUID NOT NULL,
            stream_id UUID NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (tenant_id, student_id) REFERENCES students (tenant_id, id),
            FOREIGN KEY (tenant_id, marked_by_user_id) REFERENCES tenant_users (tenant_id, id),
            FOREIGN KEY (tenant_id, academic_year_id) REFERENCES academic_years (tenant_id, id),
            FOREIGN KEY (tenant_id, term_id) REFERENCES terms (tenant_id, id),
            FOREIGN KEY (tenant_id, class_id) REFERENCES classes (tenant_id, id),
            FOREIGN KEY (tenant_id, stream_id) REFERENCES streams (tenant_id, id),
            UNIQUE (tenant_id, student_id, attendance_date)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_attendance_tenant_date
        ON attendance_records (tenant_id, attendance_date)
        """
    )
    op.execute(
        """
        CREATE INDEX idx_attendance_class_date
        ON attendance_records (tenant_id, class_id, attendance_date)
        """
    )
    op.execute(
        """
        CREATE INDEX idx_attendance_term
        ON attendance_records (tenant_id, academic_year_id, term_id)
        """
    )

    op.execute("ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE attendance_records FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON attendance_records
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
        "GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_records TO skulpulse_app"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS attendance_records CASCADE")
    op.execute("DROP TYPE IF EXISTS attendance_status")
