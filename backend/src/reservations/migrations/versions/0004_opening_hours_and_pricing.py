"""Opening hours and price rules in the database (ADR-009).

Backfill, so nothing changes for existing data:
- every existing venue opens 07:00–22:00 every day — the hours that were
  hardcoded in schemas/reservation.py until now;
- every existing reservation gets the price the cost split showed for it
  so far: the court's price_per_hour times its length (null if unpriced).

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-08 09:25:03.789554
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "venue_opening_hours",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("venue_id", sa.Uuid(), nullable=False),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("opens_minute", sa.SmallInteger(), nullable=False),
        sa.Column("closes_minute", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "opens_minute >= 0 AND closes_minute <= 1440 AND opens_minute < closes_minute",
            name="opening_hours_order",
        ),
        sa.CheckConstraint(
            "weekday BETWEEN 0 AND 6", name="opening_hours_weekday_range"
        ),
        sa.ForeignKeyConstraint(
            ["venue_id"],
            ["venues.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "venue_id", "weekday", name="opening_hours_one_per_weekday"
        ),
    )
    op.create_table(
        "court_price_rules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("start_minute", sa.SmallInteger(), nullable=False),
        sa.Column("end_minute", sa.SmallInteger(), nullable=False),
        sa.Column("price_per_hour", sa.Numeric(precision=8, scale=2), nullable=False),
        postgresql.ExcludeConstraint(
            (sa.literal_column("court_id"), "="),
            (sa.literal_column("weekday"), "="),
            (sa.literal_column("int4range(start_minute, end_minute)"), "&&"),
            using="gist",
            name="no_overlapping_price_rules",
        ),
        sa.CheckConstraint("price_per_hour >= 0", name="price_rule_not_negative"),
        sa.CheckConstraint(
            "start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute",
            name="price_rule_order",
        ),
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="price_rule_weekday_range"),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column(
        "reservations",
        sa.Column("price_total", sa.Numeric(precision=8, scale=2), nullable=True),
    )

    op.execute(
        "INSERT INTO venue_opening_hours (id, venue_id, weekday, opens_minute, closes_minute) "
        "SELECT gen_random_uuid(), v.id, d.weekday, 420, 1320 "
        "FROM venues v CROSS JOIN generate_series(0, 6) AS d(weekday)"
    )
    op.execute(
        "UPDATE reservations r SET price_total = round(c.price_per_hour "
        "* extract(epoch FROM (r.end_time - r.start_time)) / 3600, 2) "
        "FROM courts c WHERE c.id = r.court_id AND c.price_per_hour IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("reservations", "price_total")
    op.drop_table("court_price_rules")
    op.drop_table("venue_opening_hours")
