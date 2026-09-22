import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.deps import get_current_manager, get_db
from reservations.lifecycle import transition
from reservations.models import (
    ACTIVE_RESERVATION_STATUSES,
    Court,
    FacilityBlock,
    NotificationType,
    Reservation,
    ReservationStatus,
    User,
)
from reservations.notifications import notify
from reservations.schemas.facility_block import FacilityBlockCreate, FacilityBlockOut

router = APIRouter(prefix="/facility-blocks", tags=["facility-blocks"])


@router.get("", response_model=list[FacilityBlockOut])
def list_facility_blocks(
    court_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[FacilityBlock]:
    stmt = select(FacilityBlock).order_by(FacilityBlock.start_time)
    if court_id is not None:
        stmt = stmt.where(FacilityBlock.court_id == court_id)
    return list(db.scalars(stmt))


def _create_one_block(
    db: Session,
    court: Court,
    start_time: datetime,
    end_time: datetime,
    reason: str,
    manager: User,
    series_id: uuid.UUID | None,
) -> FacilityBlock:
    block = FacilityBlock(
        court_id=court.id,
        start_time=start_time,
        end_time=end_time,
        reason=reason,
        created_by_id=manager.id,
        series_id=series_id,
    )
    db.add(block)

    # Cancel anything that now overlaps the block — no waitlist offer here,
    # the court genuinely isn't available.
    stmt = (
        select(Reservation)
        .where(Reservation.court_id == court.id)
        .where(Reservation.status.in_(ACTIVE_RESERVATION_STATUSES))
        .where(Reservation.start_time < end_time)
        .where(Reservation.end_time > start_time)
        .with_for_update()
    )
    for reservation in db.scalars(stmt):
        transition(
            db,
            reservation,
            ReservationStatus.CANCELLED,
            actor_id=manager.id,
            note=f"Court blocked: {reason}",
        )
        notify(
            db,
            reservation.user_id,
            NotificationType.FACILITY_UNAVAILABLE,
            "Reservation cancelled — court unavailable",
            f"{court.name} is unavailable ({reason}), so your reservation was cancelled.",
        )

    return block


@router.post("", response_model=FacilityBlockOut, status_code=status.HTTP_201_CREATED)
def create_facility_block(
    payload: FacilityBlockCreate,
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager),
) -> FacilityBlock:
    court = db.get(Court, payload.court_id)
    if court is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Court not found")

    # A recurring request always gets its own series_id, even though this
    # endpoint still only returns the first occurrence — the admin UI
    # refetches the full list, so every occurrence (including this one)
    # shows up there.
    series_id = uuid.uuid4() if payload.weeks else None
    duration = payload.end_time - payload.start_time

    first_block: FacilityBlock | None = None
    for week in range(payload.weeks or 1):
        start_time = payload.start_time + timedelta(weeks=week)
        end_time = start_time + duration
        block = _create_one_block(
            db, court, start_time, end_time, payload.reason, manager, series_id
        )
        if first_block is None:
            first_block = block

    db.commit()
    db.refresh(first_block)
    return first_block


@router.delete("/series/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_facility_block_series(
    series_id: uuid.UUID,
    db: Session = Depends(get_db),
    _manager: User = Depends(get_current_manager),
) -> None:
    blocks = list(
        db.scalars(select(FacilityBlock).where(FacilityBlock.series_id == series_id))
    )
    if not blocks:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Facility block series not found"
        )
    for block in blocks:
        db.delete(block)
    db.commit()


@router.delete("/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_facility_block(
    block_id: uuid.UUID,
    db: Session = Depends(get_db),
    _manager: User = Depends(get_current_manager),
) -> None:
    block = db.get(FacilityBlock, block_id)
    if block is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Facility block not found")
    db.delete(block)
    db.commit()
