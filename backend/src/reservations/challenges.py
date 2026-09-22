"""Seasonal challenges — the same shape as achievements.py (compute the
metric fresh each call, store only the earned/completed marker) but scoped
to a time window and, optionally, one sport. Unlike the achievement
catalog, a Challenge is admin/manager-authored via the API rather than
hardcoded in code, so a manager can run a new seasonal push without a
redeploy."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from reservations.models import (
    Challenge,
    ChallengeCompletion,
    ChallengeMetric,
    Court,
    NotificationType,
    Reservation,
    ReservationGuest,
    ReservationStatus,
    Review,
)
from reservations.activity import emit_activity
from reservations.notifications import notify


def _metric_value(db: Session, user_id: uuid.UUID, challenge: Challenge) -> int:
    window = (
        Reservation.start_time >= challenge.starts_at,
        Reservation.start_time <= challenge.ends_at,
    )

    if challenge.metric == ChallengeMetric.RESERVATIONS_COMPLETED:
        stmt = (
            select(func.count())
            .select_from(Reservation)
            .where(Reservation.user_id == user_id)
            .where(Reservation.status == ReservationStatus.COMPLETED)
            .where(*window)
        )
        if challenge.sport_type is not None:
            stmt = stmt.join(Court, Court.id == Reservation.court_id).where(
                Court.sport_type == challenge.sport_type
            )
        return db.scalar(stmt) or 0

    if challenge.metric == ChallengeMetric.COURTS_PLAYED:
        stmt = (
            select(Reservation.court_id)
            .where(Reservation.user_id == user_id)
            .where(Reservation.status == ReservationStatus.COMPLETED)
            .where(*window)
            .distinct()
        )
        if challenge.sport_type is not None:
            stmt = stmt.join(Court, Court.id == Reservation.court_id).where(
                Court.sport_type == challenge.sport_type
            )
        return len(list(db.scalars(stmt)))

    if challenge.metric == ChallengeMetric.GUESTS_INVITED:
        stmt = (
            select(func.count())
            .select_from(ReservationGuest)
            .join(Reservation, Reservation.id == ReservationGuest.reservation_id)
            .where(ReservationGuest.invited_by_id == user_id)
            .where(Reservation.start_time >= challenge.starts_at)
            .where(Reservation.start_time <= challenge.ends_at)
        )
        if challenge.sport_type is not None:
            stmt = stmt.join(Court, Court.id == Reservation.court_id).where(
                Court.sport_type == challenge.sport_type
            )
        return db.scalar(stmt) or 0

    if challenge.metric == ChallengeMetric.REVIEWS_WRITTEN:
        stmt = (
            select(func.count())
            .select_from(Review)
            .where(Review.user_id == user_id)
            .where(Review.created_at >= challenge.starts_at)
            .where(Review.created_at <= challenge.ends_at)
        )
        if challenge.sport_type is not None:
            stmt = stmt.join(Court, Court.id == Review.court_id).where(
                Court.sport_type == challenge.sport_type
            )
        return db.scalar(stmt) or 0

    raise AssertionError(f"Unhandled challenge metric: {challenge.metric}")


def progress(db: Session, user_id: uuid.UUID, challenge: Challenge) -> int:
    return _metric_value(db, user_id, challenge)


def evaluate_and_award(
    db: Session, user_id: uuid.UUID, challenge: Challenge, current_progress: int
) -> bool:
    """Inserts a ChallengeCompletion if `current_progress` newly reaches the
    target — takes the already-computed progress rather than recomputing
    it, since the caller needs that value for its own response anyway.
    Doesn't commit — callers already do that. Returns whether this call
    just completed it (for a fresh notification)."""
    already = db.scalar(
        select(ChallengeCompletion)
        .where(ChallengeCompletion.challenge_id == challenge.id)
        .where(ChallengeCompletion.user_id == user_id)
    )
    if already is not None:
        return False

    if current_progress < challenge.target:
        return False

    db.add(ChallengeCompletion(challenge_id=challenge.id, user_id=user_id))
    notify(
        db,
        user_id,
        NotificationType.CHALLENGE_COMPLETED,
        f"Challenge completed: {challenge.title}",
        challenge.description,
    )
    emit_activity(
        db,
        user_id,
        "CHALLENGE_COMPLETED",
        challenge_id=str(challenge.id),
        challenge_title=challenge.title,
    )
    return True
