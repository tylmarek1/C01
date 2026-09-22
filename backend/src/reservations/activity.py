"""Activity feed — emit_activity() is called at the point of action across
several modules (social.py, teams.py, ratings.py, challenges.py,
achievements.py, reservations.py) rather than the feed being assembled as
a live union query across five differently-shaped tables at read time:
cheaper to read, and each call site already knows exactly what happened.
See models/activity_event.py for why `type` is a plain string."""

import uuid

from sqlalchemy.orm import Session

from reservations.models import ActivityEvent


def emit_activity(
    db: Session, user_id: uuid.UUID, type_: str, **payload: object
) -> None:
    db.add(ActivityEvent(user_id=user_id, type=type_, payload=payload))
