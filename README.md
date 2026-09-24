# Courtly — Sports Court Reservations

A reservation system for a sports venue: players book tennis, volleyball
and badminton courts online, the venue never double-books a court, and
both sides always see the same, accurate schedule.

<p align="center">
  <img src="docs/screenshots/landing.png" alt="Courtly landing page" width="49%" />
  <img src="docs/screenshots/dashboard.png" alt="Courtly dashboard with a draft reservation" width="49%" />
</p>

- **Repository:** https://github.com/tylmarek1/C01
- **Run it locally:** see [Run](#run) below.

## What it does

Players sign up, browse courts by sport and amenity, check live
availability, and book a slot in seconds — no phone calls, no shared
spreadsheets. A new booking is held for 5 minutes while the player
confirms it; on courts a venue manager has marked as requiring approval,
confirming submits a request instead, which the manager approves or
rejects. The database itself — not application code — guarantees two
players can never end up holding the same slot, even under heavy
concurrent demand (see [Architecture & decisions](#architecture--decisions)).

### For players

- Browse, search and filter courts by sport and amenity; check live
  occupancy and reviews before booking.
- Book a 60/90/120-minute slot, with a 5-minute hold before confirming
  (or an approval step on courts that require it).
- Recurring weekly bookings, rescheduling, and cancellation any time
  before the slot starts.
- A waitlist that automatically offers a slot to the next person in line
  when it frees up.
- Social features: invite guests, open a booking to other players and
  accept join requests, split the cost with everyone attending.
- Favorites, reviews (with photos and comments), achievements, seasonal
  challenges, skill ratings and a leaderboard, and personal stats.
- A public player profile with a follow feature, real-time chat (direct
  messages, plus a group chat for each reservation and each persistent
  team/club you're in), and an activity feed of what players you follow
  are up to.
- A personal calendar feed (Google/Apple/Outlook) and in-app
  notifications, including browser push.
- A built-in Help Center (getting-started guide, a plain-language
  reservation-status glossary, FAQ), a full English/Czech UI, and a
  light/dark theme.

### For venue managers

- Manage courts: create/edit, set hourly pricing and amenities, upload a
  photo, and flag a court as requiring approval.
- An approval queue for requests on approval-required courts.
- Block a court for maintenance — any booking that overlaps the window is
  cancelled automatically.
- Oversee every reservation: confirm, cancel, check in, view its history,
  export the lot to CSV.
- An analytics dashboard: status breakdown, busiest hours, top courts,
  per-court utilization, no-show rate.
- Run a seasonal challenge (e.g. "play 10 sessions this autumn") for
  players to complete.
- Promote or demote player accounts to venue manager.

### For admins

Everything a venue manager can do, plus:

- Grant or revoke anyone's role, including another admin's.
- Permanently delete a court that has no reservation history (deactivate
  is still the tool for retiring a court that's actually been used).

## Domain at a glance

| Concept | In this system |
|---|---|
| **Resource** | `Court` — sport type (TENNIS / VOLLEYBALL / BADMINTON), indoor/outdoor, active flag |
| **Reservation** | one court, one user, one time slot `[start_time, end_time)`, timestamptz |
| **User** | `Player` (books/confirms/cancels own reservations), `Venue manager` (manages courts, can act on any reservation), or `Admin` (everything a venue manager can, plus role management and permanently deleting a court) |
| **States** | `PENDING` (a 5-minute hold) `→ CONFIRMED`; on courts that require approval `PENDING → PENDING_APPROVAL → CONFIRMED / REJECTED`; `→ CANCELLED` before the start; unanswered holds/requests `→ EXPIRED`; then `CHECKED_IN → COMPLETED / NO_SHOW`. Full lifecycle: [`docs/specification.md`](docs/specification.md) |
| **Operations** | create · check availability · confirm · cancel · approve/reject (approval-required courts) |
| **Common rule** | two reservations that hold a court (`PENDING`, `PENDING_APPROVAL`, `CONFIRMED`, `CHECKED_IN`) must never overlap |
| **Domain-specific rule** | a reservation must be 60/90/120 minutes, start on `:00`/`:30`, and lie fully within opening hours 07:00–22:00 |
| **External boundary** | Notification Service — currently implemented as in-app notifications; e-mail delivery was the original plan and is not yet built |

Full rationale, assumptions, open unknowns and the domain's selected
future pressure are in [`docs/intent-and-change.md`](docs/intent-and-change.md).

## Architecture & decisions

**Backend:** Python 3.12 · FastAPI · SQLAlchemy 2 · psycopg 3 · PostgreSQL 16 ·
pytest · [uv](https://docs.astral.sh/uv/) · Docker Compose
**Frontend:** React 19 · TypeScript · Vite · Tailwind CSS 4 · shadcn-style
components · React Router · TanStack Query

Python/FastAPI was picked for team familiarity; PostgreSQL because its
exclusion constraints let the database itself guarantee the no-overlap
rule under concurrency, instead of relying on application-level locking
(ADR-000/ADR-001). The repository is split into [`backend/`](backend/) and
[`frontend/`](frontend/) (ADR-002) so each half's own toolchain — `uv` vs
`npm` — stays unambiguous, and auth is stateless JWT rather than
server-side sessions (ADR-003). Full rationale and every other decision:
[`docs/architecture-and-decisions.md`](docs/architecture-and-decisions.md).

There is no CI pipeline and no Alembic migrations yet — a backend schema
change needs a manual reseed (see `backend/CLAUDE.md`). Both are known,
deliberate gaps rather than oversights.

## Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/) (installs Python 3.12 automatically)
- Node.js 20+ and npm (for the frontend)
- Docker with Compose (for PostgreSQL)

## Run

```bash
docker compose up -d --wait db   # start PostgreSQL on localhost:5432 (from the repo root)

cd backend
cp .env.example .env             # optional: falls back to the same defaults
uv sync                          # create .venv and install dependencies
uv run pytest -v                 # run tests against the real database
uv run python -m reservations.seed        # insert a few demo courts
uv run fastapi dev src/reservations/main.py &   # API at http://localhost:8000 (docs: /docs)
curl localhost:8000/health       # -> {"status":"ok"}

cd ../frontend
npm install
npm run dev                      # app at http://localhost:5173
```

Stop the database with `docker compose down` (add `-v` to wipe its data). See
[`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md)
for configuration details, the full API reference and the frontend's design
system.

## Repository layout

```
backend/                            FastAPI application (see backend/README.md)
frontend/                           React application (see frontend/README.md)
docker-compose.yml                  shared PostgreSQL instance for both apps
docs/                                specification, architecture decisions, domain
                                     frame, project status, and the course-work
                                     history this project grew out of (see below)
docs/screenshots/                   README preview images
```

## Learn more

This README covers the project as it stands today; the fuller history —
original course assignments, specification revisions, decision records,
and executed evidence — lives in [`docs/`](docs/) rather than here:

- [`docs/specification.md`](docs/specification.md) — the full behavioral
  specification: every operation, business rule, state and edge case.
- [`docs/architecture-and-decisions.md`](docs/architecture-and-decisions.md)
  — the architecture decision records (ADR-000…004).
- [`docs/intent-and-change.md`](docs/intent-and-change.md) — the original
  domain frame (actors, concepts, rules).
- [`docs/project-state.md`](docs/project-state.md) — current project phase
  and status.
- [`docs/course/`](docs/course/) — the original course assignments,
  verbatim.

## Team

Courtly started as the **SWI** course's engineering-spike deliverable and
was then expanded by the team into a fuller product. Team **VTG Courts**:
Adam Vrána, Marek Tyl, Josef Glogar, Adam Mikoláš. Development happens on
feature branches merged into `main` via reviewed pull requests.
