import asyncio
import uuid
from datetime import datetime, timezone

import jwt
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from reservations import chat, chat_hub
from reservations.deps import get_current_user, get_db
from reservations.images import compress_and_store_chat_attachment
from reservations.models import (
    ALLOWED_REACTION_EMOJI,
    Conversation,
    ConversationParticipant,
    Message,
    MessageReaction,
    Reservation,
    ReservationGuest,
    User,
)
from reservations.schemas.chat import (
    ConversationOut,
    MessageCreate,
    MessageOut,
    MessageReactionSummary,
    ReactionToggle,
)
from reservations.security import decode_access_token

router = APIRouter(tags=["chat"])


def _last_messages(
    db: Session, conversation_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Message]:
    if not conversation_ids:
        return {}
    by_conversation: dict[uuid.UUID, Message] = {}
    stmt = (
        select(Message)
        .where(Message.conversation_id.in_(conversation_ids))
        .order_by(Message.conversation_id, Message.created_at.desc())
    )
    for message in db.scalars(stmt):
        by_conversation.setdefault(message.conversation_id, message)
    return by_conversation


def _participants(
    db: Session, conversation_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[User]]:
    if not conversation_ids:
        return {}
    by_conversation: dict[uuid.UUID, list[User]] = {}
    stmt = (
        select(ConversationParticipant.conversation_id, User)
        .join(User, User.id == ConversationParticipant.user_id)
        .where(ConversationParticipant.conversation_id.in_(conversation_ids))
    )
    for conversation_id, user in db.execute(stmt).all():
        by_conversation.setdefault(conversation_id, []).append(user)
    return by_conversation


def _unread_count(
    db: Session,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    last_read_at: datetime | None,
) -> int:
    stmt = (
        select(Message.id)
        .where(Message.conversation_id == conversation_id)
        .where(Message.sender_id != user_id)
    )
    if last_read_at is not None:
        stmt = stmt.where(Message.created_at > last_read_at)
    return len(list(db.scalars(stmt)))


def _attach_reactions(
    db: Session, messages: list[Message], viewer_id: uuid.UUID
) -> list[Message]:
    """Bulk-query-then-transient-attribute pattern (same as reviews.py's
    _attach_images) — one query for the whole message list, not one per
    message. Groups raw MessageReaction rows into per-emoji summaries."""
    if not messages:
        return messages
    message_ids = [message.id for message in messages]
    rows = db.execute(
        select(
            MessageReaction.message_id, MessageReaction.emoji, MessageReaction.user_id
        ).where(MessageReaction.message_id.in_(message_ids))
    ).all()
    by_message: dict[uuid.UUID, dict[str, list[uuid.UUID]]] = {}
    for message_id, emoji, user_id in rows:
        by_message.setdefault(message_id, {}).setdefault(emoji, []).append(user_id)

    for message in messages:
        emoji_map = by_message.get(message.id, {})
        message.reactions = [
            MessageReactionSummary(
                emoji=emoji, count=len(user_ids), reacted_by_me=viewer_id in user_ids
            )
            for emoji, user_ids in sorted(
                emoji_map.items(),
                key=lambda item: ALLOWED_REACTION_EMOJI.index(item[0]),
            )
        ]
    return messages


