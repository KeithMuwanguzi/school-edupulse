"""Phase 2 §12–§13 — fee structures, student invoices, manual payments.

Revision ID: 0022
Revises: 0021
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0022"
down_revision: Union[str, None] = "0021"
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
        CREATE TABLE fee_structures (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            term_id UUID NOT NULL,
            name VARCHAR(160) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            due_on DATE NULL,
            notes TEXT NULL,
            activated_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (tenant_id, term_id) REFERENCES terms (tenant_id, id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_fee_structures_term
        ON fee_structures (tenant_id, term_id, status)
        """
    )
    op.execute(
        "ALTER TABLE fee_structures ADD CONSTRAINT uq_fee_structures_tenant_id UNIQUE (tenant_id, id)"
    )
    _enable_rls("fee_structures")

    op.execute(
        """
        CREATE TABLE fee_structure_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            structure_id UUID NOT NULL,
            label VARCHAR(120) NOT NULL,
            amount_ugx INTEGER NOT NULL CHECK (amount_ugx >= 0),
            applies_to VARCHAR(20) NOT NULL DEFAULT 'all',
            class_level VARCHAR(3) NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_optional BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (tenant_id, structure_id) REFERENCES fee_structures (tenant_id, id) ON DELETE CASCADE
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_fee_structure_lines_structure
        ON fee_structure_lines (tenant_id, structure_id, sort_order)
        """
    )
    _enable_rls("fee_structure_lines")

    op.execute(
        """
        CREATE TABLE fee_invoices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            student_id UUID NOT NULL,
            term_id UUID NOT NULL,
            structure_id UUID NOT NULL,
            invoice_number VARCHAR(40) NOT NULL,
            total_ugx INTEGER NOT NULL CHECK (total_ugx >= 0),
            amount_paid_ugx INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_ugx >= 0),
            status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
            issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            due_on DATE NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (tenant_id, student_id) REFERENCES students (tenant_id, id),
            FOREIGN KEY (tenant_id, term_id) REFERENCES terms (tenant_id, id),
            FOREIGN KEY (tenant_id, structure_id) REFERENCES fee_structures (tenant_id, id),
            UNIQUE (tenant_id, invoice_number),
            UNIQUE (tenant_id, student_id, term_id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_fee_invoices_term_status
        ON fee_invoices (tenant_id, term_id, status)
        """
    )
    op.execute(
        "ALTER TABLE fee_invoices ADD CONSTRAINT uq_fee_invoices_tenant_id UNIQUE (tenant_id, id)"
    )
    _enable_rls("fee_invoices")

    op.execute(
        """
        CREATE TABLE fee_invoice_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            invoice_id UUID NOT NULL,
            label VARCHAR(120) NOT NULL,
            amount_ugx INTEGER NOT NULL CHECK (amount_ugx >= 0),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (tenant_id, invoice_id) REFERENCES fee_invoices (tenant_id, id) ON DELETE CASCADE
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_fee_invoice_lines_invoice
        ON fee_invoice_lines (tenant_id, invoice_id, sort_order)
        """
    )
    _enable_rls("fee_invoice_lines")

    op.execute(
        """
        CREATE TABLE fee_payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            invoice_id UUID NOT NULL,
            amount_ugx INTEGER NOT NULL CHECK (amount_ugx > 0),
            method VARCHAR(30) NOT NULL DEFAULT 'cash',
            reference VARCHAR(80) NULL,
            paid_on DATE NOT NULL,
            note TEXT NULL,
            recorded_by_user_id UUID NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (tenant_id, invoice_id) REFERENCES fee_invoices (tenant_id, id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id, recorded_by_user_id) REFERENCES tenant_users (tenant_id, id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX idx_fee_payments_invoice
        ON fee_payments (tenant_id, invoice_id, paid_on DESC)
        """
    )
    _enable_rls("fee_payments")


def downgrade() -> None:
    for table in (
        "fee_payments",
        "fee_invoice_lines",
        "fee_invoices",
        "fee_structure_lines",
        "fee_structures",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
