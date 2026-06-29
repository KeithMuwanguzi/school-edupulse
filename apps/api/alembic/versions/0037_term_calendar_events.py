"""Term calendar events — school programme dates per term.

Revision ID: 0037
Revises: 0036
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0037"
down_revision: Union[str, None] = "0036"
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
        CREATE TYPE term_calendar_event_type AS ENUM (
            'short_holiday',
            'visitation',
            'class_meeting',
            'sports_day',
            'exam_period',
            'opening_day',
            'closing_day',
            'other'
        )
        """
    )
    op.execute(
        """
        CREATE TABLE term_calendar_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            academic_year_id UUID NOT NULL REFERENCES academic_years(id),
            term_id UUID NOT NULL REFERENCES terms(id),
            event_type term_calendar_event_type NOT NULL,
            title VARCHAR(160) NOT NULL,
            starts_on DATE NOT NULL,
            ends_on DATE NOT NULL,
            description TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ NULL,
            CONSTRAINT term_calendar_events_dates_check CHECK (ends_on >= starts_on)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX ix_term_calendar_events_tenant_term
        ON term_calendar_events (tenant_id, term_id, starts_on)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX ix_term_calendar_events_tenant_year
        ON term_calendar_events (tenant_id, academic_year_id, starts_on)
        WHERE deleted_at IS NULL
        """
    )
    _enable_rls("term_calendar_events")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS term_calendar_events")
    op.execute("DROP TYPE IF EXISTS term_calendar_event_type")
