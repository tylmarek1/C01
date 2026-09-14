"""Offering a freed-up slot to the waitlist. Matching is by exact
court+start+end — the waitlist is for a specific slot, not a fuzzy time range."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations import rules
from reservations.models import NotificationType, WaitlistEntry, WaitlistStatus
from reservations.notifications import notify


def offer_next(db: Session, court_id: uuid.UUID, start_time: datetime, end_time: datetime) -> WaitlistEntry | None:
    """Called right after a slot frees up (cancel/expire). Offers it to the
    earliest still-WAITING entry for that exact slot, if any."""
    stmt = (
        select(WaitlistEntry)
        .where(WaitlistEntry.court_id == court_id)
        .where(WaitlistEntry.start_time == start_time)
        .where(WaitlistEntry.end_time == end_time)
        .where(WaitlistEntry.status == WaitlistStatus.WAITING)
        .order_by(WaitlistEntry.created_at)
        .limit(1)
    )
    entry = db.scalar(stmt)
    if entry is None:
        return None

    entry.status = WaitlistStatus.OFFERED
    entry.offer_expires_at = datetime.now(timezone.utc) + rules.WAITLIST_OFFER_DURATION
    notify(
        db,
        entry.user_id,
        NotificationType.WAITLIST_SLOT_OFFERED,
        "A slot you're waiting for opened up",
        f"Your waitlisted slot is available — confirm within {rules.WAITLIST_OFFER_MINUTES} minutes or it goes to the next person.",
    )
    return entry
