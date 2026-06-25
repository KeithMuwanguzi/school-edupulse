"""Subject catalogue — multiple NCDC cycles per subject code.

Revision ID: 0005
Revises: 0004
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE subjects
        ADD COLUMN ncdc_cycles ncdc_cycle[] NULL
        """
    )
    op.execute(
        """
        UPDATE subjects
        SET ncdc_cycles = ARRAY[ncdc_cycle]::ncdc_cycle[]
        """
    )
    op.execute(
        """
        ALTER TABLE subjects
        ALTER COLUMN ncdc_cycles SET NOT NULL
        """
    )
    op.execute("ALTER TABLE subjects DROP COLUMN ncdc_cycle")


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE subjects
        ADD COLUMN ncdc_cycle ncdc_cycle NULL
        """
    )
    op.execute(
        """
        UPDATE subjects
        SET ncdc_cycle = ncdc_cycles[1]
        """
    )
    op.execute(
        """
        ALTER TABLE subjects
        ALTER COLUMN ncdc_cycle SET NOT NULL
        """
    )
    op.execute("ALTER TABLE subjects DROP COLUMN ncdc_cycles")
