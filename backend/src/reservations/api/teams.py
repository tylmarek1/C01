import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations import chat
from reservations.deps import get_current_user, get_db
from reservations.models import (
    Conversation,
    ConversationParticipant,
    Message,
    NotificationType,
    Team,
    TeamMember,
    TeamRole,
    User,
)
from reservations.notifications import notify
from reservations.schemas.auth import UserOut
from reservations.schemas.chat import ConversationOut
from reservations.schemas.team import TeamCreate, TeamMemberAdd, TeamMemberOut, TeamOut

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


@router.get("/{team_id}", response_model=TeamOut)
def get_team(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamOut:
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    _require_member(db, team_id, current_user.id)
    return _to_out(db, team, current_user.id)


@router.get("/{team_id}/chat", response_model=ConversationOut)
def get_team_chat(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationOut:
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
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
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    membership = _require_member(db, team_id, current_user.id)
    if membership.role != TeamRole.OWNER:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the team owner can add members"
        )

    new_user = db.scalar(select(User).where(User.email == payload.email))
    if new_user is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "No player found with that email"
        )

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
    db.commit()
    return _to_out(db, team, current_user.id)


@router.delete("/{team_id}/members/{user_id}", response_model=TeamOut)
def remove_team_member(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamOut:
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    my_membership = _require_member(db, team_id, current_user.id)

    target_membership = _get_membership(db, team_id, user_id)
    if target_membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not a member of this team")

    is_self = user_id == current_user.id
    if not is_self and my_membership.role != TeamRole.OWNER:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the team owner can remove other members"
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


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
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

    for member in db.scalars(select(TeamMember).where(TeamMember.team_id == team_id)):
        db.delete(member)
    db.flush()
    db.delete(team)
    db.commit()
