"""Price of a slot from the court's rates (ADR-009).

A slot is priced in half-hour steps (every slot starts on :00/:30 and lasts
a whole number of half hours, BR-04). Each step costs half the hourly rate
that applies at its venue-local start: the court's matching price rule for
that weekday, else its base `price_per_hour`. If any step has no rate at
all, the slot has no price (None) rather than a misleadingly low one."""

from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.models import Court, CourtPriceRule
from reservations.schemas.reservation import VENUE_TZ

STEP = timedelta(minutes=30)
CENT = Decimal("0.01")


def quote(
    db: Session, court: Court, start_time: datetime, end_time: datetime
) -> Decimal | None:
    rules = list(
        db.scalars(select(CourtPriceRule).where(CourtPriceRule.court_id == court.id))
    )
    base = Decimal(court.price_per_hour) if court.price_per_hour is not None else None

    total = Decimal(0)
    step_start = start_time
    while step_start < end_time:
        local = step_start.astimezone(VENUE_TZ)
        minute = local.hour * 60 + local.minute
        rate = next(
            (
                rule.price_per_hour
                for rule in rules
                if rule.weekday == local.weekday()
                and rule.start_minute <= minute < rule.end_minute
            ),
            base,
        )
        if rate is None:
            return None
        total += Decimal(rate) / 2
        step_start += STEP
    return total.quantize(CENT)
