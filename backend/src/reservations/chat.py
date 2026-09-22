"""Chat conversations — DM and per-reservation group chat. This module owns
persistence and membership rules (same split as lifecycle.py/
waitlist_service.py: real logic here, not in the router); live delivery is
chat_hub.py's in-process WebSocket registry."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.models import (
    Conversation,
    ConversationKind,
    ConversationParticipant,
    Message,
    Reservation,
    ReservationGuest,
    Team,
    TeamMember,
    User,
)
from reservations.schemas.chat import ConversationOut, MessageOut


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


def get_or_create_team_conversation(db: Session, team: Team) -> Conversation:
    """Get-or-create, and fully sync participants to the team's current
    roster every call — unlike a reservation guest, team membership is a
    deliberate, ongoing relationship, so a member removed from the team
    also loses the conversation immediately rather than keeping stale
    access to it."""
    conversation = db.scalar(
        select(Conversation).where(Conversation.team_id == team.id)
    )
    if conversation is None:
        conversation = Conversation(kind=ConversationKind.TEAM, team_id=team.id)
        db.add(conversation)
        db.flush()

    current_user_ids = set(
        db.scalars(select(TeamMember.user_id).where(TeamMember.team_id == team.id))
    )
    existing_rows = list(
        db.scalars(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conversation.id
            )
        )
    )
    existing_by_user = {row.user_id: row for row in existing_rows}
    for user_id in current_user_ids - set(existing_by_user):
        db.add(
            ConversationParticipant(conversation_id=conversation.id, user_id=user_id)
        )
    for user_id, row in existing_by_user.items():
        if user_id not in current_user_ids:
            db.delete(row)
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


def get_conversation_context(
    db: Session, conversation_id: uuid.UUID, viewer_id: uuid.UUID
) -> tuple[list[User], Message | None, datetime | None, int]:
    """Participants, most recent message, the viewer's last-read time, and
    their unread count for one conversation — the shared assembly a "get me
    this one conversation" endpoint needs, whether it's chat.py's DM/
    reservation routes or teams.py's team-chat route. `list_my_conversations`
    (api/chat.py) has its own bulk-query variant of this for listing many
    conversations at once — not reused here, different access pattern."""
    participants = list(
        db.scalars(
            select(User)
            .join(ConversationParticipant, ConversationParticipant.user_id == User.id)
            .where(ConversationParticipant.conversation_id == conversation_id)
        )
    )
    last_message = db.scalar(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    my_row = db.scalar(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == viewer_id)
    )
    last_read_at = my_row.last_read_at if my_row else None

    unread_stmt = (
        select(Message.id)
        .where(Message.conversation_id == conversation_id)
        .where(Message.sender_id != viewer_id)
    )
    if last_read_at is not None:
        unread_stmt = unread_stmt.where(Message.created_at > last_read_at)
    unread_count = len(list(db.scalars(unread_stmt)))

    return participants, last_message, last_read_at, unread_count


def to_conversation_out(
    conversation: Conversation,
    participants: list[User],
    last_message: Message | None,
    unread_count: int,
) -> ConversationOut:
    """The one canonical way to build a ConversationOut — shared by every
    router that returns one (chat.py's DM/reservation/list endpoints,
    teams.py's team-chat endpoint) so the shape can't drift between them."""
    return ConversationOut(
        id=conversation.id,
        kind=conversation.kind,
        participants=participants,
        last_message=MessageOut.model_validate(last_message) if last_message else None,
        unread_count=unread_count,
        created_at=conversation.created_at,
    )
