# Backend — Sports Court Reservations API

FastAPI + SQLAlchemy 2 + PostgreSQL 16 service for the reservation system.
See the [repository root README](../README.md) for the full project overview,
domain model and team info.

## Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/) (installs Python 3.12 automatically)
- Docker with Compose (for PostgreSQL — run from the repo root)

## Run

```bash
cp .env.example .env             # optional: the app falls back to the same defaults
docker compose up -d --wait db   # from the repo root — starts PostgreSQL on localhost:5432
uv sync                          # create .venv and install dependencies
uv run python -m reservations.seed   # optional: insert a few demo courts
uv run fastapi dev src/reservations/main.py   # API at http://localhost:8000 (docs: /docs)
curl localhost:8000/health       # -> {"status":"ok"}
```

## Tests

```bash
uv run pytest -v   # runs against the real PostgreSQL started above
```

The test suite drops and recreates the whole schema against `DATABASE_URL`
once per run (see `tests/conftest.py`) — it uses the same database as local
dev, not a separate test DB. Running the tests wipes any seeded courts;
re-run `uv run python -m reservations.seed` afterwards if the frontend needs
data again.

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://reservations:reservations@localhost:5432/reservations` | SQLAlchemy connection string |
| `SECRET_KEY` | insecure dev fallback | Signs JWT access tokens — set a real value outside local dev |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT access token lifetime |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (the Vite dev server) |

## API overview

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /health` | — | Liveness check |
| `POST /auth/register` | — | Create a `PLAYER` account, returns a JWT |
| `POST /auth/login` | — | Exchange email/password for a JWT |
| `GET /auth/me` | Bearer | Current user |
| `GET /courts` | — | List active courts |
| `GET /courts/{id}/availability/check?start_time=&end_time=` | — | Is the court free for exactly this interval? `{available, reason}` — reason `RESERVATION_OVERLAP` or `FACILITY_BLOCK` |
| `POST /reservations` | Bearer | Create a `PENDING` reservation — a 5-minute hold that already blocks the court (validates the 60/90/120 min slot rule, `:00`/`:30` alignment, 07:00–22:00 opening hours, booking window, limits; 409 if the slot is held/booked) |
| `GET /reservations` | Bearer | List the current user's reservations |
| `POST /reservations/{id}/confirm` | Bearer | `PENDING` → `CONFIRMED`; on a court with `requires_approval` → `PENDING_APPROVAL` instead (409 if the hold expired or the court was deactivated) |
| `POST /reservations/{id}/approve` | Venue manager | `PENDING_APPROVAL` → `CONFIRMED` |
| `POST /reservations/{id}/reject` | Venue manager | `PENDING_APPROVAL` → `REJECTED`, releases the slot |
| `POST /reservations/{id}/cancel` | Bearer | `PENDING`/`PENDING_APPROVAL`/`CONFIRMED` → `CANCELLED`, only before the start time (409 otherwise) |

That's the core reservation lifecycle. The API has grown well past it:
check-in/check-out, reschedule, guests/cost-split, join requests and
calendar export are more endpoints on this same `reservations` router;
achievements/leaderboard live in `stats.py`; and `favorites`,
`facility_blocks`, `notifications`, `reviews`, `waitlist`, and the
venue-manager `admin` endpoints (stats, user roles, reservation export,
court utilization) each have their own router under `src/reservations/api/`
(see Layout below). Rather than hand-duplicating a table that goes stale
the next time an endpoint is added, browse the live, always-current
reference: run the server and open `/docs` (Swagger UI) or `/openapi.json`.

The behaviour behind the reservation endpoints — rules, states, rejection
outcomes — is specified in [`docs/specification.md`](../docs/specification.md).

Passwords are hashed with `bcrypt`; access tokens are `HS256` JWTs carrying the
user id as `sub`. The common no-overlap rule is enforced by a PostgreSQL
exclusion constraint (see `src/reservations/models/reservation.py`), not
application code — see [`docs/architecture-and-decisions.md`](../docs/architecture-and-decisions.md).

## Layout

```
src/reservations/
  main.py         FastAPI app, CORS, router registration
  config.py       env-based settings
  db.py           engine/session factory, schema create/drop
  security.py     password hashing + JWT
  deps.py         DB session & current-user dependencies
  seed.py         demo data seeding script
  lifecycle.py    the reservation state machine
  rules.py, booking_validation.py            booking business rules
  achievements.py, approval_service.py, calendar_export.py,
  waitlist_service.py, notifications.py, images.py   feature-specific
                  service modules — the real logic; routers stay thin
  worker.py       in-process background tasks (hold-expiry, reminders, ...)
  models/         one SQLAlchemy model per file
  schemas/        Pydantic request/response models, mirroring models/
  api/            one APIRouter per resource
tests/            pytest suite (runs against the real database)
```

For the current, exact list of models/routers/service modules — this
README intentionally doesn't duplicate it, see `backend/CLAUDE.md`'s
"Module layout" section instead.
