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


def test_owner_can_add_a_member_by_user_id(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "aria@example.com")
    _member_token, member_id = register_and_login(client, "beau@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    team_id = client.post(
        "/teams", json={"name": "Aria's Crew"}, headers=owner_headers
    ).json()["id"]

    added = client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_id},
        headers=owner_headers,
    )
    assert added.status_code == 200
    assert member_id in {m["user"]["id"] for m in added.json()["members"]}


def test_add_member_requires_exactly_one_of_email_or_user_id(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "cleo@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    team_id = client.post(
        "/teams", json={"name": "Cleo's Crew"}, headers=owner_headers
    ).json()["id"]

    neither = client.post(f"/teams/{team_id}/members", json={}, headers=owner_headers)
    assert neither.status_code == 422

    both = client.post(
        f"/teams/{team_id}/members",
        json={"email": "cleo@example.com", "user_id": _owner_id},
        headers=owner_headers,
    )
    assert both.status_code == 422


def test_owner_can_update_team_details(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "dana@example.com")
    headers = {"Authorization": f"Bearer {owner_token}"}
    team_id = client.post(
        "/teams", json={"name": "Dana's Crew"}, headers=headers
    ).json()["id"]

    updated = client.patch(
        f"/teams/{team_id}",
        json={
            "name": "Dana's New Crew",
            "description": "Now with a description",
            "is_public": False,
        },
        headers=headers,
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["name"] == "Dana's New Crew"
    assert body["description"] == "Now with a description"
    assert body["is_public"] is False


def test_captain_can_edit_but_not_change_visibility_or_delete(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "elan@example.com")
    captain_token, captain_id = register_and_login(client, "farah@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    captain_headers = {"Authorization": f"Bearer {captain_token}"}

    team_id = client.post(
        "/teams", json={"name": "Elan's Crew"}, headers=owner_headers
    ).json()["id"]
    client.post(
        f"/teams/{team_id}/members", json={"user_id": captain_id}, headers=owner_headers
    )
    client.patch(
        f"/teams/{team_id}/members/{captain_id}/role",
        json={"role": "CAPTAIN"},
        headers=owner_headers,
    )

    edited = client.patch(
        f"/teams/{team_id}",
        json={"description": "Captain-edited"},
        headers=captain_headers,
    )
    assert edited.status_code == 200
    assert edited.json()["description"] == "Captain-edited"

    forbidden_visibility = client.patch(
        f"/teams/{team_id}", json={"is_public": False}, headers=captain_headers
    )
    assert forbidden_visibility.status_code == 403

    forbidden_delete = client.delete(f"/teams/{team_id}", headers=captain_headers)
    assert forbidden_delete.status_code == 403

    # A captain can add a member and remove a plain member, but not another captain.
    _member_token, member_id = register_and_login(client, "gita@example.com")
    added = client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_id},
        headers=captain_headers,
    )
    assert added.status_code == 200

    _other_captain_token, other_captain_id = register_and_login(
        client, "hiro@example.com"
    )
    client.post(
        f"/teams/{team_id}/members",
        json={"user_id": other_captain_id},
        headers=owner_headers,
    )
    client.patch(
        f"/teams/{team_id}/members/{other_captain_id}/role",
        json={"role": "CAPTAIN"},
        headers=owner_headers,
    )
    cannot_remove_captain = client.delete(
        f"/teams/{team_id}/members/{other_captain_id}", headers=captain_headers
    )
    assert cannot_remove_captain.status_code == 403


def test_owner_can_promote_and_demote_captain(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "ines@example.com")
    _member_token, member_id = register_and_login(client, "juno@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    team_id = client.post(
        "/teams", json={"name": "Ines's Crew"}, headers=owner_headers
    ).json()["id"]
    client.post(
        f"/teams/{team_id}/members", json={"user_id": member_id}, headers=owner_headers
    )

    promoted = client.patch(
        f"/teams/{team_id}/members/{member_id}/role",
        json={"role": "CAPTAIN"},
        headers=owner_headers,
    )
    assert promoted.status_code == 200
    roles = {m["user"]["id"]: m["role"] for m in promoted.json()["members"]}
    assert roles[member_id] == "CAPTAIN"

    demoted = client.patch(
        f"/teams/{team_id}/members/{member_id}/role",
        json={"role": "MEMBER"},
        headers=owner_headers,
    )
    assert demoted.status_code == 200
    roles = {m["user"]["id"]: m["role"] for m in demoted.json()["members"]}
    assert roles[member_id] == "MEMBER"


