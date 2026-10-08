"""Venues, venue managers, and courts.venue_id (ADR-008).

Backfill: an existing database gets one venue, "Courtly Sports Club"
(the same name `seed.py` uses), owning every court, and every current
VENUE_MANAGER is assigned to it — so nobody's access changes by the
upgrade itself. An empty database gets no venue.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-08 09:05:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_VENUE_NAME = "Courtly Sports Club"


def upgrade() -> None:
    op.create_table(
        "venues",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("address", sa.String(length=200), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "venue_managers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("venue_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("venue_id", "user_id", name="venue_manager_once"),
    )
    op.create_index("ix_venue_managers_user_id", "venue_managers", ["user_id"])

    op.add_column("courts", sa.Column("venue_id", sa.Uuid(), nullable=True))
    op.execute(
        sa.text(
            "INSERT INTO venues (id, name, active) "
            "SELECT gen_random_uuid(), :name, true "
            "WHERE EXISTS (SELECT 1 FROM courts) "
            "OR EXISTS (SELECT 1 FROM users WHERE role = 'VENUE_MANAGER')"
        ).bindparams(name=DEFAULT_VENUE_NAME)
    )
    op.execute(
        sa.text(
            "UPDATE courts SET venue_id = (SELECT id FROM venues WHERE name = :name)"
        ).bindparams(name=DEFAULT_VENUE_NAME)
    )
    op.execute(
        sa.text(
            "INSERT INTO venue_managers (id, venue_id, user_id) "
            "SELECT gen_random_uuid(), v.id, u.id FROM users u, venues v "
            "WHERE u.role = 'VENUE_MANAGER' AND v.name = :name"
        ).bindparams(name=DEFAULT_VENUE_NAME)
    )
    op.alter_column("courts", "venue_id", nullable=False)
    op.create_index("ix_courts_venue_id", "courts", ["venue_id"])
    op.create_foreign_key(
        "courts_venue_id_fkey", "courts", "venues", ["venue_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("courts_venue_id_fkey", "courts", type_="foreignkey")
    op.drop_index("ix_courts_venue_id", table_name="courts")
    op.drop_column("courts", "venue_id")
    op.drop_index("ix_venue_managers_user_id", table_name="venue_managers")
    op.drop_table("venue_managers")
    op.drop_table("venues")
