"""Timetable — weekly recurring lesson slots.

Revision ID: 0009
Revises: 0008
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE timetable_slots (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            academic_year_id UUID NOT NULL,
            day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
            starts_at TIME NOT NULL,
            ends_at TIME NOT NULL,
            class_id UUID NOT NULL,
            stream_id UUID NULL,
            subject_id UUID NOT NULL,
            teacher_user_id UUID NOT NULL,
            period_label VARCHAR(40) NULL,
            room VARCHAR(40) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            CHECK (ends_at > starts_at),
            FOREIGN KEY (tenant_id, academic_year_id)
                REFERENCES academic_years (tenant_id, id),
            FOREIGN KEY (tenant_id, class_id)
                REFERENCES classes (tenant_id, id),
            FOREIGN KEY (tenant_id, stream_id)
                REFERENCES streams (tenant_id, id),
            FOREIGN KEY (tenant_id, subject_id)
                REFERENCES subjects (tenant_id, id),
            FOREIGN KEY (tenant_id, teacher_user_id)
                REFERENCES tenant_users (tenant_id, id),
            UNIQUE (tenant_id, id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_timetable_teacher_day
        ON timetable_slots (tenant_id, teacher_user_id, day_of_week)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX idx_timetable_class_day
        ON timetable_slots (tenant_id, class_id, day_of_week)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX idx_timetable_year
        ON timetable_slots (tenant_id, academic_year_id)
        WHERE deleted_at IS NULL
        """
    )

    op.execute("ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE timetable_slots FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON timetable_slots
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
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON timetable_slots TO skulpulse_app")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS timetable_slots CASCADE")
