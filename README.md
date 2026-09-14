# Sports Court Reservations

A reservation system for a sports venue: players book tennis, volleyball and
badminton courts, the venue avoids double bookings, and both sides get a
reliable schedule.

Built for course **SWI**, engineering spike **C01** — see
[`docs/intent-and-change.md`](docs/intent-and-change.md) for the full domain
scope (Project Frame) and [`docs/evidence-and-evolution.md`](docs/evidence-and-evolution.md)
for the executed spike.

## Team — VTG Courts

| Role | Member |
|---|---|
| Member | Adam Vrána |
| Member | Marek Tyl |
| Member | Josef Glogar |

- **Repository:** https://github.com/tylmarek1/C01
- **Main branch:** `main` (work via feature branches + reviewed PRs)

## Domain at a glance

| Concept | In this system |
|---|---|
| **Resource** | `Court` — sport type (TENNIS / VOLLEYBALL / BADMINTON), indoor/outdoor, active flag |
| **Reservation** | one court, one user, one time slot `[start_time, end_time)`, timestamptz |
| **User** | `Player` (books/confirms/cancels own reservations) or `Venue manager` (manages courts, can cancel any reservation) |
| **States** | `DRAFT → CONFIRMED`, `DRAFT/CONFIRMED → CANCELLED` (`CANCELLED` is final) |
| **Operations** | create · confirm/approve · cancel · check availability |
| **Common rule** | two `CONFIRMED` reservations of the same court must never overlap |
| **Domain-specific rule** | a reservation must be 60/90/120 minutes, start on `:00`/`:30`, and lie fully within opening hours 07:00–22:00 |
| **External boundary** | Notification Service — e-mails the player on confirm/cancel (stub for now) |

Full rationale, assumptions, open unknowns and the selected future pressure
(**Q — quality/scale**, 10× concurrent confirmations on popular slots) are in
[`docs/intent-and-change.md`](docs/intent-and-change.md).

## Stack

Python 3.12 · FastAPI · SQLAlchemy 2 · psycopg 3 · PostgreSQL 16 · pytest ·
[uv](https://docs.astral.sh/uv/) · Docker Compose

> The course example stack is Java/Spring; the assignment allows any stack as
> long as the team supports it and justifies the choice. We picked
> Python/FastAPI because the team is fastest in it, and PostgreSQL because
> its exclusion constraints let the database itself guarantee the common
> overlap rule under concurrency instead of relying on application-level
> locking (see ADR-000/ADR-001 in
> [`docs/architecture-and-decisions.md`](docs/architecture-and-decisions.md)).

## Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/) (installs Python 3.12 automatically)
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
cviko1/                             running C01 checklist / working notes
```

## CP1 walking skeleton

One end-to-end path that must be runnable after C03 (before C04). Not
implemented yet — this is the target for the next iterations:

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

## Engineering spike (C01)

**Variant A — Persistence.** Reservations were saved to and loaded back from
a real PostgreSQL 16 database, including a round trip test and a concurrency
test (10 threads confirming the same slot at once: 1 succeeded, 9 rejected by
a PostgreSQL exclusion constraint — no application-level locking needed).
Full question / method / result / decision write-up:
[`docs/evidence-and-evolution.md`](docs/evidence-and-evolution.md).

## Review cycle (C01)

The reviewed change is the whole C01 engineering spike (models, persistence
tests, evidence, ADR-001), integrated from `c01-spike` into `main`:

| Step | Who | Where |
|---|---|---|
| Task | team | issue [#4 — "C01 engineering spike — review a integrace do main"](https://github.com/tylmarek1/C01/issues/4) (original task: [#1](https://github.com/tylmarek1/C01/issues/1)) |
| Change | Marek Tyl (spike code + docs), Adam Vrána (README/team info, PRs [#2](https://github.com/tylmarek1/C01/pull/2), [#3](https://github.com/tylmarek1/C01/pull/3) into `c01-spike`) | branch `c01-spike` |
| Review before integration | **Josef Glogar** (not an author of the change) | pull request [#5](https://github.com/tylmarek1/C01/pull/5) `c01-spike → main` — **approved** 2026-09-14 10:18 |
| Integration | Josef Glogar, after approval | PR #5 **merged** into `main` 2026-09-14 10:19, issue #4 closed |

## Definition of Done — status

- [x] Team of 3–4 students
- [x] Shared repository
- [x] Clear reservation domain (sports courts)
- [x] Resource + Reservation + User modelled
- [x] Meaningful reservation states (DRAFT / CONFIRMED / CANCELLED)
- [x] Core operations defined: create, confirm/approve, cancel, check availability
- [x] Common overlap rule (enforced in PostgreSQL, verified under concurrency)
- [x] 1 domain-specific business rule (slot length/alignment/opening hours)
- [x] 1 external/system boundary (Notification Service)
- [x] Complete Project Frame
- [x] 1 selected future pressure (Q) with rationale
- [x] 1 reviewed and integrated change — PR [#5](https://github.com/tylmarek1/C01/pull/5) `c01-spike → main` approved by Josef Glogar, then merged
- [x] 1 executed engineering spike (A — Persistence)
- [x] Spike evidence + decision recorded
- [x] CP1 walking skeleton defined

All 15 items must be true before C02 starts.
