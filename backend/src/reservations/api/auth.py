import secrets

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.deps import get_current_user, get_db
from reservations.images import compress_and_store_avatar
from reservations.models import User
from reservations.rate_limit import enforce_rate_limit, reset as reset_rate_limit
from reservations.schemas.auth import (
    CalendarTokenOut,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
    UserUpdate,
)
from reservations.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Deliberately generous — this guards against automated abuse (credential
# stuffing, mass account creation), not against a legitimate user who
# mistypes a password a couple of times. See docs/capability-map.md.
_LOGIN_MAX_ATTEMPTS = 10
_LOGIN_WINDOW_SECONDS = 300
_REGISTER_MAX_ATTEMPTS = 10
_REGISTER_WINDOW_SECONDS = 3600


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
def register(
    payload: RegisterRequest, request: Request, db: Session = Depends(get_db)
) -> TokenResponse:
    enforce_rate_limit(
        f"register:{_client_ip(request)}",
        max_attempts=_REGISTER_MAX_ATTEMPTS,
        window_seconds=_REGISTER_WINDOW_SECONDS,
    )

    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest, request: Request, db: Session = Depends(get_db)
) -> TokenResponse:
    # Keyed by email, not IP: the threat this stops is guessing one
    # account's password, which is exactly as effective distributed across
    # many source IPs. A generous per-IP register limit above separately
    # covers mass account creation.
    rate_key = f"login:{payload.email.lower()}"
    enforce_rate_limit(
        rate_key, max_attempts=_LOGIN_MAX_ATTEMPTS, window_seconds=_LOGIN_WINDOW_SECONDS
    )

    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    reset_rate_limit(rate_key)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserOut:
    current_user.name = payload.name
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.post("/me/avatar", response_model=UserOut)
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserOut:
    raw = file.file.read()
    current_user.avatar_url = compress_and_store_avatar(file, raw)
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.post("/me/calendar-token", response_model=CalendarTokenOut)
def issue_calendar_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarTokenOut:
    """(Re)issues the opaque token used to authenticate the personal .ics
    calendar feed URL — regenerating invalidates any link handed out before."""
    current_user.calendar_token = secrets.token_urlsafe(32)
    db.commit()
    return CalendarTokenOut(calendar_token=current_user.calendar_token)
