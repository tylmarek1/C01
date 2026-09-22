"""In-process WebSocket connection registry for live chat delivery — same
single-process tradeoff already accepted by rate_limit.py's store and
worker.py's in-process task, not warranted at this scale (see root
CLAUDE.md's "Known gaps"). A socket that fails to send (closed without a
clean disconnect, e.g. a laptop lid closing) is pruned lazily on that
failed attempt rather than tracked with a heartbeat."""

import logging
import uuid

from fastapi import WebSocket

logger = logging.getLogger("reservations.chat")

_connections: dict[uuid.UUID, set[WebSocket]] = {}


def register(user_id: uuid.UUID, websocket: WebSocket) -> None:
    _connections.setdefault(user_id, set()).add(websocket)


def unregister(user_id: uuid.UUID, websocket: WebSocket) -> None:
    sockets = _connections.get(user_id)
    if sockets is None:
        return
    sockets.discard(websocket)
    if not sockets:
        _connections.pop(user_id, None)


async def broadcast(user_ids: list[uuid.UUID], payload: dict) -> None:
    for user_id in user_ids:
        for websocket in list(_connections.get(user_id, ())):
            try:
                await websocket.send_json(payload)
            except Exception:
                logger.warning("Dropping dead chat socket for user %s", user_id)
                unregister(user_id, websocket)
