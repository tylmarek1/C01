# Engineering Capability Map

A strategic map of Courtly's engineering maturity — what's strong,
adequate, weak, or missing across product, backend, frontend, security,
testing, and the `.claude/` engineering system itself. It exists so
"how are we doing, where should we invest next" compounds across sessions
instead of resetting to zero every time someone asks.

**This is not a fourth copy of anything.** It doesn't restate root
`CLAUDE.md`'s "Known pitfalls"/"Known gaps," `docs/project-state.md`'s
gates, or `docs/codebase-map.md`'s module ownership — it points at them.
It sits outside root `CLAUDE.md` §0's source-of-truth numbering the same
way `docs/codebase-map.md` does: not a requirements source, a navigation
and strategy aid. It is not exhaustive — a capability doesn't earn a row
here just because it exists, only ones worth tracking status on.

## How this gets updated

- `improve-app` Mode A (a full audit) updates the relevant rows below as
  part of its own Report step — see that skill.
- `feature-development` Step 7's "Valuable, but separate" / "Future idea"
  findings get one line added to the Backlog below, tagged by domain — see
  that skill's Step 7.
- Don't update this for routine feature/bugfix work that doesn't change a
  status or surface a new finding — same bar as `codebase-map.md`'s own
  "Keeping this current."
- A closed Backlog line moves to "Recently closed," and gets deleted once
  it's no longer useful context — this file describes current strategic
  state, not a permanent changelog. `CHANGELOG.md`/git history is the
  actual historical record.

## Status legend

**Strong** — solid, evidence-backed, no known gap worth tracking.
**Adequate** — works, has a known limitation that isn't urgent.
**Weak** — a real, current gap with some mitigation or low current impact.
**Missing** — doesn't exist at all.

---

## Security

| Capability | Status | Evidence | Last reviewed |
|---|---|---|---|
| Authentication (JWT + bcrypt) | Strong | ADR-003, `security.py`, `security-review` | 2026-09-22 |
| Authorization (ownership/role checks) | Strong | Three clean dependency tiers (`get_current_user`/`_manager`/`_admin`); no missing ownership check found in an `auth.py`/`deps.py` audit | 2026-09-22 |
| Auth abuse-resistance (brute-force/rate-limit) | Adequate | In-memory per-process throttle on `/auth/login` (per-email, 10/5min, resets on success) and `/auth/register` (per-IP, 10/hr) — `rate_limit.py`, tested in `test_auth.py`. Adequate not Strong: single-process only, no shared store if ever scaled | 2026-09-22 |
| Input validation / injection | Strong | Pydantic + ORM-first, `security-review` | 2026-09-22 |
| File upload handling | Strong | Server-generated filenames; decode+re-encode defeats polyglot files. Explicit 50MP pixel-dimension cap now asserted before decode (`images.py`), not just inherited from Pillow's default — tested | 2026-09-22 |
| Dependency/supply-chain audit | Adequate | Baseline run 2026-09-22: `uvx pip-audit` (backend) and `npm audit` (frontend) both clean, 0 known vulnerabilities. `security-review` now has a recurring check step; still no CI automation of it | 2026-09-22 |
| Account recovery (password reset) | **Missing** | No `/auth/forgot-password`; needs an email-delivery decision first | 2026-09-22 |
| Secrets handling | Strong | `security-review`, ADR-003's documented dev fallback | 2026-09-22 |

## Testing & quality

| Capability | Status | Evidence | Last reviewed |
|---|---|---|---|
| Backend test coverage | Strong | 177 tests against real Postgres. Feature areas without an identically-named test file (`achievements.py`, `approval_service.py`, `waitlist_service.py`, `images.py`) are well-exercised indirectly — verified, not a gap | 2026-09-22 |
| Concurrency/regression testing | Strong | `test_persistence_spike.py` pattern, timezone regression test | 2026-09-22 |
| Frontend automated testing | **Missing** (deliberate) | `accessibility-responsive`'s manual checklist is the current substitute; documented and monitored, not silently accepted | 2026-09-22 |
| Schema-change safety net | Adequate | No Alembic, no codegen — `schema-change-sweep`'s grep-based sweep mitigates, doesn't automate | 2026-09-22 |

