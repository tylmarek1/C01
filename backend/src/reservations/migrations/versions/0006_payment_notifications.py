"""Payment notification types (ADR-010 amendment).

New values on the existing notification_type enum — autogenerate doesn't
see those, so this one is written by hand (backend/CLAUDE.md).

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-08 12:00:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_VALUES = ("PAYMENT_RECEIVED", "PAYMENT_REFUNDED", "REFUND_FAILED")
OLD_VALUES = (
    "RESERVATION_CREATED",
    "RESERVATION_CONFIRMED",
    "RESERVATION_CANCELLED",
    "RESERVATION_CHANGED",
    "RESERVATION_REMINDER",
    "RESERVATION_EXPIRED",
    "RESERVATION_REJECTED",
    "APPROVAL_REQUESTED",
    "FACILITY_UNAVAILABLE",
    "WAITLIST_JOINED",
    "WAITLIST_SLOT_OFFERED",
    "ACHIEVEMENT_UNLOCKED",
    "JOIN_REQUEST_RECEIVED",
    "JOIN_REQUEST_ACCEPTED",
    "JOIN_REQUEST_DECLINED",
    "NEW_FOLLOWER",
    "TEAM_MEMBER_ADDED",
    "MATCH_RESULT_REPORTED",
    "CHALLENGE_COMPLETED",
    "TEAM_JOIN_REQUEST_RECEIVED",
    "TEAM_JOIN_REQUEST_ACCEPTED",
    "TEAM_JOIN_REQUEST_DECLINED",
)


def upgrade() -> None:
    for value in NEW_VALUES:
        op.execute(f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres can't drop an enum value: drop the rows that use one, then
    # rebuild the type without them.
    values = ", ".join(f"'{v}'" for v in NEW_VALUES)
    op.execute(f"DELETE FROM notifications WHERE type::text IN ({values})")
    op.execute("ALTER TYPE notification_type RENAME TO notification_type_old")
    op.execute(
        f"CREATE TYPE notification_type AS ENUM ({', '.join(repr(v) for v in OLD_VALUES)})"
    )
    op.execute(
        "ALTER TABLE notifications ALTER COLUMN type TYPE notification_type "
        "USING type::text::notification_type"
    )
    op.execute("DROP TYPE notification_type_old")
