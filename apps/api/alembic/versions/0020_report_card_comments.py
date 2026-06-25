"""Term report card comments — class teacher and head teacher remarks.

Revision ID: 0020
Revises: 0019
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _enable_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (
            current_setting('app.bypass_rls', true) = 'on'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
            current_setting('app.bypass_rls', true) = 'on'
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        """
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO skulpulse_app")


def upgrade() -> None:
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
        "CREATE INDEX ix_term_report_card_comments_lookup "
        "ON term_report_card_comments (tenant_id, term_id, student_id)"
    )
    _enable_rls("term_report_card_comments")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS term_report_card_comments")
