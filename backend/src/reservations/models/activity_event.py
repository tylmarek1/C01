import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class ActivityEvent(Base):
    """One row per feed-worthy thing a user did — followed someone, joined
    a team, completed a match, unlocked an achievement or a challenge,
    opened a game up to join. `type` is a plain string, deliberately not a
    Postgres enum, so a new event type is a pure code change, never
    another manual drop/recreate/reseed migration cycle. `payload` holds
    whatever that type needs to render (ids + display names) — an
    append-only table populated at the point of action (see
    activity.emit_activity), not a live union query across five
    differently-shaped tables at read time."""

    __tablename__ = "activity_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
