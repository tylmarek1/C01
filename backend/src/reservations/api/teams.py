import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from reservations import chat
from reservations.activity import emit_activity
from reservations.deps import get_current_user, get_db
from reservations.images import compress_and_store_team_avatar
from reservations.models import (
    Conversation,
    ConversationParticipant,
    Message,
    NotificationType,
    SportType,
    Team,
    TeamJoinRequest,
    TeamJoinRequestStatus,
    TeamMember,
    TeamRole,
    User,
)
from reservations.notifications import notify
from reservations.schemas.auth import UserOut
from reservations.schemas.chat import ConversationOut
from reservations.schemas.team import (
    TeamCreate,
    TeamJoinRequestOut,
    TeamMemberAdd,
    TeamMemberOut,
    TeamMemberRoleUpdate,
    TeamOut,
    TeamSummaryOut,
    TeamUpdate,
)

router = APIRouter(prefix="/teams", tags=["teams"])


def _to_out(db: Session, team: Team, viewer_id: uuid.UUID) -> TeamOut:
    rows = db.execute(
        select(TeamMember, User)
        .join(User, User.id == TeamMember.user_id)
        .where(TeamMember.team_id == team.id)
        .order_by(TeamMember.joined_at)
    ).all()
    members = [
        TeamMemberOut(
            user=UserOut.model_validate(user),
            role=member.role,
            joined_at=member.joined_at,
        )
        for member, user in rows
    ]
    my_role = next(
        (member.role for member, user in rows if user.id == viewer_id), TeamRole.MEMBER
    )
    return TeamOut(
        id=team.id,
        name=team.name,
        sport_type=team.sport_type,
        description=team.description,
        avatar_url=team.avatar_url,
        is_public=team.is_public,
        created_by=team.created_by,
        created_at=team.created_at,
        members=members,
        my_role=my_role,
    )


def _get_membership(
    db: Session, team_id: uuid.UUID, user_id: uuid.UUID
) -> TeamMember | None:
    return db.scalar(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .where(TeamMember.user_id == user_id)
    )


def _require_member(db: Session, team_id: uuid.UUID, user_id: uuid.UUID) -> TeamMember:
    membership = _get_membership(db, team_id, user_id)
    if membership is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this team")
    return membership


def _can_manage(role: TeamRole) -> bool:
    """Owner or captain — can add/remove non-owner members and handle join
    requests. Deleting the team, changing public/private, and promoting/
    demoting a captain stay owner-only (checked separately, not here)."""
    return role in (TeamRole.OWNER, TeamRole.CAPTAIN)


def _require_manager(db: Session, team_id: uuid.UUID, user_id: uuid.UUID) -> TeamMember:
    membership = _require_member(db, team_id, user_id)
    if not _can_manage(membership.role):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the team owner or a captain can do this"
        )
    return membership


def _get_team_or_404(db: Session, team_id: uuid.UUID) -> Team:
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    return team


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamOut:
    existing = db.scalar(select(Team).where(Team.name == payload.name))
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A team with this name already exists"
        )

    team = Team(
        name=payload.name,
        sport_type=payload.sport_type,
        description=payload.description,
        created_by=current_user.id,
    )
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=current_user.id, role=TeamRole.OWNER))
    db.flush()
    chat.get_or_create_team_conversation(db, team)
    db.commit()
    return _to_out(db, team, current_user.id)


