# Codebase Map

A navigation aid — where things live and what owns them, so a session can
orient in a minute instead of grepping cold. It deliberately does **not**
restate business rules, narrate history, or document every file/function;
source is still ground truth for exact behavior (root `CLAUDE.md` §0).
Complements, without overlapping:

- **`CLAUDE.md`** (root/`backend`/`frontend`) — *how* to work here: process,
  convention, git workflow.
- **`docs/architecture-and-decisions.md`** — *why* the key architectural
  decisions were made (ADRs).
- **`docs/specification.md`** / **`docs/intent-and-change.md`** — *what*
  the system's business rules and domain are.
- **`docs/course/`** — what the course requires.
- **`README.md`** — the project's public-facing introduction.

## High-level architecture

```
React SPA (frontend/) ──fetch, JWT bearer──► FastAPI (backend/src/reservations/main.py)
                                                 │  api/*.py — one thin router per resource
                                                 ▼
                                              lifecycle.py / rules.py / booking_validation.py
                                              achievements.py / waitlist_service.py / worker.py
                                                 │  (business logic lives here, not in routers)
                                                 ▼
                                              SQLAlchemy models/ ──► PostgreSQL 16 (docker-compose)

React SPA (frontend/lib/chat-socket.ts) ──WebSocket──► FastAPI (api/chat.py's /ws/chat)
                                                 │  a second, parallel delivery path alongside the
                                                 ▼  request/response one above — see chat_hub.py below
                                              chat_hub.py's in-process connection registry
```

Two independent toolchains — `uv` for backend, `npm` for frontend — never
mixed (ADR-002).

## Backend (`backend/src/reservations/`)

| Path | Responsible for |
|---|---|
| `main.py` | FastAPI app, CORS, router registration |
| `api/*.py` | One thin `APIRouter` per resource — booking domain: `auth`, `courts`, `reservations`, `admin`, `facility_blocks`, `favorites`, `notifications`, `reviews`, `stats`, `waitlist`, `push`; community domain (see below): `social`, `chat`, `teams`, `ratings`, `challenges`, `activity`. Parse/validate, call a service module, return a schema — real logic doesn't live here. |
| `lifecycle.py` | The reservation state machine — the *only* place a reservation's status should change |
| `rules.py`, `booking_validation.py` | Booking business rules (lead time, slot length/alignment, opening hours, per-user limits) |
| `achievements.py`, `approval_service.py`, `calendar_export.py`, `waitlist_service.py`, `notifications.py`, `images.py`, `rate_limit.py` | One feature-specific service module per concern — the real logic behind each booking-domain feature |
| `chat.py`, `chat_hub.py`, `ratings.py`, `challenges.py`, `activity.py` | The "Courtly Communities" social layer's service modules: `chat.py` owns Conversation/participant persistence (DM/reservation/team chat all share it); `chat_hub.py` is the in-process `dict[user_id, set[WebSocket]]` live-delivery registry for `/ws/chat` — same single-process tradeoff already accepted by `rate_limit.py`/`worker.py`, not built to survive a multi-process deployment; `ratings.py` is the Elo update; `challenges.py` mirrors `achievements.py`'s compute-fresh/store-the-marker shape but time-boxed; `activity.py`'s `emit_activity()` is called from across several of the above (and from `achievements.py`/`reservations.py`) to populate the activity feed at the point of action |
| `worker.py` | In-process background tasks (hold expiry, reminders, auto-complete, waitlist cascade) |
| `models/` | One SQLAlchemy model per file. Booking domain: `Court`, `CourtImage`, `User`, `Reservation`, `ReservationEvent`, `ReservationGuest`, `ReservationSeries`, `Favorite`, `Review`, `ReviewImage`, `ReviewVote`, `ReviewComment`, `Notification`, `PushSubscription`, `FacilityBlock`, `Waitlist`, `Achievement`, `JoinRequest`. Community domain: `PlayerFollow`, `Conversation`, `ConversationParticipant`, `Message`, `Team`, `TeamMember`, `SkillRating`, `MatchResult`, `Challenge`, `ChallengeCompletion`, `ActivityEvent` |
| `schemas/` | Pydantic request/response models, mirroring `models/` roughly 1:1 |
| `deps.py`, `security.py` | Current-user/DB-session dependencies; password hashing + JWT |
| `db.py` | Engine/session factory, schema create/drop (**no Alembic** — see `backend/CLAUDE.md`) |
| `seed.py` | Idempotent demo-data seeder — booking domain only; the community-domain tables above start empty for every fresh seed (no demo teams/chats/challenges/follows) |

