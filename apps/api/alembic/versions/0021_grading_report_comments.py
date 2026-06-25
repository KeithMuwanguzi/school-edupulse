"""Grading band report comments + drop per-student comment rows.

Revision ID: 0021
Revises: 0020
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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

    op.execute(
        """
        ALTER TABLE aggregate_divisions
            ADD COLUMN class_teacher_comment TEXT NULL,
            ADD COLUMN head_teacher_comment TEXT NULL
        """
    )
    op.execute(
        """
        UPDATE aggregate_divisions
        SET class_teacher_comment = comment
        WHERE comment IS NOT NULL
        """
    )
    op.execute("ALTER TABLE aggregate_divisions DROP COLUMN comment")

    op.execute("DROP TABLE IF EXISTS term_report_card_comments")


def downgrade() -> None:
    op.execute(
        """
        CREATE TABLE term_report_card_comments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            student_id UUID NOT NULL,
            term_id UUID NOT NULL REFERENCES terms(id),
            class_teacher_comment TEXT NULL,
            head_teacher_comment TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (tenant_id, student_id, term_id)
        )
        """
    )

    op.execute(
        """
        ALTER TABLE aggregate_divisions
            ADD COLUMN comment TEXT NULL
        """
    )
    op.execute(
        """
        UPDATE aggregate_divisions
        SET comment = COALESCE(class_teacher_comment, head_teacher_comment)
        """
    )
    op.execute(
        """
        ALTER TABLE aggregate_divisions
            DROP COLUMN class_teacher_comment,
            DROP COLUMN head_teacher_comment
        """
    )

    op.execute(
        """
        ALTER TABLE grade_ranges
            ADD COLUMN comment TEXT NULL
        """
    )
    op.execute(
        """
        UPDATE grade_ranges
        SET comment = COALESCE(class_teacher_comment, head_teacher_comment)
        """
    )
    op.execute(
        """
        ALTER TABLE grade_ranges
            DROP COLUMN class_teacher_comment,
            DROP COLUMN head_teacher_comment
        """
    )
