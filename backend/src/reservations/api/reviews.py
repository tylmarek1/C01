import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from reservations.deps import get_current_user, get_db
from reservations.models import Reservation, ReservationStatus, Review, User
from reservations.schemas.review import ReviewCreate, ReviewOut

router = APIRouter(tags=["reviews"])


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
        raise HTTPException(status.HTTP_409_CONFLICT, "You can only review a completed reservation")

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
        raise HTTPException(status.HTTP_409_CONFLICT, "You already reviewed this reservation") from exc
    db.refresh(review)
    return review


@router.get("/courts/{court_id}/reviews", response_model=list[ReviewOut])
def list_court_reviews(court_id: uuid.UUID, db: Session = Depends(get_db)) -> list[Review]:
    stmt = select(Review).where(Review.court_id == court_id).order_by(Review.created_at.desc())
    return list(db.scalars(stmt))


@router.get("/reviews/mine", response_model=list[ReviewOut])
def list_my_reviews(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Review]:
    stmt = select(Review).where(Review.user_id == current_user.id).order_by(Review.created_at.desc())
    return list(db.scalars(stmt))


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
