"""School report card layout configuration.

Revision ID: 0036
Revises: 0035
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0036"
down_revision: Union[str, None] = "0035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE schools
        ADD COLUMN IF NOT EXISTS report_card_layout JSONB NOT NULL DEFAULT '{
            "template_id": "uneb_standard_v1",
            "document_title": "Terminal Report",
            "primary_color": "#0f4c43",
            "sections": {
                "header": true,
                "assessment_matrix": true,
                "subject_performance": true,
                "summary_bar": true,
                "grading_key": true,
                "attendance": true,
                "teacher_comments": true,
                "footer": true,
                "signatures": true,
                "show_aggregate": true
            }
        }'::jsonb
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE schools DROP COLUMN IF EXISTS report_card_layout")
