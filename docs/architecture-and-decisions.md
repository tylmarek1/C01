# Architecture and Decisions

## Overview

This section is a snapshot from when ADR-000 was written, kept as-is
alongside the decisions below rather than rewritten to match later
changes (§0's append-only rule for this file). For the current module map
— everything added since, including the C02 approval flow, the admin
panel and the rest of `api/` — see `docs/codebase-map.md` instead.

```
React SPA (frontend/) ──fetch, JWT bearer──► FastAPI (backend/src/reservations/main.py)
                                                │  routers: auth, courts, reservations
                                                │  request/response schemas (Pydantic)
                                                ▼
                                             domain logic (states, slot rule)
                                                │
                                                ▼
                                             SQLAlchemy ORM (models/, db.py) ──► PostgreSQL 16
                                                │
                                                └──► Notification Service (boundary, stub for now)
```

- **Stack:** Python 3.12, FastAPI, SQLAlchemy 2, psycopg 3, PostgreSQL 16, pytest, uv, Docker Compose (backend); React 19, TypeScript, Vite, Tailwind CSS 4, shadcn-style components, TanStack Query (frontend).
- **Configuration:** `DATABASE_URL`, `SECRET_KEY`, `FRONTEND_ORIGIN` environment variables for the backend (defaults in `backend/.env.example`); `VITE_API_URL` for the frontend (`frontend/.env.example`).
- **Tests** run against a real PostgreSQL started by `docker compose`, not SQLite, because we rely on PostgreSQL-specific features.

## Decisions

### ADR-000: Python/FastAPI instead of the Java/Spring stack
- **Status:** accepted (C01)
- **Context:** the team is faster in Python. The course allows another stack if the team supports it itself.
- **Decision:** use FastAPI + SQLAlchemy + PostgreSQL, with uv for reproducible dependency management (`uv.lock`).
- **Consequence:** no course support for the stack. The README must be enough for a clean checkout to build and run.

### ADR-001: Enforce "no overlapping CONFIRMED reservations" with a PostgreSQL exclusion constraint
- **Status:** accepted (C01, based on the persistence spike, see `evidence-and-evolution.md`)
- **Context:** the common business rule must hold even under our Q pressure (10× concurrent confirmations of the same slot). An application-level check (SELECT, then INSERT/UPDATE) races between concurrent transactions.
- **Decision:** `reservations` has
  `EXCLUDE USING gist (court_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status = 'CONFIRMED')`
  (requires the `btree_gist` extension), plus `CHECK (end_time > start_time)`.
- **Consequences:**
  - The database is the source of truth for the rule. In the spike, 10 concurrent confirmations gave 1 success and 9 `ExclusionViolation`s.
  - Half-open ranges allow back-to-back slots. DRAFT and CANCELLED rows do not block a slot.
  - The API must translate `ExclusionViolation` into HTTP 409 Conflict.
  - The project is tied to PostgreSQL, and tests must run against PostgreSQL rather than SQLite.
- **Amendment (C02, 2026-09-21):** the constraint now covers every state that holds a court — `WHERE status IN ('PENDING', 'PENDING_APPROVAL', 'CONFIRMED', 'CHECKED_IN')` (constraint name `no_overlapping_active_reservations`) — because a `PENDING` hold blocks a slot from Create onwards (the first consequence above, "DRAFT … do not block", no longer holds) and a request awaiting approval blocks too. A test fails if the constraint and `ACTIVE_RESERVATION_STATUSES` drift apart. The mechanism of ADR-001 is unchanged; see `specification.md` BR-02 and `change-c02-impact.md` driver AD-2.

### ADR-002: Split the repository into `backend/` and `frontend/`
- **Status:** accepted (post-C01, adding the walking-skeleton UI)
- **Context:** the project grew a second, independently-versioned stack (a React app) alongside the Python API. Keeping both at the repository root would mix `package.json`/`node_modules` with `pyproject.toml`/`.venv` and make it unclear which tool (`uv` vs `npm`) applies to which files.
- **Decision:** move all existing backend code (`src/`, `tests/`, `pyproject.toml`, `uv.lock`) into `backend/`, unchanged in behavior, and add the new app under `frontend/`. Each half keeps its own README with setup steps; the root README covers the project as a whole.
- **Consequences:** every backend path in this repo's docs now has a `backend/` prefix. `docker-compose.yml` stays at the repository root since it only provisions shared infrastructure (PostgreSQL).

### ADR-003: Stateless JWT bearer auth instead of server-side sessions
- **Status:** accepted (post-C01, adding register/login)
- **Context:** the API needed a way to identify the `Player` making a reservation instead of trusting a `user_id` supplied by the client. The frontend is a separate SPA origin, not server-rendered, so cookie-session affinity adds little value here.
- **Decision:** `POST /auth/register` and `POST /auth/login` return a short-lived `HS256` JWT (`sub` = user id); `bcrypt` hashes stored passwords. Protected endpoints depend on `get_current_user`, which decodes the bearer token and loads the `User` row — see `backend/src/reservations/security.py` and `deps.py`.
- **Consequences:** no server-side session store to scale or invalidate; logout is client-side only (the token is simply discarded). `SECRET_KEY` must be a real secret outside local dev — the code falls back to an insecure default so the walking skeleton still runs out of the box.

### ADR-004: In-process WebSocket registry for chat, not a message broker
- **Status:** accepted (product expansion beyond C02, "Courtly Communities" PRs #38–#44)
- **Context:** real-time chat (DM, per-reservation, and per-team) was the first feature in this codebase needing server-initiated push to a connected client — everything before it was plain request/response. A message queue or pub/sub layer (Redis, etc.) would let delivery fan out across multiple server processes, but this app has never run as more than one process (`fastapi dev`/one `uvicorn` worker) and ADR-000's stack choice already prioritized what the team can build and reason about over infrastructure it doesn't need yet.
- **Decision:** `POST /conversations/{id}/messages` (REST) is the single path a message is created through; a FastAPI `@router.websocket("/ws/chat")` route then pushes it to any of that conversation's other participants who happen to be connected, tracked in `chat_hub.py`'s in-process `dict[user_id, set[WebSocket]]`. The client authenticates the socket by sending `{"type":"auth","token":...}` as its first frame after connecting, not a `?token=` query string — the browser `WebSocket` API can't set an `Authorization` header, and a token in the URL risks landing in access/proxy logs.
- **Consequences:** delivery only reaches a recipient connected to the *same* process handling their socket — this design does not fan out across multiple workers/processes. That's the same single-process tradeoff already accepted for `rate_limit.py`'s in-memory store and `worker.py`'s in-process background task, made explicit here because it's the first time it applies to something user-visible in real time rather than a background job. If this app is ever deployed with more than one server process, chat delivery would need a shared broker (e.g. Redis pub/sub) or sticky sessions on the WebSocket route — not a change to make speculatively before it's actually needed.

## C03 Part A — AS-IS trace: Confirm Reservation

Assignment: `docs/course/C03.md` (Part A). This section shows how the code
works **today** (2026-10-05, `main` at `a26884c`), not a target design.
Code paths are relative to `backend/src/reservations/`. Every claim below
was checked in the code, in a test that passes, or in a runtime probe.
The tests are `backend/tests/test_spec_baseline.py -k ve_03` (9 passed),
`test_approval_api.py -k ve_03` (5 passed) and `test_persistence_spike.py`
(3 passed), all run against PostgreSQL 16 on 2026-10-05.

### A1. Scenario

| Item | Value |
|---|---|
| Scenario / operation | **OP-03 Confirm Reservation** (`POST /reservations/{id}/confirm`) |
| Requirements | REQ-04, REQ-05, REQ-07 |
| Rules / invariants | BR-02, BR-06, BR-09, BR-10, BR-11, BR-12 |
| Baseline | v0.2 (`docs/specification.md`) |

### A2. Main success path → code

These are the steps of the OP-03 main success scenario in v0.2. Step 5 has
two variants, depending on the court.

| v0.2 step | Realised in code | Evidence |
|---|---|---|
| 1. Accept the confirm request, authenticate the caller | `confirm_reservation()`; `get_current_user()` decodes the JWT bearer token | `api/reservations.py:450`, `deps.py:30`, `security.py:25` |
| 2. Load X and serialise against other changes to X | `_get_owned_reservation(..., lock=True)` → `db.get(Reservation, id, with_for_update=True)` (`SELECT … FOR UPDATE`) | `api/reservations.py:412-431`, line 423; VE-03.6 (Confirm‖Cancel ×20 always ends `CANCELLED`) |
| 3a. Check that the caller is the owner or a manager | same helper: `user_id != current_user.id` and role not in (`VENUE_MANAGER`, `ADMIN`) → 403 | `api/reservations.py:426-430`; VE-03.5 |
| 3b. Check that the transition is allowed (X is `PENDING`) | `transition()` looks up `ALLOWED_TRANSITIONS[status]`; an illegal edge → 409 | `lifecycle.py:19`, `:165-170`; VE-03.2 |
| 3c. Check that the hold is valid and the court is active | `_check_guards()`: `hold_expires_at < now` → 409, `not court.active` → 409 | `lifecycle.py:86-110`; VE-03.3, VE-03.4 |
| 4. Read the court's `requires_approval` flag | branch in `confirm_reservation()`: `status == PENDING and court.requires_approval` | `api/reservations.py:456-461`, `models/court.py:39` |
| 5a. *(normal court)* Set `CONFIRMED`, clear the hold, record the event | `transition(..., CONFIRMED)`: sets `status`, sets `hold_expires_at = None`, adds a `ReservationEvent(CONFIRMED)` | `lifecycle.py:174-188`; VE-03.1, VE-03.8b |
| 5b. *(approval court)* Set `PENDING_APPROVAL`, set the deadline, notify the managers | `approval_service.submit_for_approval()` → `transition(..., PENDING_APPROVAL)` (event `SUBMITTED`), then `approval_deadline()` = `min(now + 24 h, start)`, then `notify_approval_requested()` | `approval_service.py:23-58`; VE-03.8, VE-03.9 |
| 6a. Notify the owner | `notify()` writes a `Notification` row **and** synchronously calls `_send_web_push()` | `api/reservations.py:466-472`, `notifications.py:57-70` |
| 6b. Save the result and return the new state | `db.commit()`, then `db.refresh()`, then `ReservationOut` | `api/reservations.py:473-481` |

Confirm does not run a separate "evaluate conflict" step (the course
template's row). Under v0.2 D-08 it cannot fail on overlap: the `PENDING`
hold already occupies the slot, and BR-02 is enforced by the exclusion
constraint (ADR-001). The `except IntegrityError → 409` at
`api/reservations.py:475` is the backstop that D-08 describes. Under the
current constraint it cannot trigger, because a `PENDING → CONFIRMED`
update stays inside the constraint's `WHERE` set and keeps the same range.

### A3. Alternative branch: hold expired → reject (BR-06, REQ-05)

| What v0.2 says | Where the condition is detected | Where the outcome is decided | What the caller gets |
|---|---|---|---|
| A `PENDING` hold whose `hold_deadline < now` cannot be confirmed (`CONFLICT`, state unchanged). The system sweeps it to `EXPIRED` within one cycle. "Confirm vs hold expiry → the deadline decides." | **Two places**, depending on whether the worker has run yet. (1) Not swept yet: `_check_guards()` compares `hold_expires_at < now` (`lifecycle.py:100-105`). (2) Already swept: `worker._expire_stale_holds()` selected the row with `FOR UPDATE SKIP LOCKED` and moved it to `EXPIRED` (`worker.py:35-59`, tick every 30 s, `worker.py:32`). Confirm then sees status `EXPIRED`. | (1) `_check_guards()` raises `HTTPException(409)`. (2) `transition()` finds no `EXPIRED → CONFIRMED` edge in `ALLOWED_TRANSITIONS` (`lifecycle.py:165-170`) and raises `HTTPException(409)`. Either way nothing is committed. | HTTP 409 with `"This hold has expired — book the slot again"` (case 1) or `"Cannot move a EXPIRED reservation to CONFIRMED"` (case 2). Reservation unchanged; the slot stays blocked until the sweep (VE-03.3, VE-03.7). |

Differences between v0.2 and the implementation found during this trace:

| Specification (v0.2) | Implementation | Evidence |
|---|---|---|
| Success postcondition: "owner notified 'Reservation confirmed'" / "'Approval requested'"; on an approval court "**every** Venue Manager notified". | `notify()` returns `None` and writes nothing if the recipient muted that notification type. An owner or manager who muted it gets no notification. The spec does not mention muting. | `notifications.py:60-64`; preferences in `api/notifications.py:33` |
| BR-10: "owner **or a Venue Manager**" may confirm; "every Venue Manager" is notified. | The `ADMIN` role is accepted as a manager and also receives the "Approval needed" notification. The spec never mentions `ADMIN`. | `api/reservations.py:426-429`, `approval_service.py:41-44`, `deps.py:50` ("ADMIN inherits everything a manager can do") |
| The A3 branch itself (expired hold → `CONFLICT`). | Matches v0.2. | VE-03.3 passes |

### A4. Main implementation parts

The scenario passes through about a dozen classes and functions, so the
blocks below are logical modules at the same level of detail.

| Part | Type / contents | Role in this scenario | Evidence |
|---|---|---|---|
| **Reservation API** | module: `api/reservations.py` (`confirm_reservation`, `_get_owned_reservation`) | accepts the command, loads and locks the row, checks ownership, chooses the normal or approval path, commits, maps errors to 409 | `api/reservations.py:412-481` |
| **Auth** | module: `deps.py` (`get_current_user`), `security.py` (`decode_access_token`) | authenticates the bearer token and loads the caller's `User` | `deps.py:30-46` |
| **Reservation lifecycle** | module: `lifecycle.py` (`transition`, `_check_guards`, `ALLOWED_TRANSITIONS`) | decides whether the transition is legal (edge table, BR-06/BR-11 guards), changes the state, writes the audit event | `lifecycle.py:19-188` |
| **Approval service** | module: `approval_service.py` (`submit_for_approval`, `approval_deadline`, `notify_approval_requested`) | approval-court variant: submits the reservation, computes the BR-12 deadline, picks the recipients | `approval_service.py:23-58` |
| **Notification integration** | module: `notifications.py` (`notify`, `_send_web_push`) | writes in-app `Notification` rows and sends Web Push to each of the recipient's subscriptions | `notifications.py:15-70` |
| **Persistence / domain model** | SQLAlchemy models `Reservation` (+ `ReservationStatus`, `ACTIVE_RESERVATION_STATUSES`, the exclusion constraint), `Court`, `ReservationEvent`, `Notification`, `PushSubscription`; session from `deps.get_db` / `db.py` | maps rows to objects. The model is anemic: no behaviour on `Reservation` itself, so the logic lives in `lifecycle.py` | `models/reservation.py`, `models/court.py`, `db.py:12-16` |
| **Background worker** *(competing writer, not called by Confirm)* | module: `worker.py` (`_expire_stale_holds`) | the other party in the A3 race: expires the same row under a row lock | `worker.py:35-59` |

### A5. State, state change, one rule

**State**

| Question | Answer | Evidence |
|---|---|---|
| Where is the Reservation state stored durably? | PostgreSQL table `reservations`: columns `status` (enum `reservation_status`), `hold_expires_at`, `approval_expires_at`. The history goes in `reservation_events`. There is no other copy: no cache, and the worker reads the same rows. | `models/reservation.py:38-77`; `lifecycle.py:181-188` |
| Which code decides and performs the transition? | **Decides:** `confirm_reservation()` chooses the target state (`CONFIRMED` or `PENDING_APPROVAL`, `api/reservations.py:456-466`). `lifecycle.transition()` + `_check_guards()` decide whether it is allowed. **Performs:** `transition()` assigns `reservation.status` (`lifecycle.py:174`). It becomes durable only at `db.commit()` in the router (`api/reservations.py:474`). Serialisation is not enforced inside `transition()`: its docstring makes holding a `FOR UPDATE` lock the *caller's* responsibility (`lifecycle.py:151-161`). | as cited |

**Rule: BR-11 (approval invariant).** On an approval-required court, Confirm must never produce `CONFIRMED`.

| Question | Answer | Evidence |
|---|---|---|
| Where is the rule's condition detected? | `court.requires_approval` is read in **two** places: the router branch (`api/reservations.py:456-458`) and the lifecycle guard (`lifecycle.py:112-116`). | as cited |
| Where is the outcome decided? | **Both places decide independently.** The router sends a `PENDING` reservation on an approval court to `submit_for_approval()`, so Confirm is a submission. The lifecycle guard rejects any `PENDING → CONFIRMED` on such a court with 409, whoever the caller is. That is the backstop for the other routes to `CONFIRMED` (waitlist accept, manager on behalf; v0.2 D-15). A third check, `approval_decision=True`, means only Approve/Reject can take `PENDING_APPROVAL → CONFIRMED` (`lifecycle.py:122-130`). | VE-03.8, VE-03.9, VE-03.10 |
| Where is the resulting state change made? | `transition(..., PENDING_APPROVAL)` called from `approval_service.submit_for_approval()` (`approval_service.py:56`). The deadline is set right after it, outside `transition()` (`approval_service.py:57`). | as cited |

For contrast, **BR-02** (no overlap) is not decided in application code at
all. It is the PostgreSQL exclusion constraint `no_overlapping_active_reservations`
(`models/reservation.py:45-51`, ADR-001). Confirm relies on it only
indirectly, through the hold.

### A6. Dependencies used by this scenario

| Dependency | Where it connects to our code | Which part knows its technical API | Evidence |
|---|---|---|---|
| **PostgreSQL 16** (database) | the SQLAlchemy session per request (`deps.get_db`), the row lock `SELECT … FOR UPDATE`, the exclusion constraint (GiST + `btree_gist`) | `db.py` (engine), `models/` (schema, `ExcludeConstraint`); the router uses `with_for_update` and catches `IntegrityError`, so the API layer also knows DB locking and error semantics | `api/reservations.py:423`, `:475`; `models/reservation.py:45-51` |
| **Web Push services** (external: browser vendors' push endpoints, via `pywebpush` + VAPID keys) | `notifications._send_web_push()`, called from `notify()` | only `notifications.py` (`webpush(...)`, VAPID claims, 404/410 handling, `timeout=5`) | `notifications.py:15-54`; `config.settings.vapid_*` |
| **Identity**: an internal JWT, not an external IdP | `deps.get_current_user` → `security.decode_access_token` (HS256, `SECRET_KEY`) | `security.py`, `deps.py` | ADR-003; `deps.py:30-46` |

There is no external Notification Service. "Notification" means a row in
our own `notifications` table plus a Web Push call. (ADR-000's overview
still shows a "Notification Service (boundary, stub for now)". The Web
Push path has replaced that stub; the overview is kept as a snapshot.)

### A7. AS-IS structural diagram

```mermaid
flowchart TB
    client(["HTTP client: owner or manager"])

    subgraph app["Application code: backend/src/reservations"]
        api["<b>Reservation API</b> · module<br/>accept confirm, lock row, check owner,<br/>choose normal / approval path, commit"]
        auth["<b>Auth</b> · module<br/>authenticate bearer token, load User"]
        appr["<b>Approval service</b> · module<br/>submit, compute BR-12 deadline,<br/>pick recipients"]
        life["<b>Reservation lifecycle</b> · module<br/>check edge + BR-06 / BR-11 guards,<br/>set status, write audit event"]
        notif["<b>Notification integration</b> · module<br/>write Notification row,<br/>send Web Push synchronously, inside the txn"]
        pers["<b>Persistence / domain model</b> · SQLAlchemy models + session<br/>map reservations, courts, events, notifications"]
        worker["<b>Background worker</b> · module<br/>expire stale holds; competes for the same row lock"]
    end

    db[("<b>PostgreSQL 16</b> · database<br/>reservations, reservation_events, notifications,<br/>push_subscriptions, courts, users<br/>+ exclusion constraint")]
    push["<b>Web Push services</b> · external system<br/>browser vendors' push endpoints"]

    client -->|"POST /reservations/{id}/confirm"| api
    api -->|"get_current_user"| auth
    api -->|"load + lock Reservation (FOR UPDATE), commit"| pers
    api -->|"normal court: transition(CONFIRMED)"| life
    api -->|"normal court: notify(owner)"| notif
    api -->|"approval court: submit_for_approval()"| appr
    appr -->|"transition(PENDING_APPROVAL)"| life
    appr -->|"notify(owner + every manager/admin)"| notif
    life -->|"set status, add ReservationEvent"| pers
    notif -->|"add Notification row"| pers
    worker -->|"select stale holds FOR UPDATE SKIP LOCKED, transition(EXPIRED)"| life
    pers -->|"SQL: SELECT FOR UPDATE / UPDATE / INSERT"| db
    notif -->|"HTTPS POST (VAPID), timeout 5 s per subscription"| push
```

Arrows show the direction of the call. The background worker is not called
by Confirm. It is drawn because it writes the same row concurrently (A3);
its own notify/persistence calls are left out for brevity.

Block contents:

- **Reservation API**: `api/reservations.py` — `confirm_reservation`, `_get_owned_reservation`
- **Auth**: `deps.get_current_user`, `security.decode_access_token`
- **Reservation lifecycle**: `lifecycle.py` — `transition`, `_check_guards`, `ALLOWED_TRANSITIONS`
- **Approval service**: `approval_service.py` — `submit_for_approval`, `approval_deadline`, `notify_approval_requested`
- **Notification integration**: `notifications.py` — `notify`, `_send_web_push`
- **Persistence / domain model**: `models/reservation.py` (`Reservation`, `ReservationStatus`, the exclusion constraint), `models/court.py`, `models/reservation_event.py`, `models/notification.py`, `models/push_subscription.py`, `db.py`, `deps.get_db`
- **Background worker**: `worker.py` — `_expire_stale_holds`, `tick`

### A8. Question for the next part of C03

| Item | Content |
|---|---|
| Question | **Should sending notifications (especially external Web Push) stay inside the transaction that holds the reservation's row lock, or move after commit (e.g. an outbox processed asynchronously)?** |
| Evidence | `confirm_reservation()` takes `SELECT … FOR UPDATE` (`api/reservations.py:423`) and calls `notify()` → `_send_web_push()` **before** `db.commit()` (`:466-474`). `webpush()` is a synchronous HTTPS call with `timeout=5` per subscription (`notifications.py:42`). On an approval court the loop runs over every manager and admin and each of their subscriptions (`approval_service.py:41-52`). **Runtime probe (2026-10-05, temporary test, not committed):** with `webpush` replaced by a function that queries the database from a second session during the push, the second session's `SELECT … FOR UPDATE` failed with `LockNotAvailable`, and the committed status it saw was still `PENDING`. The API then returned `200 CONFIRMED`. The hold-expiry worker follows the same pattern: it calls `notify()` while holding the row lock (`worker.py:50-56`). So the push "Reservation confirmed" goes out while the change is uncommitted and the row is locked. |
| Why it matters | **REQ-07 / AD-3:** every competing writer on that row (Cancel, Approve, Reject, the expiry worker) waits up to *n × 5 s* for external endpoints. The worker uses `SKIP LOCKED`, so a slow push silently delays the BR-06/BR-12 sweep. **Consistency:** if the commit fails (D-08's 409 backstop, or a connection error), the user has already received a push about a state change that never happened. `notifications.py:17-24` calls this "theoretical", but Confirm does fallible work (`db.commit()`) after `notify()`. **AD-5:** there is no retry or delivery guarantee for the person who has to act on an approval. This decides where the notification boundary sits in the target architecture. |
