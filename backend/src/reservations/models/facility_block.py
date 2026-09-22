import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reservations.db import Base
from reservations.models.court import Court
from reservations.models.user import User


class FacilityBlock(Base):
    """An admin-declared window where a court can't be booked (maintenance,
    a private event, ...). New reservations in the window are rejected;
    existing ones that now overlap it get cancelled with a notification."""

    __tablename__ = "facility_blocks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    court_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courts.id"))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(String(300))
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Groups every occurrence created by one "repeat weekly" request so they
    # can be listed/cancelled together. Not a FK to another table — there's
    # nothing else a series needs to own beyond the shared id — just a plain
    # grouping value shared across rows, null for a one-off block.
    series_id: Mapped[uuid.UUID | None] = mapped_column(default=None, index=True)

    court: Mapped[Court] = relationship()
    created_by: Mapped[User] = relationship()
