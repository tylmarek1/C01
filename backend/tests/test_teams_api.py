from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app


def register_and_login(
    client: TestClient, email: str, name: str = "Player"
) -> tuple[str, str]:
    client.post(
        "/auth/register", json={"name": name, "email": email, "password": "supersecret"}
    )
    response = client.post(
        "/auth/login", json={"email": email, "password": "supersecret"}
    )
    body = response.json()
    return body["access_token"], body["user"]["id"]


def test_creating_a_team_makes_the_creator_owner_with_a_team_chat(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token, user_id = register_and_login(client, "nora@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/teams",
        json={"name": "Tuesday Volleyball Crew", "sport_type": "VOLLEYBALL"},
        headers=headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["my_role"] == "OWNER"
    assert len(body["members"]) == 1
    assert body["members"][0]["user"]["id"] == user_id

    # A team conversation already exists — the creator can post in it immediately.
    conversations = client.get("/conversations", headers=headers).json()
    team_conversation = next(c for c in conversations if c["kind"] == "TEAM")
    sent = client.post(
        f"/conversations/{team_conversation['id']}/messages",
        json={"body": "Welcome to the team!"},
        headers=headers,
    )
    assert sent.status_code == 201


def test_duplicate_team_name_is_rejected(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token, _user_id = register_and_login(client, "omar@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/teams", json={"name": "Rivals"}, headers=headers)
    dup = client.post("/teams", json={"name": "Rivals"}, headers=headers)
    assert dup.status_code == 409


def test_owner_can_add_and_remove_a_member(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "pia@example.com")
    member_token, member_id = register_and_login(client, "quinn@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    team_id = client.post(
        "/teams", json={"name": "Pia's Squad"}, headers=owner_headers
    ).json()["id"]

    added = client.post(
        f"/teams/{team_id}/members",
        json={"email": "quinn@example.com"},
        headers=owner_headers,
    )
    assert added.status_code == 200
    assert {m["user"]["id"] for m in added.json()["members"]} == {
        _owner_id_of(client, "pia@example.com", session_factory),
        member_id,
    }

    notifications = client.get("/notifications", headers=member_headers).json()
    assert any(n["type"] == "TEAM_MEMBER_ADDED" for n in notifications)

    # Adding twice is idempotent.
    again = client.post(
        f"/teams/{team_id}/members",
        json={"email": "quinn@example.com"},
        headers=owner_headers,
    )
    assert len(again.json()["members"]) == 2

    # The new member can now use the team chat.
    team_detail = client.get(f"/teams/{team_id}", headers=member_headers)
    assert team_detail.status_code == 200

    removed = client.delete(
        f"/teams/{team_id}/members/{member_id}", headers=owner_headers
    )
    assert removed.status_code == 200
    assert len(removed.json()["members"]) == 1
    assert client.get(f"/teams/{team_id}", headers=member_headers).status_code == 403


def _owner_id_of(client: TestClient, email: str, session_factory: sessionmaker) -> str:
    from reservations.models import User

    with session_factory() as session:
        return str(session.query(User).filter_by(email=email).one().id)


def test_only_owner_can_add_or_remove_other_members(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "riley@example.com")
    member_token, _member_id = register_and_login(client, "sasha@example.com")
    outsider_token, outsider_id = register_and_login(client, "toby@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    team_id = client.post(
        "/teams", json={"name": "Riley's Court"}, headers=owner_headers
    ).json()["id"]
    client.post(
        f"/teams/{team_id}/members",
        json={"email": "sasha@example.com"},
        headers=owner_headers,
    )

    forbidden_add = client.post(
        f"/teams/{team_id}/members",
        json={"email": "toby@example.com"},
        headers=member_headers,
    )
    assert forbidden_add.status_code == 403

    forbidden_remove = client.delete(
        f"/teams/{team_id}/members/{outsider_id}", headers=member_headers
    )
    assert forbidden_remove.status_code in (403, 404)


def test_a_member_can_leave_but_the_last_owner_cannot(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    owner_token, owner_id = register_and_login(client, "uma@example.com")
    member_token, member_id = register_and_login(client, "vik@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    team_id = client.post(
        "/teams", json={"name": "Uma's Circle"}, headers=owner_headers
    ).json()["id"]
    client.post(
        f"/teams/{team_id}/members",
        json={"email": "vik@example.com"},
        headers=owner_headers,
    )

    left = client.delete(
        f"/teams/{team_id}/members/{member_id}", headers=member_headers
    )
    assert left.status_code == 200

    cannot_leave = client.delete(
        f"/teams/{team_id}/members/{owner_id}", headers=owner_headers
    )
    assert cannot_leave.status_code == 409


def test_owner_can_delete_the_team(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "wren@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    team_id = client.post(
        "/teams", json={"name": "Wren's Club"}, headers=owner_headers
    ).json()["id"]
    deleted = client.delete(f"/teams/{team_id}", headers=owner_headers)
    assert deleted.status_code == 204
    assert client.get(f"/teams/{team_id}", headers=owner_headers).status_code == 404


def test_getting_an_unknown_team_is_404_and_a_non_member_is_403(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "xena@example.com")
    outsider_token, _outsider_id = register_and_login(client, "yara@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

    team_id = client.post(
        "/teams", json={"name": "Xena's Team"}, headers=owner_headers
    ).json()["id"]

    assert client.get(f"/teams/{team_id}", headers=outsider_headers).status_code == 403
    assert (
        client.get(
            "/teams/00000000-0000-0000-0000-000000000000", headers=owner_headers
        ).status_code
        == 404
    )


def test_removing_a_member_revokes_their_chat_access_immediately(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "zane@example.com")
    member_token, member_id = register_and_login(client, "ivy@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    team_id = client.post(
        "/teams", json={"name": "Zane's Squad"}, headers=owner_headers
    ).json()["id"]
    client.post(
        f"/teams/{team_id}/members",
        json={"email": "ivy@example.com"},
        headers=owner_headers,
    )

    chat_before = client.get(f"/teams/{team_id}/chat", headers=member_headers)
    assert chat_before.status_code == 200
    conversation_id = chat_before.json()["id"]
    assert (
        client.post(
            f"/conversations/{conversation_id}/messages",
            json={"body": "hi team"},
            headers=member_headers,
        ).status_code
        == 201
    )

    client.delete(f"/teams/{team_id}/members/{member_id}", headers=owner_headers)

    assert (
        client.get(f"/teams/{team_id}/chat", headers=member_headers).status_code == 403
    )
    assert (
        client.post(
            f"/conversations/{conversation_id}/messages",
            json={"body": "still here?"},
            headers=member_headers,
        ).status_code
        == 403
    )
