import secrets

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.deps import get_current_user, get_db
from reservations.images import compress_and_store_avatar
from reservations.models import User
from reservations.schemas.auth import CalendarTokenOut, LoginRequest, RegisterRequest, TokenResponse, UserOut, UserUpdate
from reservations.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = User(name=payload.name, email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

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
