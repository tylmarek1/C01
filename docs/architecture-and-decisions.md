# Architecture and Decisions

## Overview

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
