# Sports Court Reservations

Reservation system for a sports venue: players book tennis, volleyball and badminton courts.

## Team

- **Team name:** VTG Courts
- **Members:** Adam Vrána, Marek Tyl, Josef Glogar
- **Repository:** https://github.com/tylmarek1/C01

## Stack

Python 3.12 · FastAPI · SQLAlchemy 2 · psycopg 3 · PostgreSQL 16 · pytest · [uv](https://docs.astral.sh/uv/) · Docker Compose

> The course-supported stack is Java/Spring. This team chose Python/FastAPI and supports it itself.

## Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/) (it installs Python 3.12 automatically)
- Docker with Compose (for PostgreSQL)

## Run

```bash
cp .env.example .env              # optional: tests/app fall back to the same default URL
docker compose up -d --wait db    # start PostgreSQL on localhost:5432
uv sync                           # create .venv and install dependencies
uv run pytest -v                  # run tests against the real database
uv run fastapi dev src/reservations/main.py   # API at http://localhost:8000 (docs: /docs)
curl localhost:8000/health        # -> {"status":"ok"}
```

Stop the database with `docker compose down` (add `-v` to wipe its data).

## Repository layout

```
docs/intent-and-change.md           Project Frame + selected future pressure
docs/architecture-and-decisions.md  architecture overview + decision records
docs/evidence-and-evolution.md      spike evidence and decisions
src/reservations/                   application code
tests/                              automated checks
```

## CP1 walking skeleton

One end-to-end path that must be runnable after C03 (before C04):

```
POST /reservations  {court_id, user_id, start_time, end_time}
→ validate   Pydantic schema (types, end > start) + domain slot rule
             (60/90/120 min, starts at :00 or :30, within 07:00–22:00)
→ persist    INSERT reservation with status DRAFT into PostgreSQL
→ return     201 Created {"id": "<uuid>", "status": "DRAFT"}; 422 on invalid input
→ automated check
             pytest + httpx TestClient against the real PostgreSQL:
             valid request → 201 + row with that id exists in DB;
             slot-rule violation → 422 + no row inserted
```
