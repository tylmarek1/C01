import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.deps import get_current_user, get_db
from reservations.models import Court, Favorite, User
from reservations.schemas.court import CourtOut

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("/mine", response_model=list[CourtOut])
def list_my_favorites(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Court]:
    stmt = (
        select(Court)
        .join(Favorite, Favorite.court_id == Court.id)
        .where(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
    )
    return list(db.scalars(stmt))


@router.post("/{court_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_favorite(
    court_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    court = db.get(Court, court_id)
    if court is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Court not found")

    existing = db.scalar(select(Favorite).where(Favorite.user_id == current_user.id).where(Favorite.court_id == court_id))
    if existing is None:
        db.add(Favorite(user_id=current_user.id, court_id=court_id))
        db.commit()


@router.delete("/{court_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    court_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    existing = db.scalar(select(Favorite).where(Favorite.user_id == current_user.id).where(Favorite.court_id == court_id))
    if existing is not None:
        db.delete(existing)
        db.commit()