def test_non_owner_cannot_change_member_role(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    owner_token, owner_id = register_and_login(client, "kian@example.com")
    member_token, member_id = register_and_login(client, "lena@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}
    team_id = client.post(
        "/teams", json={"name": "Kian's Crew"}, headers=owner_headers
    ).json()["id"]
    client.post(
        f"/teams/{team_id}/members", json={"user_id": member_id}, headers=owner_headers
    )

    forbidden = client.patch(
        f"/teams/{team_id}/members/{owner_id}/role",
        json={"role": "MEMBER"},
        headers=member_headers,
    )
    assert forbidden.status_code == 403


def test_discover_lists_public_teams_excluding_mine_and_private(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    viewer_token, _viewer_id = register_and_login(client, "milo@example.com")
    other_token, _other_id = register_and_login(client, "nia@example.com")
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}

    mine_id = client.post(
        "/teams", json={"name": "Milo's Own Crew"}, headers=viewer_headers
    ).json()["id"]
    public_id = client.post(
        "/teams",
        json={"name": "Nia's Open Crew", "sport_type": "TENNIS"},
        headers=other_headers,
    ).json()["id"]
    private_id = client.post(
        "/teams", json={"name": "Nia's Hidden Crew"}, headers=other_headers
    ).json()["id"]
    client.patch(
        f"/teams/{private_id}", json={"is_public": False}, headers=other_headers
    )

    listing = client.get("/teams/discover", headers=viewer_headers).json()
    ids = {t["id"] for t in listing}
    assert public_id in ids
    assert private_id not in ids
    assert mine_id not in ids  # already a member — not "discoverable" for me

    by_sport = client.get(
        "/teams/discover", params={"sport": "TENNIS"}, headers=viewer_headers
    ).json()
    assert {t["id"] for t in by_sport} == {public_id}


def test_join_request_accept_creates_membership_and_notifies(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "otto@example.com")
    requester_token, requester_id = register_and_login(client, "pia@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    requester_headers = {"Authorization": f"Bearer {requester_token}"}
    team_id = client.post(
        "/teams", json={"name": "Otto's Open Crew"}, headers=owner_headers
    ).json()["id"]

    request = client.post(f"/teams/{team_id}/join-requests", headers=requester_headers)
    assert request.status_code == 201
    request_id = request.json()["id"]

    # A duplicate pending request is rejected.
    dup = client.post(f"/teams/{team_id}/join-requests", headers=requester_headers)
    assert dup.status_code == 409

    pending = client.get(
        f"/teams/{team_id}/join-requests", headers=owner_headers
    ).json()
    assert [r["id"] for r in pending] == [request_id]

    accepted = client.post(
        f"/teams/{team_id}/join-requests/{request_id}/accept", headers=owner_headers
    )
    assert accepted.status_code == 200
    assert requester_id in {m["user"]["id"] for m in accepted.json()["members"]}

    notifications = client.get("/notifications", headers=requester_headers).json()
    assert any(n["type"] == "TEAM_JOIN_REQUEST_ACCEPTED" for n in notifications)


def test_join_request_decline_and_cancel(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "quinn@example.com")
    requester_token, requester_id = register_and_login(client, "rio@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    requester_headers = {"Authorization": f"Bearer {requester_token}"}
    team_id = client.post(
        "/teams", json={"name": "Quinn's Open Crew"}, headers=owner_headers
    ).json()["id"]

    request_id = client.post(
        f"/teams/{team_id}/join-requests", headers=requester_headers
    ).json()["id"]
    declined = client.post(
        f"/teams/{team_id}/join-requests/{request_id}/decline", headers=owner_headers
    )
    assert declined.status_code == 200
    assert declined.json()["status"] == "DECLINED"
    notifications = client.get("/notifications", headers=requester_headers).json()
    assert any(n["type"] == "TEAM_JOIN_REQUEST_DECLINED" for n in notifications)

    # A second team to verify cancel frees up a later re-request.
    team_id_2 = client.post(
        "/teams", json={"name": "Quinn's Second Crew"}, headers=owner_headers
    ).json()["id"]
    request_id_2 = client.post(
        f"/teams/{team_id_2}/join-requests", headers=requester_headers
    ).json()["id"]
    cancelled = client.delete(
        f"/teams/{team_id_2}/join-requests/{request_id_2}", headers=requester_headers
    )
    assert cancelled.status_code == 204
    re_request = client.post(
        f"/teams/{team_id_2}/join-requests", headers=requester_headers
    )
    assert re_request.status_code == 201


def test_cannot_request_to_join_private_team_or_if_already_member(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "sami@example.com")
    other_token, _other_id = register_and_login(client, "tara@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}
    team_id = client.post(
        "/teams", json={"name": "Sami's Crew"}, headers=owner_headers
    ).json()["id"]
    client.patch(f"/teams/{team_id}", json={"is_public": False}, headers=owner_headers)

    private_rejected = client.post(
        f"/teams/{team_id}/join-requests", headers=other_headers
    )
    assert private_rejected.status_code == 403

    client.patch(f"/teams/{team_id}", json={"is_public": True}, headers=owner_headers)
    already_member_rejected = client.post(
        f"/teams/{team_id}/join-requests", headers=owner_headers
    )
    assert already_member_rejected.status_code == 409


def test_non_manager_cannot_upload_team_avatar(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    owner_token, _owner_id = register_and_login(client, "uma@example.com")
    other_token, _other_id = register_and_login(client, "vik@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}
    team_id = client.post(
        "/teams", json={"name": "Uma's Crew"}, headers=owner_headers
    ).json()["id"]

    forbidden = client.post(
        f"/teams/{team_id}/avatar",
        files={"file": ("avatar.png", b"not-a-real-image", "image/png")},
        headers=other_headers,
    )
    assert forbidden.status_code == 403
