"""Payments (ADR-010). New tables only — nothing to backfill.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-08 09:58:15.313474
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reservation_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column(
            "method", sa.Enum("ONLINE", "CASH", name="payment_method"), nullable=False
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "PAID",
                "FAILED",
                "REFUND_PENDING",
                "REFUNDED",
                "REFUND_FAILED",
                name="payment_status",
            ),
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=30), nullable=True),
        sa.Column("provider_ref", sa.String(length=100), nullable=True),
        sa.Column("failure_reason", sa.String(length=300), nullable=True),
        sa.Column("refund_attempts", sa.Integer(), nullable=False),
        sa.Column("recorded_by_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("amount > 0", name="payment_amount_positive"),
        sa.ForeignKeyConstraint(
            ["recorded_by_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["reservation_id"],
            ["reservations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_payments_reservation_id"), "payments", ["reservation_id"], unique=False
    )
    op.create_index(
        "payment_one_live_per_reservation",
        "payments",
        ["reservation_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('PENDING', 'PAID', 'REFUND_PENDING')"),
    )


def downgrade() -> None:
    op.drop_index(
        "payment_one_live_per_reservation",
        table_name="payments",
        postgresql_where=sa.text("status IN ('PENDING', 'PAID', 'REFUND_PENDING')"),
    )
    op.drop_index(op.f("ix_payments_reservation_id"), table_name="payments")
    op.drop_table("payments")
    op.execute("DROP TYPE IF EXISTS payment_status")
    op.execute("DROP TYPE IF EXISTS payment_method")
