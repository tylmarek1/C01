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
| `POST /reservations` | Bearer | Create a `DRAFT` reservation (validates the 60/90/120 min slot rule, `:00`/`:30` alignment, 07:00–22:00 opening hours) |
| `GET /reservations` | Bearer | List the current user's reservations |
| `POST /reservations/{id}/confirm` | Bearer | `DRAFT` → `CONFIRMED` (409 if the slot was just taken) |
| `POST /reservations/{id}/cancel` | Bearer | → `CANCELLED` |

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
  seed.py         demo court seeding script
  models/         SQLAlchemy models (court, user, reservation)
  schemas/        Pydantic request/response models
  api/            FastAPI routers (auth, courts, reservations)
tests/            pytest suite (runs against the real database)
```
