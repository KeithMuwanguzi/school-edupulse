"""School report card footer settings.

Revision ID: 0027
Revises: 0026
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE schools
        ADD COLUMN report_footer_notes TEXT NULL,
        ADD COLUMN report_next_term_note VARCHAR(255) NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE schools
        DROP COLUMN IF EXISTS report_footer_notes,
        DROP COLUMN IF EXISTS report_next_term_note
        """
    )
