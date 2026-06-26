"""Unique school contact email (credentials are sent here on onboard)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_schools_email_active",
        "schools",
        [sa.text("lower(trim(email))")],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND email IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_schools_email_active", table_name="schools")
