import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class UserRole(enum.StrEnum):
    PLAYER = "PLAYER"
    VENUE_MANAGER = "VENUE_MANAGER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), default=UserRole.PLAYER)
    # Relative path under /static, e.g. "/static/avatars/<uuid>.jpg" — the
    # frontend prefixes it with the API origin. Null until the user uploads one.
    avatar_url: Mapped[str | None] = mapped_column(String(500), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
