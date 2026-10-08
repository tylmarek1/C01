"""Audit log writer (ADR-007).

An `after_flush` listener on every session from `db.make_session_factory`
turns each flushed create/update/delete of an audited model into an
`audit_log` row, inserted on the same connection — so it commits or rolls
back together with the change itself. No route has to remember to call it.

Only the fields listed in AUDITED_FIELDS are recorded. It's an allowlist on
purpose: a new column (or a secret like `password_hash`/`calendar_token`)
never ends up in the log unless someone adds it here."""

import enum
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy import event, insert, inspect
from sqlalchemy.orm import Session, sessionmaker

from reservations.models import (
    AuditAction,
    AuditLog,
    Court,
    CourtPriceRule,
    FacilityBlock,
    Payment,
    Reservation,
    User,
    Venue,
    VenueManager,
    VenueOpeningHours,
)
from reservations.observability import current_context

AUDITED_FIELDS: dict[type, tuple[str, ...]] = {
    Venue: ("name", "address", "description", "active"),
    VenueManager: ("venue_id", "user_id"),
    Payment: (
        "reservation_id",
        "user_id",
        "amount",
        "method",
        "status",
        "provider_ref",
        "failure_reason",
    ),
    VenueOpeningHours: ("venue_id", "weekday", "opens_minute", "closes_minute"),
    CourtPriceRule: (
        "court_id",
        "weekday",
        "start_minute",
        "end_minute",
        "price_per_hour",
    ),
    Court: (
        "name",
        "venue_id",
        "sport_type",
        "indoor",
        "active",
        "requires_approval",
        "description",
        "image_url",
        "amenities",
        "price_per_hour",
    ),
    User: ("name", "email", "role", "profile_public"),
    Reservation: (
        "court_id",
        "user_id",
        "start_time",
        "end_time",
        "status",
        "price_total",
    ),
    FacilityBlock: ("court_id", "start_time", "end_time", "reason", "series_id"),
}


def _jsonable(value: Any) -> Any:
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Decimal):
        # A price is a Decimal when loaded but a float when set from the API —
        # one JSON number either way, so old and new compare cleanly.
        return float(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


def _row(
    obj: Any, action: AuditAction, changes: dict[str, list[Any]]
) -> dict[str, Any]:
    context = current_context()
    return {
        "id": uuid.uuid4(),
        "actor_id": uuid.UUID(context.user_id) if context and context.user_id else None,
        "request_id": context.request_id if context else None,
        "action": action,
        "entity_type": obj.__tablename__,
        "entity_id": obj.id,
        "changes": changes,
    }


def _updated_fields(obj: Any, fields: tuple[str, ...]) -> dict[str, list[Any]]:
    state = inspect(obj)
    changes: dict[str, list[Any]] = {}
    for field in fields:
        history = state.attrs[field].history
        if not history.has_changes():
            continue
        old = history.deleted[0] if history.deleted else None
        new = history.added[0] if history.added else None
        if old != new:
            changes[field] = [_jsonable(old), _jsonable(new)]
    return changes


def _record_changes(session: Session, _flush_context: Any) -> None:
    rows: list[dict[str, Any]] = []
    for obj in session.new:
        fields = AUDITED_FIELDS.get(type(obj))
        if fields:
            values = {
                f: [None, _jsonable(getattr(obj, f))]
                for f in fields
                if getattr(obj, f) is not None
            }
            rows.append(_row(obj, AuditAction.CREATE, values))
    for obj in session.dirty:
        fields = AUDITED_FIELDS.get(type(obj))
        if fields:
            changes = _updated_fields(obj, fields)
            if changes:
                rows.append(_row(obj, AuditAction.UPDATE, changes))
    for obj in session.deleted:
        fields = AUDITED_FIELDS.get(type(obj))
        if fields:
            values = {
                f: [_jsonable(getattr(obj, f)), None]
                for f in fields
                if getattr(obj, f) is not None
            }
            rows.append(_row(obj, AuditAction.DELETE, values))
    if rows:
        session.connection().execute(insert(AuditLog), rows)


def install(factory: sessionmaker) -> None:
    if not event.contains(factory, "after_flush", _record_changes):
        event.listen(factory, "after_flush", _record_changes)
