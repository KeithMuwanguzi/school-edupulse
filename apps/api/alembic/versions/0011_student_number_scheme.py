"""Auto student-number scheme — per-school unique prefix + sequence.

Revision ID: 0011
Revises: 0010
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE schools
            ADD COLUMN student_number_prefix VARCHAR(10) NULL,
            ADD COLUMN student_number_next INTEGER NOT NULL DEFAULT 1
        """
    )
    # Globally unique prefix across all schools (enforced regardless of RLS scope).
    op.execute(
        """
        CREATE UNIQUE INDEX uq_schools_student_number_prefix
        ON schools (student_number_prefix)
        WHERE student_number_prefix IS NOT NULL
        """
    )
    # Platform-wide source of unique prefixes; first school gets 1001.
    op.execute("CREATE SEQUENCE IF NOT EXISTS student_number_prefix_seq START WITH 1001 INCREMENT BY 1")
    op.execute("GRANT USAGE, SELECT ON SEQUENCE student_number_prefix_seq TO skulpulse_app")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_schools_student_number_prefix")
    op.execute(
        """
        ALTER TABLE schools
            DROP COLUMN IF EXISTS student_number_prefix,
            DROP COLUMN IF EXISTS student_number_next
        """
    )
    op.execute("DROP SEQUENCE IF EXISTS student_number_prefix_seq")
