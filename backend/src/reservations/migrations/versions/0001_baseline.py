"""Baseline: the schema exactly as `create_all` built it before Alembic (ADR-006).

An existing database created that way is stamped at this revision instead
of being migrated through it — see `db.migrate()`.

Revision ID: 0001
Revises:
Create Date: 2026-10-08 08:20:06.851371
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # btree_gist lets the GiST exclusion constraint on reservations compare court_id with "=".
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.create_table(
        "courts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "sport_type",
            sa.Enum("TENNIS", "VOLLEYBALL", "BADMINTON", name="sport_type"),
            nullable=False,
        ),
        sa.Column("indoor", sa.Boolean(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("requires_approval", sa.Boolean(), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("amenities", postgresql.ARRAY(sa.String(length=50)), nullable=False),
        sa.Column("price_per_hour", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("PLAYER", "VENUE_MANAGER", "ADMIN", name="user_role"),
            nullable=False,
        ),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("calendar_token", sa.String(length=64), nullable=True),
        sa.Column(
            "muted_notification_types",
            postgresql.ARRAY(sa.String(length=50)),
            nullable=False,
        ),
        sa.Column("bio", sa.String(length=300), nullable=True),
        sa.Column("profile_public", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("calendar_token"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "activity_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "challenges",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column(
            "sport_type",
            sa.Enum("TENNIS", "VOLLEYBALL", "BADMINTON", name="sport_type"),
            nullable=True,
        ),
        sa.Column(
            "metric",
            sa.Enum(
                "RESERVATIONS_COMPLETED",
                "COURTS_PLAYED",
                "GUESTS_INVITED",
                "REVIEWS_WRITTEN",
                name="challenge_metric",
            ),
            nullable=False,
        ),
        sa.Column("target", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "court_images",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "facility_blocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(length=300), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("series_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_facility_blocks_series_id"),
        "facility_blocks",
        ["series_id"],
        unique=False,
    )
    op.create_table(
        "favorites",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "court_id", name="favorite_unique_per_user_court"
        ),
    )
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
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
                name="notification_type",
            ),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "player_follows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("follower_id", sa.Uuid(), nullable=False),
        sa.Column("followee_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["followee_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["follower_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("follower_id", "followee_id", name="player_follow_unique"),
    )
    op.create_table(
        "push_deliveries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "SENT", "FAILED", name="push_delivery_status"),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("endpoint", sa.String(length=1000), nullable=False),
        sa.Column("p256dh", sa.String(length=255), nullable=False),
        sa.Column("auth", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("endpoint", name="push_subscription_unique_endpoint"),
    )
    op.create_table(
        "reservation_series",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("first_start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("first_end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("weeks", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "skill_ratings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "sport_type",
            sa.Enum("TENNIS", "VOLLEYBALL", "BADMINTON", name="sport_type"),
            nullable=False,
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("matches_played", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "sport_type", name="skill_rating_unique"),
    )
    op.create_table(
        "teams",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column(
            "sport_type",
            sa.Enum("TENNIS", "VOLLEYBALL", "BADMINTON", name="sport_type"),
            nullable=True,
        ),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "user_achievements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column(
            "earned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "key", name="user_achievement_unique"),
    )
    op.create_table(
        "waitlist_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "WAITING",
                "OFFERED",
                "ACCEPTED",
                "EXPIRED",
                "CANCELLED",
                name="waitlist_status",
            ),
            nullable=False,
        ),
        sa.Column("offer_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "challenge_completions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("challenge_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["challenge_id"],
            ["challenges.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "challenge_id", "user_id", name="challenge_completion_unique"
        ),
    )
    op.create_table(
        "reservations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "PENDING_APPROVAL",
                "CONFIRMED",
                "CHECKED_IN",
                "COMPLETED",
                "CANCELLED",
                "EXPIRED",
                "REJECTED",
                "NO_SHOW",
                name="reservation_status",
            ),
            nullable=False,
        ),
        sa.Column("hold_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("series_id", sa.Uuid(), nullable=True),
        sa.Column("open_to_join", sa.Boolean(), nullable=False),
        sa.Column("open_note", sa.String(length=200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        postgresql.ExcludeConstraint(
            (sa.literal_column("court_id"), "="),
            (sa.literal_column("tstzrange(start_time, end_time, '[)')"), "&&"),
            where=sa.text(
                "status IN ('PENDING', 'PENDING_APPROVAL', 'CONFIRMED', 'CHECKED_IN')"
            ),
            using="gist",
            name="no_overlapping_active_reservations",
        ),
        sa.CheckConstraint("end_time > start_time", name="reservation_time_order"),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["series_id"],
            ["reservation_series.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "team_join_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "ACCEPTED",
                "DECLINED",
                "CANCELLED",
                name="team_join_request_status",
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "team_id", "user_id", name="team_join_request_unique_per_user_team"
        ),
    )
    op.create_table(
        "team_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "role",
            sa.Enum("OWNER", "CAPTAIN", "MEMBER", name="team_role"),
            nullable=False,
        ),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team_id", "user_id", name="team_member_unique"),
    )
    op.create_table(
        "conversations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum("DM", "RESERVATION", "TEAM", name="conversation_kind"),
            nullable=False,
        ),
        sa.Column("dm_key", sa.String(length=73), nullable=True),
        sa.Column("reservation_id", sa.Uuid(), nullable=True),
        sa.Column("team_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["reservation_id"],
            ["reservations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dm_key"),
        sa.UniqueConstraint("reservation_id"),
        sa.UniqueConstraint("team_id"),
    )
    op.create_table(
        "join_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reservation_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "ACCEPTED",
                "DECLINED",
                "CANCELLED",
                name="join_request_status",
            ),
            nullable=False,
        ),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
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
        sa.UniqueConstraint(
            "reservation_id", "user_id", name="join_request_unique_per_user_reservation"
        ),
    )
    op.create_table(
        "match_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reservation_id", sa.Uuid(), nullable=False),
        sa.Column("reported_by", sa.Uuid(), nullable=False),
        sa.Column("winner_user_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["reported_by"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["reservation_id"],
            ["reservations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["winner_user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("reservation_id", name="match_result_one_per_reservation"),
    )
    op.create_table(
        "reservation_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reservation_id", sa.Uuid(), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum(
                "CREATED",
                "SUBMITTED",
                "CONFIRMED",
                "CHECKED_IN",
                "COMPLETED",
                "CANCELLED",
                "EXPIRED",
                "REJECTED",
                "NO_SHOW",
                "TIME_CHANGED",
                name="reservation_event_type",
            ),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["reservation_id"],
            ["reservations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "reservation_guests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reservation_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("invited_by_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["invited_by_id"],
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
        sa.UniqueConstraint(
            "reservation_id", "user_id", name="reservation_guest_unique"
        ),
    )
    op.create_table(
        "reviews",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("reservation_id", sa.Uuid(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.String(length=1000), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("manager_reply", sa.String(length=1000), nullable=True),
        sa.Column("manager_reply_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="review_rating_range"),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
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
        sa.UniqueConstraint("reservation_id", name="review_one_per_reservation"),
    )
    op.create_table(
        "conversation_participants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "conversation_id", "user_id", name="conversation_participant_unique"
        ),
    )
    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("sender_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.String(length=1000), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["sender_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "review_comments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("review_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.String(length=500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["review_id"],
            ["reviews.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "review_images",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("review_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["review_id"],
            ["reviews.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "review_votes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("review_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["review_id"],
            ["reviews.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("review_id", "user_id", name="review_vote_unique_per_user"),
    )
    op.create_table(
        "message_reactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("message_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("emoji", sa.String(length=8), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["messages.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "message_id", "user_id", "emoji", name="message_reaction_unique"
        ),
    )


def downgrade() -> None:
    op.drop_table("message_reactions")
    op.drop_table("review_votes")
    op.drop_table("review_images")
    op.drop_table("review_comments")
    op.drop_table("messages")
    op.drop_table("conversation_participants")
    op.drop_table("reviews")
    op.drop_table("reservation_guests")
    op.drop_table("reservation_events")
    op.drop_table("match_results")
    op.drop_table("join_requests")
    op.drop_table("conversations")
    op.drop_table("team_members")
    op.drop_table("team_join_requests")
    op.drop_table("reservations")
    op.drop_table("challenge_completions")
    op.drop_table("waitlist_entries")
    op.drop_table("user_achievements")
    op.drop_table("teams")
    op.drop_table("skill_ratings")
    op.drop_table("reservation_series")
    op.drop_table("push_subscriptions")
    op.drop_table("push_deliveries")
    op.drop_table("player_follows")
    op.drop_table("notifications")
    op.drop_table("favorites")
    op.drop_index(op.f("ix_facility_blocks_series_id"), table_name="facility_blocks")
    op.drop_table("facility_blocks")
    op.drop_table("court_images")
    op.drop_table("challenges")
    op.drop_table("activity_events")
    op.drop_table("users")
    op.drop_table("courts")
    op.execute("DROP TYPE IF EXISTS challenge_metric")
    op.execute("DROP TYPE IF EXISTS conversation_kind")
    op.execute("DROP TYPE IF EXISTS join_request_status")
    op.execute("DROP TYPE IF EXISTS notification_type")
    op.execute("DROP TYPE IF EXISTS push_delivery_status")
    op.execute("DROP TYPE IF EXISTS reservation_event_type")
    op.execute("DROP TYPE IF EXISTS reservation_status")
    op.execute("DROP TYPE IF EXISTS sport_type")
    op.execute("DROP TYPE IF EXISTS team_join_request_status")
    op.execute("DROP TYPE IF EXISTS team_role")
    op.execute("DROP TYPE IF EXISTS user_role")
    op.execute("DROP TYPE IF EXISTS waitlist_status")