## Backend / architecture

| Capability | Status | Evidence | Last reviewed |
|---|---|---|---|
| Reservation state machine | Strong | Exhaustive `ALLOWED_TRANSITIONS`, centralized guards. Concurrency safety is an API-layer convention (`lock=True` at call sites) — verified every call site follows it (`api/reservations.py`, `approval_service.py`, `facility_blocks.py`, `worker.py`), and `transition()`'s docstring now states the contract explicitly so a new call site can't miss it by accident | 2026-09-22 |
| Double-booking guarantee | Strong | ADR-001, Postgres exclusion constraint, regression-tested | 2026-09-22 |
| Background worker reliability | Strong | Each of the 5 housekeeping sub-tasks now runs in its own session/transaction (`worker.py`'s `_SUB_TASKS` loop) — one failing task is logged and skipped, the other 4 still commit. All 5 now consistently use `with_for_update(skip_locked=True)`. Regression-tested (`test_worker_tick_survives_one_failing_sub_task`) | 2026-09-22 |
| API pagination | **Missing** | Every list endpoint is a full-table read — no `limit`/`offset` anywhere | 2026-09-22 |
| Observability / logging | Adequate | A global FastAPI exception handler (`main.py`) now logs any unhandled (non-`HTTPException`) exception with request context before returning a generic 500 — the minimal level `production-readiness` calls for, still deliberately not a platform. Tested (`test_error_handling.py`) | 2026-09-22 |
| Migrations | **Missing** (deliberate) | No Alembic — known, documented gap (root `CLAUDE.md`) | 2026-09-22 |
| CI/CD | **Missing** (deliberate) | Known, documented gap | 2026-09-22 |

## Frontend / UX

| Capability | Status | Evidence | Last reviewed |
|---|---|---|---|
| Court discovery/search | Strong | Debounced URL-synced search, sport tabs, amenity filters | 2026-09-22 |
| Booking-flow error recovery | Strong | Form state preserved on failed mutation; one-click waitlist-join offered on a booking conflict | 2026-09-22 |
| Admin reporting/export | Strong | Overview's "reservations in window" stat now has a 7/30/90-day selector (`/admin/stats?days=`); CSV export now respects the current status filter instead of silently ignoring it (a real bug found while touching this) | 2026-09-22 |
| Mobile responsiveness (general) | Strong | `accessibility-responsive` checklist, whole-app polish pass (PR #19) | 2026-09-22 |
| Mobile responsiveness (`week-calendar.tsx`) | Strong | Below `sm`, shows one day at a time (tappable day-chip strip) instead of a horizontally-scrolled 7-column grid — desktop/tablet unchanged. Verified in a real browser at 375px and 1280px (Playwright, no horizontal overflow, day-switching and "Today" reset both correct) | 2026-09-22 |
| Notification UX | Adequate | Mark-all-read exists; no per-type mute/preferences (low urgency at current volume) | 2026-09-22 |

## Product capabilities

| Capability | Status | Evidence | Last reviewed |
|---|---|---|---|
| Core booking/approval/waitlist flow | Strong | C02 spec, 177 backend tests | 2026-09-22 |
| Onboarding (new player) | Strong | Real empty state + CTA on a zero-reservation dashboard | 2026-09-22 |
| Onboarding (new venue manager) | **Weak** | No confirmed guided setup for a zero-court manager; low severity since accounts are admin-provisioned | 2026-09-22 |
| Account recovery | **Missing** | Cross-ref Security | 2026-09-22 |

## Engineering system (`.claude/`)

| Capability | Status | Evidence | Last reviewed |
|---|---|---|---|
| Risk-proportional review | Strong | `CLAUDE.md`'s "Review depth matches risk" table, `self-review`/`finish-task`/`improve-app` | 2026-09-22 |
| Schema/type drift protection | Adequate | `schema-change-sweep` (mechanical grep, not a type system) | 2026-09-22 |
| Continuous capability tracking | Strong (as of this file) | This file, plus `improve-app`/`feature-development` write-back | 2026-09-22 |
| Adversarial/forced-finding review | Adequate | Added to `self-review` for High-risk changes — technique adapted from the external `adversarial-reviewer` skill, not imported wholesale | 2026-09-22 |

---

## Backlog

Format: `[Priority] Finding — Mechanism`. Priority is High/Med/Low, matching
`improve-app`'s existing vocabulary — not a new scheme.

### Security / reliability
- **[Med]** No password-reset flow — needs an email-delivery decision first; a product decision, not silent scaffolding. **Not implementing autonomously** — needs the team to pick an email provider.

### Backend / architecture
- **[Med]** No pagination anywhere (`/reservations`, `/admin/reservations`, `/admin/users`, `/courts`) — full-stack feature; not urgent at current data scale.

### Product / UX
- **[Low]** No notification mute/preferences — defer until volume actually justifies it.
- **[Low]** No guided setup for a freshly-promoted manager with zero courts — small UI addition.
- **[Low]** Keyboard-only completability of the booking flow was inferred from source, never actually walked in a browser — a 10-minute manual verification.

## Recently closed

- Auth rate-limiting on `/auth/login`/`/auth/register` — `rate_limit.py`, PR merging `security/auth-rate-limit`.
- Worker reliability: per-subtask transaction isolation + consistent row-locking — `worker.py`, PR merging `reliability/worker-tick-isolation`.
- Dependency-audit baseline run (`pip-audit`/`npm audit`, both clean), `images.py` pixel-dimension cap, `transition()`'s locking contract documented, unhandled-exception logging hook — one PR, `backend/architecture` hardening batch.
- Reservation reschedule validation: verified `ReservationReschedule` already shares `validate_slot_shape()` with `ReservationCreate` (`schemas/reservation.py`) — not a drifted copy, no fix needed. Closing without a code change.
- Mobile `week-calendar.tsx` — single-day view below `sm`, PR merging `polish/mobile-week-calendar`.
- Admin stats 7/30/90-day window selector + CSV export status-filter bug fix, PR merging `feat/admin-stats-window-and-csv-filter`.

## Rejected (external skills evaluated, 2026-09-22)

Source: `github.com/alirezarezvani/claude-skills`, `engineering-team/skills/`
(27 skills). Full reasoning lives in the session that did this audit;
verdicts only here, so the question doesn't get relitigated from scratch.

- **SKIP** — `code-reviewer`, `security-pen-testing` (as a whole),
  `senior-backend`, `senior-frontend`, `senior-fullstack`, `senior-devops`,
  `named-persona-adversarial-review`, `engineering-skills` (meta index):
  either high overlap with what Courtly already has more concretely
  grounded, or built for a different scale/stack entirely (multi-tenant
  SaaS with a chosen cloud target and its own agent framework; one
  skill's "FastAPI" profile turned out to reference entirely Node.js/
  Express code when actually opened).
- **Absorbed as a technique, not imported** — `adversarial-reviewer`'s
  forced multi-persona review (mandatory-finding rule) is now part of
  `self-review`'s High-risk-change path instead of a separate skill.
- **SKIP, confirmed out of domain by description** — the remaining ~17
  (`ai-security`, the AWS/Azure/GCP cloud-architect skills, `cloud-security`,
  `senior-data-engineer`, `senior-data-scientist`, `senior-ml-engineer`,
  `senior-prompt-engineer`, `senior-computer-vision`, `incident-commander`,
  `incident-response`, `red-team`, `ms365-tenant-manager`,
  `embedded-iot-mentor`, `email-template-builder`, `epic-design`): no LLM
  features, no chosen cloud target, no IoT/data/ML surface, and no
  on-call process exist in Courtly.

## Future exploration

- `senior-architect`'s `dependency_analyzer.py` (external repo) — a real
  code-parsing tool (cyclic-dependency detection), language-generic.
  Worth a look once C03 (architecture phase) actually starts, not before.
