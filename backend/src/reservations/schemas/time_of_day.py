"""Venue-local wall-clock times as "HH:MM" on the API, minutes in the
database (ADR-009). Only :00 and :30 — slots start on the half hour (BR-04),
so an opening time or a rate boundary in between could never be used."""

import re
from typing import Annotated

from pydantic import AfterValidator

PATTERN = r"^(([01]\d|2[0-3]):(00|30)|24:00)$"


def to_minute(value: str) -> int:
    hours, minutes = value.split(":")
    return int(hours) * 60 + int(minutes)


def minute_label(minute: int) -> str:
    return f"{minute // 60:02d}:{minute % 60:02d}"


def _check(value: str) -> str:
    if not re.match(PATTERN, value):
        raise ValueError("time must be HH:MM on the hour or half hour, 00:00–24:00")
    return value


TimeOfDay = Annotated[str, AfterValidator(_check)]
