"""Admission withdrawal reason — closed applications archive.

Revision ID: 0018
Revises: 0017
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE admission_applications
        ADD COLUMN withdrawal_reason VARCHAR(20) NULL,
        ADD COLUMN withdrawal_note TEXT NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE admission_applications
        DROP COLUMN IF EXISTS withdrawal_note,
        DROP COLUMN IF EXISTS withdrawal_reason
        """
    )
