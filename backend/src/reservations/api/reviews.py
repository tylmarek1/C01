import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from reservations.deps import (
    get_current_manager,
    get_current_user,
    get_db,
    get_optional_user,
)
from reservations.models import Reservation, ReservationStatus, Review, ReviewVote, User
from reservations.schemas.review import ReviewCreate, ReviewOut, ReviewReplyCreate

router = APIRouter(tags=["reviews"])


def _attach_helpful_votes(
    db: Session, reviews: list[Review], current_user: User | None
) -> list[Review]:
    if not reviews:
        return reviews
    review_ids = [r.id for r in reviews]
    counts = dict(
        db.execute(
            select(ReviewVote.review_id, func.count())
            .where(ReviewVote.review_id.in_(review_ids))
            .group_by(ReviewVote.review_id)
        ).all()
    )
    voted_by_me: set[uuid.UUID] = set()
    if current_user is not None:
        voted_by_me = set(
            db.scalars(
                select(ReviewVote.review_id)
                .where(ReviewVote.review_id.in_(review_ids))
                .where(ReviewVote.user_id == current_user.id)
            )
        )
    for review in reviews:
        review.helpful_count = counts.get(review.id, 0)
        review.voted_helpful_by_me = review.id in voted_by_me
    return reviews


@router.post("/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Review:
    reservation = db.get(Reservation, payload.reservation_id)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    if reservation.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your reservation")
    if reservation.status != ReservationStatus.COMPLETED:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You can only review a completed reservation"
        )

    review = Review(
        court_id=reservation.court_id,
        user_id=current_user.id,
        reservation_id=reservation.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You already reviewed this reservation"
        ) from exc
    db.refresh(review)
    return review


@router.get("/courts/{court_id}/reviews", response_model=list[ReviewOut])
def list_court_reviews(
    court_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> list[Review]:
    stmt = (
        select(Review)
        .where(Review.court_id == court_id)
        .order_by(Review.created_at.desc())
    )
    return _attach_helpful_votes(db, list(db.scalars(stmt)), current_user)


@router.get("/reviews/mine", response_model=list[ReviewOut])
def list_my_reviews(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[Review]:
    stmt = (
        select(Review)
        .where(Review.user_id == current_user.id)
        .order_by(Review.created_at.desc())
    )
    return _attach_helpful_votes(db, list(db.scalars(stmt)), current_user)


@router.post("/reviews/{review_id}/helpful", response_model=ReviewOut)
def toggle_review_helpful(
    review_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Review:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")

    existing_vote = db.scalar(
        select(ReviewVote)
        .where(ReviewVote.review_id == review_id)
        .where(ReviewVote.user_id == current_user.id)
    )
    if existing_vote is None:
        db.add(ReviewVote(review_id=review_id, user_id=current_user.id))
    else:
        db.delete(existing_vote)
    db.commit()

    return _attach_helpful_votes(db, [review], current_user)[0]


@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your review")
    db.delete(review)
    db.commit()


@router.put("/reviews/{review_id}/reply", response_model=ReviewOut)
def reply_to_review(
    review_id: uuid.UUID,
    payload: ReviewReplyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
) -> Review:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    review.manager_reply = payload.reply
    review.manager_reply_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(review)
    return _attach_helpful_votes(db, [review], current_user)[0]


@router.delete("/reviews/{review_id}/reply", response_model=ReviewOut)
def delete_review_reply(
    review_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
) -> Review:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    review.manager_reply = None
    review.manager_reply_at = None
    db.commit()
    db.refresh(review)
    return _attach_helpful_votes(db, [review], current_user)[0]