The no-double-booking guarantee lives in `models/reservation.py`'s
PostgreSQL exclusion constraint, not in application code (ADR-001) — see
`backend/CLAUDE.md`'s "Concurrency correctness" section before touching it.

## Frontend (`frontend/src/`)

| Path | Responsible for |
|---|---|
| `components/shared/` | The single reuse layer — shadcn-style primitives (button, card, dialog, select, tabs, ...) and composite components (navbar, footer, court-card, reservation-card, week-calendar, confirm-dialog, error-state, ...). Pages are built *from* this, not with one-off markup. |
| `pages/{landing,auth,app,courts}/` | Page-level composition per area; `app/` is behind `ProtectedRoute` |
| `pages/` (top level) | `AboutPage`, `ContactPage`, `HelpPage`, `NotFoundPage` — standalone pages that don't belong to one of the areas above |
| `lib/api.ts` | The only fetch wrapper — throws `ApiError`; never call raw `fetch()` from a component |
| `lib/chat-socket.ts` | The one WebSocket client — a module-level singleton connection, opened/closed by `auth-context.tsx` alongside the JWT session; not per-component |
| `lib/auth-context.tsx` | `AuthProvider`/`useAuth` — JWT held client-side |
| `lib/i18n.tsx` | `t()` + the EN/CS language switcher |
| `locales/en.ts` / `cs.ts` | `en.ts` defines `TranslationKey`; `cs.ts` is typed against it, so a *missing* translation is a compile error — a hardcoded string that never became a key is not (see `i18n-check`) |
| `types/` | Hand-maintained TypeScript mirror of the backend's Pydantic schemas — **no codegen**, so a backend shape change doesn't automatically surface here (see `schema-change-sweep`) |

The "navy ink on cool marble" design system (`index.css`'s CSS variables,
consumed via Tailwind's `@theme inline`) is a single, deliberate source of
tokens — never a hardcoded color in a component (see `component-design`).

## Conventions easy to miss

- **Routers stay thin.** Business logic belongs in a service module
  (`lifecycle.py`, `rules.py`, a feature-specific module), not inline in an
  `api/*.py` handler.
- **A business rule enforced only in the frontend doesn't count.** The
  backend is the only enforcement that matters; a frontend check is a UX
  nicety, not a substitute (root `CLAUDE.md`'s known-pitfall #3).
- **Frontend types and the design system are both hand-maintained**, not
  generated — see the two rows above.
- **`ConfirmDialog`** (`components/shared/confirm-dialog.tsx`) is the one
  destructive-action confirmation primitive, already wired into cancel/
  remove/delete flows across the app — reuse it rather than inventing a
  second one.
- Deeper traps that have actually caused a bug here (timezone comparisons,
  the exclusion constraint's status list, `create_all` not altering
  existing tables) are tracked in root `CLAUDE.md`'s "Known pitfalls" —
  not repeated here.

## Keeping this current

A **living document**: update it only when a change makes a line above
inaccurate, or introduces a genuinely new subsystem/boundary worth knowing
at a glance. Don't touch it for a bug fix, a new endpoint on an existing
router, a new page inside an existing area, or anything that doesn't shift
*where* responsibility lives. Prefer a small, targeted edit over a rewrite,
and never let this accumulate history — that belongs in
`docs/evidence-and-evolution.md` or commit messages, not here. See
`update-docs` for the trigger, and `architecture-review`/`refactoring` for
when a change is structural enough to warrant one.
