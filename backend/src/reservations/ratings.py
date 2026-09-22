"""Skill rating — a standard Elo update per sport, same register as
everything else here (achievements.py's stats, waitlist_service.py's
offers): good enough for a casual club, not a competitive-league engine.

Deliberately scoped to 1-on-1 reservations only. ReservationGuest has no
"side"/team field, so a group booking (more than one guest) has no
well-defined winner/loser pairing — building a team-assignment UI just to
rate group games would be exactly the overengineering this app's "no
overengineering" instruction calls out. A group reservation can still be
marked COMPLETED and reviewed; it just isn't rateable."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.models import SkillRating, SportType

K_FACTOR = 32
DEFAULT_RATING = 1000


def _expected_score(rating_a: int, rating_b: int) -> float:
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def _get_or_create_rating(
    db: Session, user_id: uuid.UUID, sport_type: SportType
) -> SkillRating:
    rating = db.scalar(
        select(SkillRating)
        .where(SkillRating.user_id == user_id)
        .where(SkillRating.sport_type == sport_type)
    )
    if rating is None:
        rating = SkillRating(
            user_id=user_id,
            sport_type=sport_type,
            rating=DEFAULT_RATING,
            matches_played=0,
        )
        db.add(rating)
        db.flush()
    return rating


def record_result(
    db: Session,
    sport_type: SportType,
    user_a: uuid.UUID,
    user_b: uuid.UUID,
    winner_user_id: uuid.UUID | None,
) -> None:
    rating_a = _get_or_create_rating(db, user_a, sport_type)
    rating_b = _get_or_create_rating(db, user_b, sport_type)

    expected_a = _expected_score(rating_a.rating, rating_b.rating)
    expected_b = 1 - expected_a

    if winner_user_id is None:
        score_a, score_b = 0.5, 0.5
    elif winner_user_id == user_a:
        score_a, score_b = 1.0, 0.0
    else:
        score_a, score_b = 0.0, 1.0

    rating_a.rating = round(rating_a.rating + K_FACTOR * (score_a - expected_a))
    rating_b.rating = round(rating_b.rating + K_FACTOR * (score_b - expected_b))
    rating_a.matches_played += 1
    rating_b.matches_played += 1
