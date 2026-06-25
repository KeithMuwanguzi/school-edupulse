"""Per-user module scoping — allowed_modules on tenant_users.

NULL means "no per-user restriction" (the user inherits the school's full
subscribed module set). A JSON array narrows the user to that subset.

Revision ID: 0029
Revises: 0028
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE tenant_users ADD COLUMN allowed_modules JSONB NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE tenant_users DROP COLUMN IF EXISTS allowed_modules")
