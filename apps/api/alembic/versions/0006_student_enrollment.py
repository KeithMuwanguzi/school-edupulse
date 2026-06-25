"""Phase 2 §5 — student enrollment: class placement and profile fields.

Revision ID: 0006
Revises: 0005
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE students
        ADD COLUMN class_id UUID NULL,
        ADD COLUMN stream_id UUID NULL,
        ADD COLUMN gender VARCHAR(10) NULL,
        ADD COLUMN date_of_birth DATE NULL
        """
    )
    op.execute(
        """
        ALTER TABLE students
        ADD CONSTRAINT fk_students_class
        FOREIGN KEY (tenant_id, class_id) REFERENCES classes (tenant_id, id)
        """
    )
    op.execute(
        """
        ALTER TABLE students
        ADD CONSTRAINT fk_students_stream
        FOREIGN KEY (tenant_id, stream_id) REFERENCES streams (tenant_id, id)
        """
    )
    op.execute(
        """
        CREATE INDEX idx_students_tenant_class ON students (tenant_id, class_id)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX idx_students_tenant_number ON students (tenant_id, student_number)
        WHERE deleted_at IS NULL
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_students_stream")
    op.execute("ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_students_class")
    op.execute(
        """
        ALTER TABLE students
        DROP COLUMN IF EXISTS date_of_birth,
        DROP COLUMN IF EXISTS gender,
        DROP COLUMN IF EXISTS stream_id,
        DROP COLUMN IF EXISTS class_id
        """
    )
