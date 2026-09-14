"""Booking rules — the limits every reservation is checked against, gathered
in one place so the numbers can be reasoned about (and tuned) together."""

from datetime import timedelta

from reservations.models import UserRole

# How many PENDING/CONFIRMED/CHECKED_IN reservations a user may hold at once.
MAX_ACTIVE_RESERVATIONS = {
    UserRole.PLAYER: 3,
    UserRole.VENUE_MANAGER: 1000,
}

# A reservation can't start further out than this...
MAX_ADVANCE_DAYS = 14
# ...nor closer than this (no booking a slot that's already started, or about to).
MIN_LEAD_MINUTES = 15

# A fresh PENDING reservation must be confirmed within this window or it expires.
HOLD_MINUTES = 5
HOLD_DURATION = timedelta(minutes=HOLD_MINUTES)

# How long before start_time a reminder notification fires (once).
REMINDER_LEAD = timedelta(hours=2)

# How long a waitlist offer stays open before it's expired and passed to the next entry.
WAITLIST_OFFER_MINUTES = 15
WAITLIST_OFFER_DURATION = timedelta(minutes=WAITLIST_OFFER_MINUTES)

# A player with this many no-shows inside the trailing window is temporarily
# blocked from booking new slots — a light penalty, not a ban.
NO_SHOW_LIMIT = 3
NO_SHOW_WINDOW_DAYS = 30

# A reservation can invite at most this many guests.
MAX_GUESTS_PER_RESERVATION = 10


def max_active_reservations(role: UserRole) -> int:
    return MAX_ACTIVE_RESERVATIONS.get(role, MAX_ACTIVE_RESERVATIONS[UserRole.PLAYER])