@router.get("/mine", response_model=list[TeamOut])
def list_my_teams(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[TeamOut]:
    team_ids = list(
        db.scalars(
            select(TeamMember.team_id).where(TeamMember.user_id == current_user.id)
        )
    )
    if not team_ids:
        return []
    teams = list(
        db.scalars(
            select(Team).where(Team.id.in_(team_ids)).order_by(Team.created_at.desc())
        )
    )
    return [_to_out(db, team, current_user.id) for team in teams]


@router.get("/discover", response_model=list[TeamSummaryOut])
def discover_teams(
    q: str = "",
    sport: SportType | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TeamSummaryOut]:
    """Public teams the caller isn't already in — the browsable counterpart
    to /teams/mine, same "public unless opted out" shape as GET /users/search
    browsing public player profiles."""
    my_team_ids = select(TeamMember.team_id).where(
        TeamMember.user_id == current_user.id
    )
    stmt = (
        select(Team).where(Team.is_public.is_(True)).where(Team.id.not_in(my_team_ids))
    )
    query = q.strip()
    if query:
        stmt = stmt.where(Team.name.ilike(f"%{query}%"))
    if sport is not None:
        stmt = stmt.where(Team.sport_type == sport)
    stmt = stmt.order_by(Team.name).offset(offset).limit(limit)
    teams = list(db.scalars(stmt))
    if not teams:
        return []

    team_ids = [team.id for team in teams]
    counts = dict(
        db.execute(
            select(TeamMember.team_id, func.count())
            .where(TeamMember.team_id.in_(team_ids))
            .group_by(TeamMember.team_id)
        ).all()
    )
    return [
        TeamSummaryOut(
            id=team.id,
            name=team.name,
            sport_type=team.sport_type,
            description=team.description,
            avatar_url=team.avatar_url,
            member_count=counts.get(team.id, 0),
        )
        for team in teams
    ]


@router.get("/join-requests/mine", response_model=list[TeamJoinRequestOut])
def list_my_join_requests(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[TeamJoinRequest]:
    """Every pending request the caller has out, across all teams — lets
    the discover grid show "Requested" instead of letting them queue up a
    second request for the same team after a page reload."""
    return list(
        db.scalars(
            select(TeamJoinRequest)
            .where(TeamJoinRequest.user_id == current_user.id)
            .where(TeamJoinRequest.status == TeamJoinRequestStatus.PENDING)
        )
    )


@router.get("/{team_id}", response_model=TeamOut)
def get_team(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamOut:
    team = _get_team_or_404(db, team_id)
    _require_member(db, team_id, current_user.id)
    return _to_out(db, team, current_user.id)


@router.patch("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: uuid.UUID,
    payload: TeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamOut:
    team = _get_team_or_404(db, team_id)
    membership = _require_manager(db, team_id, current_user.id)

    updates = payload.model_dump(exclude_unset=True)
    if "is_public" in updates and membership.role != TeamRole.OWNER:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the team owner can change visibility"
        )
    if "name" in updates and updates["name"] != team.name:
        existing = db.scalar(select(Team).where(Team.name == updates["name"]))
        if existing is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "A team with this name already exists"
            )
    for field, value in updates.items():
        setattr(team, field, value)
    db.commit()
    return _to_out(db, team, current_user.id)


@router.post("/{team_id}/avatar", response_model=TeamOut)
def upload_team_avatar(
    team_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamOut:
    team = _get_team_or_404(db, team_id)
    _require_manager(db, team_id, current_user.id)

    raw = file.file.read()
    team.avatar_url = compress_and_store_team_avatar(file, raw)
    db.commit()
    return _to_out(db, team, current_user.id)


@router.get("/{team_id}/chat", response_model=ConversationOut)
def get_team_chat(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationOut:
    team = _get_team_or_404(db, team_id)
    _require_member(db, team_id, current_user.id)

    conversation = chat.get_or_create_team_conversation(db, team)
    db.commit()
    participants, last_message, _last_read_at, unread_count = (
        chat.get_conversation_context(db, conversation.id, current_user.id)
    )
    return chat.to_conversation_out(
        conversation, participants, last_message, unread_count
    )


@router.post("/{team_id}/members", response_model=TeamOut)
def add_team_member(
    team_id: uuid.UUID,
    payload: TeamMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamOut:
    team = _get_team_or_404(db, team_id)
    _require_manager(db, team_id, current_user.id)

    if payload.user_id is not None:
        new_user = db.get(User, payload.user_id)
    else:
        new_user = db.scalar(select(User).where(User.email == payload.email))
    if new_user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No player found")

    if _get_membership(db, team_id, new_user.id) is None:
        db.add(TeamMember(team_id=team_id, user_id=new_user.id, role=TeamRole.MEMBER))
        db.flush()
        chat.get_or_create_team_conversation(db, team)
        notify(
            db,
            new_user.id,
            NotificationType.TEAM_MEMBER_ADDED,
            "Added to a team",
            f"You were added to {team.name}.",
        )
        emit_activity(
            db, new_user.id, "JOINED_TEAM", team_id=str(team.id), team_name=team.name
        )
    db.commit()
    return _to_out(db, team, current_user.id)


@router.patch("/{team_id}/members/{user_id}/role", response_model=TeamOut)
def set_member_role(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: TeamMemberRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamOut:
    team = _get_team_or_404(db, team_id)
    my_membership = _require_member(db, team_id, current_user.id)
    if my_membership.role != TeamRole.OWNER:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the team owner can change member roles"
        )
    if payload.role not in (TeamRole.CAPTAIN, TeamRole.MEMBER):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "A member can only be promoted to captain or set back to member",
        )

    target_membership = _get_membership(db, team_id, user_id)
    if target_membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not a member of this team")
    if target_membership.role == TeamRole.OWNER:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "The team owner's role can't be changed this way"
        )

    target_membership.role = payload.role
    db.commit()
    return _to_out(db, team, current_user.id)


@router.delete("/{team_id}/members/{user_id}", response_model=TeamOut)
def remove_team_member(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamOut:
    team = _get_team_or_404(db, team_id)
    my_membership = _require_member(db, team_id, current_user.id)

    target_membership = _get_membership(db, team_id, user_id)
    if target_membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not a member of this team")

    is_self = user_id == current_user.id
    if not is_self:
        # Owner can remove anyone; a captain can only remove a plain member
        # — not the owner, not another captain.
        can_remove = my_membership.role == TeamRole.OWNER or (
            my_membership.role == TeamRole.CAPTAIN
            and target_membership.role == TeamRole.MEMBER
        )
        if not can_remove:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "You can't remove this member"
            )

    if target_membership.role == TeamRole.OWNER:
        remaining_owners = len(
            list(
                db.scalars(
                    select(TeamMember.id)
                    .where(TeamMember.team_id == team_id)
                    .where(TeamMember.role == TeamRole.OWNER)
                )
            )
        )
        if remaining_owners <= 1:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "A team must keep at least one owner — delete the team instead",
            )

    db.delete(target_membership)
    db.flush()
    chat.get_or_create_team_conversation(db, team)
    db.commit()
    return _to_out(db, team, current_user.id)


@router.post(
    "/{team_id}/join-requests",
    response_model=TeamJoinRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def request_to_join(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamJoinRequest:
    team = _get_team_or_404(db, team_id)
    if not team.is_public:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This team isn't public")
    if _get_membership(db, team_id, current_user.id) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already a member of this team")

    join_request = TeamJoinRequest(team_id=team_id, user_id=current_user.id)
    db.add(join_request)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You already requested to join this team"
        ) from exc

    managers = list(
        db.scalars(
            select(TeamMember.user_id)
            .where(TeamMember.team_id == team_id)
            .where(TeamMember.role.in_((TeamRole.OWNER, TeamRole.CAPTAIN)))
        )
    )
    for manager_id in managers:
        notify(
            db,
            manager_id,
            NotificationType.TEAM_JOIN_REQUEST_RECEIVED,
            "New join request",
            f"{current_user.name} wants to join {team.name}.",
        )
    db.commit()
    db.refresh(join_request)
    return join_request


@router.get("/{team_id}/join-requests", response_model=list[TeamJoinRequestOut])
def list_join_requests(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TeamJoinRequest]:
    _get_team_or_404(db, team_id)
    _require_manager(db, team_id, current_user.id)

    return list(
        db.scalars(
            select(TeamJoinRequest)
            .where(TeamJoinRequest.team_id == team_id)
            .where(TeamJoinRequest.status == TeamJoinRequestStatus.PENDING)
            .order_by(TeamJoinRequest.created_at)
        )
    )


def _get_pending_join_request(
    db: Session, team_id: uuid.UUID, request_id: uuid.UUID
) -> TeamJoinRequest:
    join_request = db.get(TeamJoinRequest, request_id)
    if join_request is None or join_request.team_id != team_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Join request not found")
    if join_request.status != TeamJoinRequestStatus.PENDING:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This request has already been decided"
        )
    return join_request


@router.post("/{team_id}/join-requests/{request_id}/accept", response_model=TeamOut)
def accept_join_request(
    team_id: uuid.UUID,
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamOut:
    team = _get_team_or_404(db, team_id)
    _require_manager(db, team_id, current_user.id)
    join_request = _get_pending_join_request(db, team_id, request_id)

    join_request.status = TeamJoinRequestStatus.ACCEPTED
    if _get_membership(db, team_id, join_request.user_id) is None:
        db.add(
            TeamMember(
                team_id=team_id, user_id=join_request.user_id, role=TeamRole.MEMBER
            )
        )
        db.flush()
        chat.get_or_create_team_conversation(db, team)
    notify(
        db,
        join_request.user_id,
        NotificationType.TEAM_JOIN_REQUEST_ACCEPTED,
        "Join request accepted",
        f"You're now a member of {team.name}.",
    )
    emit_activity(
        db,
        join_request.user_id,
        "JOINED_TEAM",
        team_id=str(team.id),
        team_name=team.name,
    )
    db.commit()
    return _to_out(db, team, current_user.id)


@router.post(
    "/{team_id}/join-requests/{request_id}/decline",
    response_model=TeamJoinRequestOut,
)
def decline_join_request(
    team_id: uuid.UUID,
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamJoinRequest:
    team = _get_team_or_404(db, team_id)
    _require_manager(db, team_id, current_user.id)
    join_request = _get_pending_join_request(db, team_id, request_id)

    join_request.status = TeamJoinRequestStatus.DECLINED
    notify(
        db,
        join_request.user_id,
        NotificationType.TEAM_JOIN_REQUEST_DECLINED,
        "Join request declined",
        f"Your request to join {team.name} was declined.",
    )
    db.commit()
    db.refresh(join_request)
    return join_request


@router.delete(
    "/{team_id}/join-requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT
)
def cancel_join_request(
    team_id: uuid.UUID,
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    join_request = _get_pending_join_request(db, team_id, request_id)
    if join_request.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your join request")

    # Hard-deleted rather than soft-cancelled (unlike decline, which keeps
    # the row) so the unique (team_id, user_id) constraint doesn't
    # permanently block a future request after withdrawing this one.
    db.delete(join_request)
    db.commit()


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    team = _get_team_or_404(db, team_id)
    membership = _require_member(db, team_id, current_user.id)
    if membership.role != TeamRole.OWNER:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the team owner can delete the team"
        )

    conversation = db.scalar(
        select(Conversation).where(Conversation.team_id == team_id)
    )
    if conversation is not None:
        for message in db.scalars(
            select(Message).where(Message.conversation_id == conversation.id)
        ):
            db.delete(message)
        for participant in db.scalars(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conversation.id
            )
        ):
            db.delete(participant)
        db.flush()
        db.delete(conversation)

    for join_request in db.scalars(
        select(TeamJoinRequest).where(TeamJoinRequest.team_id == team_id)
    ):
        db.delete(join_request)
    for member in db.scalars(select(TeamMember).where(TeamMember.team_id == team_id)):
        db.delete(member)
    db.flush()
    db.delete(team)
    db.commit()
