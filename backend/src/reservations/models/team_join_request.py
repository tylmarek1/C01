import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reservations.db import Base
from reservations.models.user import User


class TeamJoinRequestStatus(enum.StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    CANCELLED = "CANCELLED"


class TeamJoinRequest(Base):
    """A request from a player to join a public team — same shape as
    JoinRequest (models/join_request.py), which does the equivalent for an
    open reservation slot. Accepting one creates the usual TeamMember row,
    so the rest of the app never has to know requests exist."""

    __tablename__ = "team_join_requests"
    __table_args__ = (
        UniqueConstraint(
            "team_id", "user_id", name="team_join_request_unique_per_user_team"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[TeamJoinRequestStatus] = mapped_column(
        Enum(TeamJoinRequestStatus, name="team_join_request_status"),
        default=TeamJoinRequestStatus.PENDING,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship()
