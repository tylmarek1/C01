import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class UserRole(enum.StrEnum):
    PLAYER = "PLAYER"
    VENUE_MANAGER = "VENUE_MANAGER"
    # Above VENUE_MANAGER: everything a venue manager can do, plus granting/
    # revoking roles (including ADMIN itself) and permanently deleting a
    # court. See deps.get_current_admin.
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.PLAYER
    )
    # Relative path under /static, e.g. "/static/avatars/<uuid>.jpg" — the
    # frontend prefixes it with the API origin. Null until the user uploads one.
    avatar_url: Mapped[str | None] = mapped_column(String(500), default=None)
    # Opaque, unguessable id used to authenticate the personal .ics calendar
    # feed URL — a calendar app can't send a Bearer header, so this stands in
    # for one. Null until the user requests a feed link; regenerating revokes
    # any URL handed out before.
    calendar_token: Mapped[str | None] = mapped_column(
        String(64), unique=True, default=None
    )
    # NotificationType values the user has muted — `notify()` skips creating
    # a Notification row for any type in this list. Stored as plain strings
    # (like Court.amenities) rather than a second table since it's just a
    # set of on/off toggles.
    muted_notification_types: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), default=list
    )
    bio: Mapped[str | None] = mapped_column(String(300), default=None)
    # Opt-out, not opt-in: a public profile is the sports-app norm (reviews
    # and achievements are already public), so this only needs to exist for
    # the player who wants to hide their stats/bio from other players.
    profile_public: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
