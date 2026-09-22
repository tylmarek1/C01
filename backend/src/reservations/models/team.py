import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base
from reservations.models.court import SportType


class TeamRole(enum.StrEnum):
    OWNER = "OWNER"
    # Can add/remove non-owner members and manage join requests, but can't
    # delete the team, change its public/private setting, or promote/demote
    # another CAPTAIN — those stay owner-only.
    CAPTAIN = "CAPTAIN"
    MEMBER = "MEMBER"


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    # Optional — a team can be sport-agnostic ("Friday regulars").
    sport_type: Mapped[SportType | None] = mapped_column(
        Enum(SportType, name="sport_type"), default=None
    )
    description: Mapped[str | None] = mapped_column(String(500), default=None)
    # Relative path under /static, same convention as User.avatar_url.
    avatar_url: Mapped[str | None] = mapped_column(String(500), default=None)
    # Public teams are discoverable via GET /teams/discover and can be
    # requested to join; a private team is owner-invite-only, same as
    # profile_public gates a player profile's discoverability.
    is_public: Mapped[bool] = mapped_column(default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
