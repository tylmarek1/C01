import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from reservations.deps import (
    get_current_manager,
    get_current_user,
    get_db,
    get_optional_user,
)
from reservations.images import compress_and_store_review_image
from reservations.models import (
    Reservation,
    ReservationStatus,
    Review,
    ReviewImage,
    ReviewVote,
    User,
)
from reservations.schemas.review import ReviewCreate, ReviewOut, ReviewReplyCreate

router = APIRouter(tags=["reviews"])

# A review is a casual, single-visit comment, not a court's marketing
# gallery — a smaller cap than MAX_GALLERY_IMAGES (courts.py) is deliberate.
MAX_REVIEW_IMAGES = 4


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


def _attach_images(db: Session, reviews: list[Review]) -> list[Review]:
    """Same bulk-query-then-transient-attribute pattern as courts.py's
    `_attach_images` — one query for the whole page, not one per review."""
    if not reviews:
        return reviews
    review_ids = [r.id for r in reviews]
    stmt = (
        select(ReviewImage)
        .where(ReviewImage.review_id.in_(review_ids))
        .order_by(ReviewImage.position, ReviewImage.created_at)
    )
    by_review: dict[uuid.UUID, list[ReviewImage]] = {}
    for image in db.scalars(stmt):
        by_review.setdefault(image.review_id, []).append(image)
    for review in reviews:
        review.images = by_review.get(review.id, [])
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
    reviews = list(db.scalars(stmt))
    return _attach_images(db, _attach_helpful_votes(db, reviews, current_user))


@router.get("/reviews/mine", response_model=list[ReviewOut])
def list_my_reviews(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[Review]:
    stmt = (
        select(Review)
        .where(Review.user_id == current_user.id)
        .order_by(Review.created_at.desc())
    )
    reviews = list(db.scalars(stmt))
    return _attach_images(db, _attach_helpful_votes(db, reviews, current_user))


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

    return _attach_images(db, _attach_helpful_votes(db, [review], current_user))[0]


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
    # ReviewImage has no relationship() back to Review, so the unit-of-work
    # won't order its DELETE before this one on its own — same fix as the
    # CourtImage/Court cascade (courts.py's delete_court). Per-object ORM
    # deletes, matching that endpoint's convention.
    for image in db.scalars(
        select(ReviewImage).where(ReviewImage.review_id == review.id)
    ):
        db.delete(image)
    db.flush()
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
    return _attach_images(db, _attach_helpful_votes(db, [review], current_user))[0]


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
    return _attach_images(db, _attach_helpful_votes(db, [review], current_user))[0]


@router.post(
    "/reviews/{review_id}/images",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
)
def add_review_image(
    review_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Review:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your review")

    existing_count = db.scalar(
        select(func.count())
        .select_from(ReviewImage)
        .where(ReviewImage.review_id == review.id)
    )
    if existing_count >= MAX_REVIEW_IMAGES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"A review can have at most {MAX_REVIEW_IMAGES} photos",
        )

    raw = file.file.read()
    url = compress_and_store_review_image(file, raw)
    db.add(ReviewImage(review_id=review.id, url=url, position=existing_count))
    db.commit()
    db.refresh(review)
    return _attach_images(db, _attach_helpful_votes(db, [review], current_user))[0]


@router.delete("/reviews/{review_id}/images/{image_id}", response_model=ReviewOut)
def delete_review_image(
    review_id: uuid.UUID,
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Review:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your review")

    image = db.get(ReviewImage, image_id)
    if image is None or image.review_id != review.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    db.delete(image)
    db.commit()
    db.refresh(review)
    return _attach_images(db, _attach_helpful_votes(db, [review], current_user))[0]
