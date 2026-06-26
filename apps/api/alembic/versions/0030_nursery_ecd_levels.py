"""Nursery (ECD) class levels and NCDC ecd cycle.

Revision ID: 0030
Revises: 0029
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE class_level ADD VALUE IF NOT EXISTS 'BABY'")
    op.execute("ALTER TYPE class_level ADD VALUE IF NOT EXISTS 'MIDDLE'")
    op.execute("ALTER TYPE class_level ADD VALUE IF NOT EXISTS 'TOP'")
    op.execute("ALTER TYPE ncdc_cycle ADD VALUE IF NOT EXISTS 'ecd'")
    op.execute(
        "ALTER TABLE fee_structure_lines ALTER COLUMN class_level TYPE VARCHAR(10)"
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values safely.
    pass
