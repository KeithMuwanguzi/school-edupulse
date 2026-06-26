"""Grade bands use one descriptor comment; CT/HT remarks stay on aggregate divisions.

Revision ID: 0033
Revises: 0032
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE grade_ranges
            ADD COLUMN comment TEXT NULL
        """
    )
    op.execute(
        """
        UPDATE grade_ranges
        SET comment = COALESCE(
            NULLIF(TRIM(class_teacher_comment), ''),
            NULLIF(TRIM(head_teacher_comment), '')
        )
        """
    )
    op.execute(
        """
        ALTER TABLE grade_ranges
            DROP COLUMN class_teacher_comment,
            DROP COLUMN head_teacher_comment
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE grade_ranges
            ADD COLUMN class_teacher_comment TEXT NULL,
            ADD COLUMN head_teacher_comment TEXT NULL
        """
    )
    op.execute(
        """
        UPDATE grade_ranges
        SET class_teacher_comment = comment
        WHERE comment IS NOT NULL
        """
    )
    op.execute("ALTER TABLE grade_ranges DROP COLUMN comment")
