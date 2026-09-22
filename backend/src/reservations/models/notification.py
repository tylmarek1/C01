import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class NotificationType(enum.StrEnum):
    RESERVATION_CREATED = "RESERVATION_CREATED"
    RESERVATION_CONFIRMED = "RESERVATION_CONFIRMED"
    RESERVATION_CANCELLED = "RESERVATION_CANCELLED"
    RESERVATION_CHANGED = "RESERVATION_CHANGED"
    RESERVATION_REMINDER = "RESERVATION_REMINDER"
    RESERVATION_EXPIRED = "RESERVATION_EXPIRED"
    RESERVATION_REJECTED = "RESERVATION_REJECTED"
    APPROVAL_REQUESTED = "APPROVAL_REQUESTED"  # sent to venue managers
    FACILITY_UNAVAILABLE = "FACILITY_UNAVAILABLE"
    WAITLIST_JOINED = "WAITLIST_JOINED"
    WAITLIST_SLOT_OFFERED = "WAITLIST_SLOT_OFFERED"
    ACHIEVEMENT_UNLOCKED = "ACHIEVEMENT_UNLOCKED"
    JOIN_REQUEST_RECEIVED = "JOIN_REQUEST_RECEIVED"
    JOIN_REQUEST_ACCEPTED = "JOIN_REQUEST_ACCEPTED"
    JOIN_REQUEST_DECLINED = "JOIN_REQUEST_DECLINED"
    NEW_FOLLOWER = "NEW_FOLLOWER"
    TEAM_MEMBER_ADDED = "TEAM_MEMBER_ADDED"
    MATCH_RESULT_REPORTED = "MATCH_RESULT_REPORTED"
    CHALLENGE_COMPLETED = "CHALLENGE_COMPLETED"
    TEAM_JOIN_REQUEST_RECEIVED = "TEAM_JOIN_REQUEST_RECEIVED"  # sent to owner/captains
    TEAM_JOIN_REQUEST_ACCEPTED = "TEAM_JOIN_REQUEST_ACCEPTED"
    TEAM_JOIN_REQUEST_DECLINED = "TEAM_JOIN_REQUEST_DECLINED"


class Notification(Base):
    """Purely internal, in-app notifications — no email/SMS delivery."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type")
    )
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(String(500))
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
