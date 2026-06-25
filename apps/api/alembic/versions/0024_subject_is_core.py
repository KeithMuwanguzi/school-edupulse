"""Add is_core flag to subjects for aggregate computation.

Revision ID: 0024
Revises: 0023
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Core PLE/primary subject codes used to seed sensible defaults. Admins can
# override per subject afterwards.
_CORE_CODE_PATTERNS = (
    "ENG",
    "ENGLISH",
    "MTC",
    "MATH",
    "MATHS",
    "MATHEMATICS",
    "SCI",
    "SCIE",
    "SCIENCE",
    "SST",
    "SOCIAL",
    "SOCIALSTUDIES",
)


def upgrade() -> None:
    op.add_column(
        "subjects",
        sa.Column(
            "is_core",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Seed core flag for the conventional four core subjects by code.
    conditions = " OR ".join(
        [f"UPPER(REPLACE(code, ' ', '')) LIKE '{pat}%'" for pat in _CORE_CODE_PATTERNS]
    )
    op.execute(f"UPDATE subjects SET is_core = true WHERE {conditions}")


def downgrade() -> None:
    op.drop_column("subjects", "is_core")
