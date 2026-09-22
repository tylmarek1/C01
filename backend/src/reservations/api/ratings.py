import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations import ratings
from reservations.deps import get_current_user, get_db
from reservations.models import (
    MatchResult,
    NotificationType,
    Reservation,
    ReservationGuest,
    ReservationStatus,
    SkillRating,
    SportType,
    User,
)
from reservations.notifications import notify
from reservations.schemas.auth import UserOut
from reservations.schemas.rating import (
    MatchResultCreate,
    MatchResultOut,
    RatingLeaderboardEntry,
    SkillRatingOut,
)

router = APIRouter(tags=["ratings"])


@router.post(
    "/reservations/{reservation_id}/result",
    response_model=MatchResultOut,
    status_code=status.HTTP_201_CREATED,
)
def report_match_result(
    reservation_id: uuid.UUID,
    payload: MatchResultCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MatchResult:
    reservation = db.get(Reservation, reservation_id)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    if reservation.status != ReservationStatus.COMPLETED:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only a completed reservation can have a result reported",
        )

    guest_ids = list(
        db.scalars(
            select(ReservationGuest.user_id).where(
                ReservationGuest.reservation_id == reservation_id
            )
        )
    )
    participant_ids = {reservation.user_id, *guest_ids}
    if current_user.id not in participant_ids:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not part of this reservation")
    if len(participant_ids) != 2:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only a 1-on-1 booking (exactly one guest) can be rated",
        )

    existing = db.scalar(
        select(MatchResult).where(MatchResult.reservation_id == reservation_id)
    )
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A result was already reported for this reservation",
        )

    if (
        payload.winner_user_id is not None
        and payload.winner_user_id not in participant_ids
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "The winner must be one of the two participants",
        )

    user_a, user_b = tuple(participant_ids)
    ratings.record_result(
        db, reservation.court.sport_type, user_a, user_b, payload.winner_user_id
    )

    result = MatchResult(
        reservation_id=reservation_id,
        reported_by=current_user.id,
        winner_user_id=payload.winner_user_id,
    )
    db.add(result)

    other_user_id = next(uid for uid in participant_ids if uid != current_user.id)
    notify(
        db,
        other_user_id,
        NotificationType.MATCH_RESULT_REPORTED,
        "Match result reported",
        f"{current_user.name} reported a result for your match on {reservation.court.name}.",
    )
    db.commit()
    db.refresh(result)
    return result


@router.get("/ratings/me", response_model=list[SkillRatingOut])
def my_ratings(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[SkillRating]:
    return list(
        db.scalars(select(SkillRating).where(SkillRating.user_id == current_user.id))
    )


@router.get("/ratings/leaderboard", response_model=list[RatingLeaderboardEntry])
def rating_leaderboard(
    sport: SportType,
    limit: int = 20,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[RatingLeaderboardEntry]:
    rows = db.execute(
        select(SkillRating, User)
        .join(User, User.id == SkillRating.user_id)
        .where(SkillRating.sport_type == sport)
        .order_by(SkillRating.rating.desc())
        .limit(limit)
    ).all()

    entries: list[RatingLeaderboardEntry] = []
    for rank, (rating, user) in enumerate(rows, start=1):
        entries.append(
            RatingLeaderboardEntry(
                user=UserOut.model_validate(user),
                sport_type=rating.sport_type,
                rating=rating.rating,
                matches_played=rating.matches_played,
                rank=rank,
            )
        )
    return entries
