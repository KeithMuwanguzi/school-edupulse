"""Per-lesson attendance — link records to timetable slots.

Revision ID: 0025
Revises: 0024
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE attendance_records
        ADD COLUMN timetable_slot_id UUID NULL
        REFERENCES timetable_slots(id)
        """
    )
    op.execute(
        "ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_tenant_id_student_id_attendance_date_key"
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_attendance_daily
        ON attendance_records (tenant_id, student_id, attendance_date)
        WHERE timetable_slot_id IS NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_attendance_per_slot
        ON attendance_records (tenant_id, student_id, attendance_date, timetable_slot_id)
        WHERE timetable_slot_id IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE INDEX idx_attendance_slot_date
        ON attendance_records (tenant_id, timetable_slot_id, attendance_date)
        WHERE timetable_slot_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_attendance_slot_date")
    op.execute("DROP INDEX IF EXISTS uq_attendance_per_slot")
    op.execute("DROP INDEX IF EXISTS uq_attendance_daily")
    op.execute(
        """
        ALTER TABLE attendance_records
        DROP COLUMN IF EXISTS timetable_slot_id
        """
    )
    op.execute(
        """
        ALTER TABLE attendance_records
        ADD CONSTRAINT attendance_records_tenant_id_student_id_attendance_date_key
        UNIQUE (tenant_id, student_id, attendance_date)
        """
    )
