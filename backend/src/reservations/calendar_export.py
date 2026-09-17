"""Hand-rolled RFC 5545 (iCalendar) export — no third-party ics library
needed for something this small. Two entry points: a single VEVENT for
downloading one reservation, and a full VCALENDAR feed for the personal
subscription URL."""

from datetime import datetime, timezone

from reservations.models import Reservation

_STATUS_MAP = {
    "PENDING": "TENTATIVE",
    "CONFIRMED": "CONFIRMED",
    "CHECKED_IN": "CONFIRMED",
    "COMPLETED": "CONFIRMED",
    "CANCELLED": "CANCELLED",
    "EXPIRED": "CANCELLED",
    "NO_SHOW": "CANCELLED",
}


def _fold(line: str) -> str:
    """RFC 5545 line folding: no physical line longer than 75 octets, with
    continuations starting with a single space."""
    if len(line.encode("utf-8")) <= 75:
        return line
    parts = []
    while len(line.encode("utf-8")) > 75:
        parts.append(line[:74])
        line = " " + line[74:]
    parts.append(line)
    return "\r\n".join(parts)


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _stamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _event_lines(reservation: Reservation) -> list[str]:
    summary = f"{reservation.court.sport_type.value.title()} — {reservation.court.name}"
    return [
        "BEGIN:VEVENT",
        _fold(f"UID:reservation-{reservation.id}@courtly.app"),
        f"DTSTAMP:{_stamp(datetime.now(timezone.utc))}",
        f"DTSTART:{_stamp(reservation.start_time)}",
        f"DTEND:{_stamp(reservation.end_time)}",
        _fold(f"SUMMARY:{_escape(summary)}"),
        _fold(f"LOCATION:{_escape(reservation.court.name)}"),
        f"STATUS:{_STATUS_MAP.get(reservation.status.value, 'CONFIRMED')}",
        "END:VEVENT",
    ]


def build_single_event_ics(reservation: Reservation) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Courtly//Reservations//EN",
        "CALSCALE:GREGORIAN",
        *_event_lines(reservation),
        "END:VCALENDAR",
    ]
    return "\r\n".join(lines) + "\r\n"


def build_calendar_feed_ics(reservations: list[Reservation]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Courtly//Reservations//EN",
        "CALSCALE:GREGORIAN",
        _fold("X-WR-CALNAME:Courtly reservations"),
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ]
    for reservation in reservations:
        lines.extend(_event_lines(reservation))
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