@router.get("/conversations", response_model=list[ConversationOut])
def list_my_conversations(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[ConversationOut]:
    my_rows = db.execute(
        select(
            ConversationParticipant.conversation_id,
            ConversationParticipant.last_read_at,
        ).where(ConversationParticipant.user_id == current_user.id)
    ).all()
    if not my_rows:
        return []
    last_read_by_conversation = dict(my_rows)
    conversation_ids = list(last_read_by_conversation)

    conversations = list(
        db.scalars(
            select(Conversation)
            .where(Conversation.id.in_(conversation_ids))
            .order_by(Conversation.created_at.desc())
        )
    )
    last_messages = _last_messages(db, conversation_ids)
    participants_by_conversation = _participants(db, conversation_ids)

    results: list[ConversationOut] = []
    for conversation in conversations:
        last_read_at = last_read_by_conversation.get(conversation.id)
        unread_count = _unread_count(db, conversation.id, current_user.id, last_read_at)
        results.append(
            chat.to_conversation_out(
                conversation,
                participants_by_conversation.get(conversation.id, []),
                last_messages.get(conversation.id),
                unread_count,
            )
        )
    results.sort(
        key=lambda c: c.last_message.created_at if c.last_message else c.created_at,
        reverse=True,
    )
    return results


@router.post("/chat/dm/{user_id}", response_model=ConversationOut)
def open_dm(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationOut:
    if user_id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot message yourself")
    other = db.get(User, user_id)
    if other is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Player not found")

    conversation = chat.get_or_create_dm_conversation(db, current_user.id, user_id)
    db.commit()
    participants, last_message, _last_read_at, unread_count = (
        chat.get_conversation_context(db, conversation.id, current_user.id)
    )
    return chat.to_conversation_out(
        conversation, participants, last_message, unread_count
    )


@router.get("/reservations/{reservation_id}/chat", response_model=ConversationOut)
def open_reservation_chat(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationOut:
    reservation = db.get(Reservation, reservation_id)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")

    is_booker = reservation.user_id == current_user.id
    is_guest = (
        db.scalar(
            select(ReservationGuest)
            .where(ReservationGuest.reservation_id == reservation_id)
            .where(ReservationGuest.user_id == current_user.id)
        )
        is not None
    )
    if not (is_booker or is_guest):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not part of this reservation")

    conversation = chat.get_or_create_reservation_conversation(db, reservation)
    db.commit()

    participants, last_message, _last_read_at, unread_count = (
        chat.get_conversation_context(db, conversation.id, current_user.id)
    )
    return chat.to_conversation_out(
        conversation, participants, last_message, unread_count
    )


@router.get(
    "/conversations/{conversation_id}/messages", response_model=list[MessageOut]
)
def list_messages(
    conversation_id: uuid.UUID,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Message]:
    if not chat.is_participant(db, conversation_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Not a participant in this conversation"
        )

    messages = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(min(limit, 200))
        )
    )
    messages.reverse()
    _attach_reactions(db, messages, current_user.id)

    # Opening a conversation's history marks it read — the same "viewing it
    # is acknowledging it" semantics as a real chat app, one less endpoint
    # than a dedicated POST .../read.
    my_row = db.scalar(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    if my_row is not None:
        my_row.last_read_at = datetime.now(timezone.utc)
        db.commit()

    return messages


# Only the endpoints below that touch chat_hub's live socket registry are
# async (send_message, send_message_image, delete_message, react_to_message,
# and the WebSocket route) — the same accepted blocking-DB-call-on-the-
# event-loop tradeoff worker.py's tick() already makes; not warranted at
# this app's scale to bridge threads for it.
@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    if not chat.is_participant(db, conversation_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Not a participant in this conversation"
        )

    message = Message(
        conversation_id=conversation_id, sender_id=current_user.id, body=payload.body
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    message.reactions = []

    await _broadcast_new_message(db, conversation_id, current_user.id, message)
    return message


@router.post(
    "/conversations/{conversation_id}/messages/image",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message_image(
    conversation_id: uuid.UUID,
    file: UploadFile = File(...),
    body: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    if not chat.is_participant(db, conversation_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Not a participant in this conversation"
        )

    raw = file.file.read()
    image_url = compress_and_store_chat_attachment(file, raw)

    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        body=body.strip()[:1000],
        image_url=image_url,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    message.reactions = []

    await _broadcast_new_message(db, conversation_id, current_user.id, message)
    return message


async def _broadcast_new_message(
    db: Session, conversation_id: uuid.UUID, sender_id: uuid.UUID, message: Message
) -> None:
    recipients = [
        uid for uid in chat.participant_ids(db, conversation_id) if uid != sender_id
    ]
    await chat_hub.broadcast(
        recipients,
        {
            "type": "message",
            "conversation_id": str(conversation_id),
            "message": MessageOut.model_validate(message).model_dump(mode="json"),
        },
    )


@router.delete(
    "/conversations/{conversation_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    message = db.get(Message, message_id)
    if message is None or message.conversation_id != conversation_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    if message.sender_id != current_user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You can only delete your own messages"
        )

    # Soft delete: a tombstone reads better mid-conversation than the row
    # just disappearing. Clear the content so a deleted message doesn't
    # keep serving its text/image after the fact.
    message.body = ""
    message.image_url = None
    message.deleted_at = datetime.now(timezone.utc)
    db.commit()

    recipients = [
        uid
        for uid in chat.participant_ids(db, conversation_id)
        if uid != current_user.id
    ]
    await chat_hub.broadcast(
        recipients,
        {
            "type": "message_deleted",
            "conversation_id": str(conversation_id),
            "message_id": str(message_id),
        },
    )


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/reactions",
    response_model=MessageOut,
)
async def react_to_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: ReactionToggle,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    if not chat.is_participant(db, conversation_id, current_user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Not a participant in this conversation"
        )
    message = db.get(Message, message_id)
    if message is None or message.conversation_id != conversation_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    if message.deleted_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This message was deleted")

    emoji = payload.emoji
    if emoji not in ALLOWED_REACTION_EMOJI:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported reaction")

    existing = db.scalar(
        select(MessageReaction)
        .where(MessageReaction.message_id == message_id)
        .where(MessageReaction.user_id == current_user.id)
        .where(MessageReaction.emoji == emoji)
    )
    if existing is not None:
        db.delete(existing)
        action = "removed"
    else:
        db.add(
            MessageReaction(message_id=message_id, user_id=current_user.id, emoji=emoji)
        )
        action = "added"
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Try again") from exc

    recipients = [
        uid
        for uid in chat.participant_ids(db, conversation_id)
        if uid != current_user.id
    ]
    await chat_hub.broadcast(
        recipients,
        {
            "type": "reaction",
            "conversation_id": str(conversation_id),
            "message_id": str(message_id),
            "emoji": emoji,
            "user_id": str(current_user.id),
            "action": action,
        },
    )

    _attach_reactions(db, [message], current_user.id)
    return message


@router.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket, db: Session = Depends(get_db)) -> None:
    await websocket.accept()
    try:
        auth_frame = await asyncio.wait_for(websocket.receive_json(), timeout=5)
        token = auth_frame.get("token") if isinstance(auth_frame, dict) else None
        if not token:
            raise ValueError("missing token")
        user_id = uuid.UUID(decode_access_token(token))
    except WebSocketDisconnect:
        # The client is already gone — closing an already-closed socket
        # would itself raise, so there's nothing left to do here.
        return
    except (TimeoutError, ValueError, jwt.PyJWTError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = db.get(User, user_id)
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    chat_hub.register(user.id, websocket)
    try:
        while True:
            # The client only receives over this socket (sending goes
            # through the REST POST above, one validation path instead of
            # two) — this just blocks until disconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        chat_hub.unregister(user.id, websocket)
