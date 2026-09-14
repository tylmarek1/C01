import uuid
from collections.abc import Iterator

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from reservations.db import make_engine, make_session_factory
from reservations.models import User, UserRole
from reservations.security import decode_access_token

_engine = make_engine()
_session_factory = make_session_factory(_engine)
# Public alias — the background worker needs a session factory too, and
# isn't a FastAPI dependency so it can't just take get_db().
session_factory = _session_factory

bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Iterator[Session]:
    db = _session_factory()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        user_id = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc

    user = db.get(User, uuid.UUID(user_id))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def get_current_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.VENUE_MANAGER:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Venue manager access required")
    return current_user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Like get_current_user, but for endpoints that behave differently for
    signed-in vs anonymous visitors instead of rejecting anonymous ones."""
    if credentials is None:
        return None
    try:
        user_id = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        return None
    return db.get(User, uuid.UUID(user_id))
