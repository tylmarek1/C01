"""Chat conversations — DM and per-reservation group chat. This module owns
persistence and membership rules (same split as lifecycle.py/
waitlist_service.py: real logic here, not in the router); live delivery is
chat_hub.py's in-process WebSocket registry."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.models import (
    Conversation,
    ConversationKind,
    ConversationParticipant,
    Reservation,
    ReservationGuest,
)


def _dm_key(user_a: uuid.UUID, user_b: uuid.UUID) -> str:
    a, b = sorted((str(user_a), str(user_b)))
    return f"{a}:{b}"


def get_or_create_dm_conversation(
    db: Session, user_a: uuid.UUID, user_b: uuid.UUID
) -> Conversation:
    key = _dm_key(user_a, user_b)
    existing = db.scalar(select(Conversation).where(Conversation.dm_key == key))
    if existing is not None:
        return existing

    conversation = Conversation(kind=ConversationKind.DM, dm_key=key)
    db.add(conversation)
    db.flush()
    db.add(ConversationParticipant(conversation_id=conversation.id, user_id=user_a))
    db.add(ConversationParticipant(conversation_id=conversation.id, user_id=user_b))
    db.flush()
    return conversation


def get_or_create_reservation_conversation(
    db: Session, reservation: Reservation
) -> Conversation:
    """Get-or-create, and re-sync participants to the reservation's current
    booker + accepted guests every call — cheaper and less bug-prone than
    keeping a separate membership-change hook in every place a guest is
    added/removed. A guest who's later removed keeps their read history
    (harmless) rather than being pruned."""
    conversation = db.scalar(
        select(Conversation).where(Conversation.reservation_id == reservation.id)
    )
    if conversation is None:
        conversation = Conversation(
            kind=ConversationKind.RESERVATION, reservation_id=reservation.id
        )
        db.add(conversation)
        db.flush()

    current_user_ids = {reservation.user_id} | set(
        db.scalars(
            select(ReservationGuest.user_id).where(
                ReservationGuest.reservation_id == reservation.id
            )
        )
    )
    existing_participant_ids = set(
        db.scalars(
            select(ConversationParticipant.user_id).where(
                ConversationParticipant.conversation_id == conversation.id
            )
        )
    )
    for user_id in current_user_ids - existing_participant_ids:
        db.add(
            ConversationParticipant(conversation_id=conversation.id, user_id=user_id)
        )
    db.flush()
    return conversation


def is_participant(db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    return (
        db.scalar(
            select(ConversationParticipant)
            .where(ConversationParticipant.conversation_id == conversation_id)
            .where(ConversationParticipant.user_id == user_id)
        )
        is not None
    )


def participant_ids(db: Session, conversation_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        db.scalars(
            select(ConversationParticipant.user_id).where(
                ConversationParticipant.conversation_id == conversation_id
            )
        )
    )
