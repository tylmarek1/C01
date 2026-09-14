import uuid

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


@router.post("", response_model=FacilityBlockOut, status_code=status.HTTP_201_CREATED)
def create_facility_block(
    payload: FacilityBlockCreate,
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager),
) -> FacilityBlock:
    court = db.get(Court, payload.court_id)
    if court is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Court not found")

    block = FacilityBlock(
        court_id=court.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        reason=payload.reason,
        created_by_id=manager.id,
    )
    db.add(block)

    # Cancel anything that now overlaps the block — no waitlist offer here,
    # the court genuinely isn't available.
    stmt = (
        select(Reservation)
        .where(Reservation.court_id == court.id)
        .where(Reservation.status.in_(ACTIVE_RESERVATION_STATUSES))
        .where(Reservation.start_time < payload.end_time)
        .where(Reservation.end_time > payload.start_time)
    )
    for reservation in db.scalars(stmt):
        transition(
            db, reservation, ReservationStatus.CANCELLED, actor_id=manager.id, note=f"Court blocked: {payload.reason}"
        )
        notify(
            db,
            reservation.user_id,
            NotificationType.FACILITY_UNAVAILABLE,
            "Reservation cancelled — court unavailable",
            f"{court.name} is unavailable ({payload.reason}), so your reservation was cancelled.",
        )

    db.commit()
    db.refresh(block)
    return block


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
