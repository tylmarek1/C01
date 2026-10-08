import uuid
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Numeric,
    SmallInteger,
    literal_column,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class CourtPriceRule(Base):
    """An hourly rate for one court on one weekday between two venue-local
    times (ADR-009). Where no rule applies, the court's `price_per_hour` is
    the rate. Two rules of one court can't overlap — enforced by the
    database, the same way ADR-001 keeps reservations apart."""

    __tablename__ = "court_price_rules"
    __table_args__ = (
        ExcludeConstraint(
            (literal_column("court_id"), "="),
            (literal_column("weekday"), "="),
            (literal_column("int4range(start_minute, end_minute)"), "&&"),
            name="no_overlapping_price_rules",
            using="gist",
        ),
        CheckConstraint("weekday BETWEEN 0 AND 6", name="price_rule_weekday_range"),
        CheckConstraint(
            "start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute",
            name="price_rule_order",
        ),
        CheckConstraint("price_per_hour >= 0", name="price_rule_not_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    court_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courts.id"))
    # 0 = Monday … 6 = Sunday.
    weekday: Mapped[int] = mapped_column(SmallInteger)
    start_minute: Mapped[int] = mapped_column(SmallInteger)
    end_minute: Mapped[int] = mapped_column(SmallInteger)
    price_per_hour: Mapped[Decimal] = mapped_column(Numeric(8, 2))
