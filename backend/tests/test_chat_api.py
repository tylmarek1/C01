from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, SportType

PRAGUE = ZoneInfo("Europe/Prague")


def at(hour: int, minute: int = 0) -> str:
    day = (datetime.now(PRAGUE) + timedelta(days=3)).date()
    return datetime(
        day.year, day.month, day.day, hour, minute, tzinfo=PRAGUE
    ).isoformat()


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


def seed_court(session_factory: sessionmaker, name: str = "Chat Court") -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.commit()
        return str(court.id)


def test_dm_round_trip_and_unread_count(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token_a, user_a = register_and_login(client, "amara@example.com")
    token_b, user_b = register_and_login(client, "bo@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    opened = client.post(f"/chat/dm/{user_b}", headers=headers_a)
    assert opened.status_code == 200
    conversation_id = opened.json()["id"]
    assert opened.json()["kind"] == "DM"
    assert {p["id"] for p in opened.json()["participants"]} == {user_a, user_b}

    # Re-opening the same DM from either side returns the same conversation.
    reopened = client.post(f"/chat/dm/{user_a}", headers=headers_b)
    assert reopened.json()["id"] == conversation_id

    sent = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"body": "hey, still on for tennis?"},
        headers=headers_a,
    )
    assert sent.status_code == 201
    assert sent.json()["sender"]["id"] == user_a

    conversations_b = client.get("/conversations", headers=headers_b).json()
    assert len(conversations_b) == 1
    assert conversations_b[0]["unread_count"] == 1
    assert conversations_b[0]["last_message"]["body"] == "hey, still on for tennis?"

    messages = client.get(
        f"/conversations/{conversation_id}/messages", headers=headers_b
    ).json()
    assert len(messages) == 1

    conversations_b_after_read = client.get("/conversations", headers=headers_b).json()
    assert conversations_b_after_read[0]["unread_count"] == 0


def test_cannot_message_yourself(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token, user_id = register_and_login(client, "cass@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(f"/chat/dm/{user_id}", headers=headers)
    assert response.status_code == 400


def test_non_participant_cannot_read_or_send(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token_a, user_a = register_and_login(client, "dax@example.com")
    token_b, user_b = register_and_login(client, "ezra@example.com")
    token_c, _user_c = register_and_login(client, "finn@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_c = {"Authorization": f"Bearer {token_c}"}

    conversation_id = client.post(f"/chat/dm/{user_b}", headers=headers_a).json()["id"]

    assert (
        client.get(
            f"/conversations/{conversation_id}/messages", headers=headers_c
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/conversations/{conversation_id}/messages",
            json={"body": "hi"},
            headers=headers_c,
        ).status_code
        == 403
    )


def test_reservation_chat_booker_and_guest_can_message_stranger_cannot(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    booker_token, booker_id = register_and_login(client, "gia@example.com")
    guest_token, _guest_id = register_and_login(client, "hugo@example.com", "Hugo")
    stranger_token, _stranger_id = register_and_login(client, "iva@example.com")
    booker_headers = {"Authorization": f"Bearer {booker_token}"}
    guest_headers = {"Authorization": f"Bearer {guest_token}"}
    stranger_headers = {"Authorization": f"Bearer {stranger_token}"}

    reservation_id = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(17), "end_time": at(18)},
        headers=booker_headers,
    ).json()["id"]

    # Before the guest is invited, only the booker can open the chat.
    assert (
        client.get(
            f"/reservations/{reservation_id}/chat", headers=guest_headers
        ).status_code
        == 403
    )

    client.post(
        f"/reservations/{reservation_id}/guests",
        json={"email": "hugo@example.com"},
        headers=booker_headers,
    )

    booker_chat = client.get(
        f"/reservations/{reservation_id}/chat", headers=booker_headers
    )
    assert booker_chat.status_code == 200
    conversation_id = booker_chat.json()["id"]
    assert {p["email"] for p in booker_chat.json()["participants"]} == {
        "gia@example.com",
        "hugo@example.com",
    }

    guest_chat = client.get(
        f"/reservations/{reservation_id}/chat", headers=guest_headers
    )
    assert guest_chat.status_code == 200
    assert guest_chat.json()["id"] == conversation_id

    sent = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"body": "bring your own racket"},
        headers=guest_headers,
    )
    assert sent.status_code == 201

    assert (
        client.get(
            f"/reservations/{reservation_id}/chat", headers=stranger_headers
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/conversations/{conversation_id}/messages", headers=stranger_headers
        ).status_code
        == 403
    )


def test_message_body_validation(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token_a, _user_a = register_and_login(client, "jael@example.com")
    token_b, user_b = register_and_login(client, "kit@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    conversation_id = client.post(f"/chat/dm/{user_b}", headers=headers_a).json()["id"]
    empty = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"body": ""},
        headers=headers_a,
    )
    assert empty.status_code == 422


def test_websocket_receives_a_broadcast_message(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token_a, user_a = register_and_login(client, "liv@example.com")
    token_b, user_b = register_and_login(client, "milo@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    conversation_id = client.post(f"/chat/dm/{user_b}", headers=headers_a).json()["id"]

    with client.websocket_connect("/ws/chat") as ws:
        ws.send_json({"type": "auth", "token": token_b})
        client.post(
            f"/conversations/{conversation_id}/messages",
            json={"body": "on my way"},
            headers=headers_a,
        )
        frame = ws.receive_json()
        assert frame["type"] == "message"
        assert frame["conversation_id"] == conversation_id
        assert frame["message"]["body"] == "on my way"
        assert frame["message"]["sender"]["id"] == user_a


def test_websocket_closes_on_invalid_auth(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    with client.websocket_connect("/ws/chat") as ws:
        ws.send_json({"type": "auth", "token": "not-a-real-token"})
        try:
            ws.receive_json()
            raised = False
        except Exception:
            raised = True
        assert raised
