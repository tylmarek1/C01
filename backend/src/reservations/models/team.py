import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base
from reservations.models.court import SportType


class TeamRole(enum.StrEnum):
    OWNER = "OWNER"
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
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
