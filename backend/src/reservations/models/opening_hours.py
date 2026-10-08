import uuid

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class VenueOpeningHours(Base):
    """One venue's opening hours for one weekday (ADR-009), in venue-local
    wall-clock minutes since midnight — 1440 is "midnight, end of the day".
    No row for a weekday means the venue is closed that day."""

    __tablename__ = "venue_opening_hours"
    __table_args__ = (
        UniqueConstraint("venue_id", "weekday", name="opening_hours_one_per_weekday"),
        CheckConstraint("weekday BETWEEN 0 AND 6", name="opening_hours_weekday_range"),
        CheckConstraint(
            "opens_minute >= 0 AND closes_minute <= 1440 AND opens_minute < closes_minute",
            name="opening_hours_order",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    venue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("venues.id"))
    # 0 = Monday … 6 = Sunday, like Python's date.weekday().
    weekday: Mapped[int] = mapped_column(SmallInteger)
    opens_minute: Mapped[int] = mapped_column(SmallInteger)
    closes_minute: Mapped[int] = mapped_column(SmallInteger)
