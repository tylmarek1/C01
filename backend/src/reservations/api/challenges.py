import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations import challenges as challenges_service
from reservations.deps import get_current_manager, get_current_user, get_db
from reservations.models import Challenge, ChallengeCompletion, User
from reservations.schemas.challenge import (
    ChallengeCreate,
    ChallengeOut,
    ChallengeProgressOut,
)

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.get("", response_model=list[ChallengeOut])
def list_challenges(
    db: Session = Depends(get_db), _current_user: User = Depends(get_current_user)
) -> list[Challenge]:
    return list(db.scalars(select(Challenge).order_by(Challenge.starts_at.desc())))


@router.post("", response_model=ChallengeOut, status_code=201)
def create_challenge(
    payload: ChallengeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
) -> Challenge:
    challenge = Challenge(
        title=payload.title,
        description=payload.description,
        sport_type=payload.sport_type,
        metric=payload.metric,
        target=payload.target,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        created_by=current_user.id,
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge


@router.get("/mine", response_model=list[ChallengeProgressOut])
def my_challenge_progress(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[ChallengeProgressOut]:
    all_challenges = list(
        db.scalars(select(Challenge).order_by(Challenge.starts_at.desc()))
    )
    progress_by_challenge = {
        c.id: challenges_service.progress(db, current_user.id, c)
        for c in all_challenges
    }
    for challenge in all_challenges:
        challenges_service.evaluate_and_award(
            db, current_user.id, challenge, progress_by_challenge[challenge.id]
        )
    db.commit()

    completed_at_by_challenge: dict[uuid.UUID, ChallengeCompletion] = {
        row.challenge_id: row
        for row in db.scalars(
            select(ChallengeCompletion).where(
                ChallengeCompletion.user_id == current_user.id
            )
        )
    }

    results: list[ChallengeProgressOut] = []
    for challenge in all_challenges:
        completion = completed_at_by_challenge.get(challenge.id)
        results.append(
            ChallengeProgressOut(
                id=challenge.id,
                title=challenge.title,
                description=challenge.description,
                sport_type=challenge.sport_type,
                metric=challenge.metric,
                target=challenge.target,
                starts_at=challenge.starts_at,
                ends_at=challenge.ends_at,
                created_by=challenge.created_by,
                progress=progress_by_challenge[challenge.id],
                completed=completion is not None,
                completed_at=completion.completed_at if completion else None,
            )
        )
    return results
