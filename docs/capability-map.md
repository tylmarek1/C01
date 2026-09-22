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
| API pagination | Adequate | `GET /courts`, `/reservations`, `/reservations/admin`, `/admin/users` now take bounded `limit`/`offset` query params (defaults preserve today's response size, so no caller had to change) — closes the unbounded-read risk. Adequate not Strong: no frontend "load more"/page UI yet, deliberately — none of today's data volumes need it | 2026-09-22 |
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
| Notification UX | Strong | Mark-all-read, plus per-category mute preferences (`GET/PUT /notifications/preferences`, grouped into 7 user-facing categories on the profile page) — `notify()` now skips creating a row for a muted type. Web push (`PushSubscription`, `pywebpush`) now delivers the same notifications to the browser even when the tab is closed, gated by a toggle on the profile page and respecting the same per-category mutes. Delivery failure (dead subscription, push service unreachable) never breaks the request that triggered it — best-effort by design, verified via monkeypatched `pywebpush.webpush` in tests | 2026-09-22 |
| Keyboard-only completability (booking flow) | Strong | Actually walked end-to-end with a real browser and no mouse (Playwright: Tab-only navigation, Enter/ArrowDown on every `Select`, native date-input digit entry, final submit) — court card, date, duration, start time, repeat-weekly switch, and Reserve-slot button were all reachable and operable, error toast (advance-booking-window rejection) was clear, and a valid submission succeeded and appeared correctly on the dashboard. Found and fixed a real, systemic gap this surfaced: 5 `<Switch>` usages across 3 files had no accessible name for screen readers (a visible label sibling, never programmatically associated) — all 5 now have `aria-label` | 2026-09-22 |

## Product capabilities

| Capability | Status | Evidence | Last reviewed |
|---|---|---|---|
| Core booking/approval/waitlist flow | Strong | C02 spec, 177 backend tests | 2026-09-22 |
| Onboarding (new player) | Strong | Real empty state + CTA on a zero-reservation dashboard | 2026-09-22 |
| Onboarding (new venue manager) | Strong | Correction to the earlier framing: courts aren't per-manager here (`Court` has no owner/manager FK — any manager sees the whole shared venue catalog), so "a fresh manager sees zero courts" isn't really the scenario. The real gap was narrower but real: `CourtsTab` had no empty state at all (rendered nothing) for a genuinely empty catalog. Fixed with the existing `EmptyState` component + an "Add your first court" CTA, matching the pattern already used elsewhere on this page | 2026-09-22 |
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

### Product / UX
- **[Low]** The booking form's date `<input>` has a `min` (today) but no `max` — a date beyond the 14-day advance-booking window (`rules.py`'s `MAX_ADVANCE_DAYS`) can be picked and only gets rejected at submit time. The rejection toast is clear and correct, so this isn't broken, just later feedback than it could be. Found while verifying keyboard completability, not fixed since it's UX polish rather than a defect — a `max={todayPlusNDaysString()}` on the input would close it.

## Recently closed

- Activity feed — the 7th and final PR of the "Courtly Communities" plan.
  `ActivityEvent` (`user_id`, a plain-string `type` — deliberately not a
  Postgres enum, so a future event type is a pure code change, never
  another manual migration cycle — and a JSON `payload`), populated by
  `activity.emit_activity()` called at the point of action across six
  existing modules (`social.py` on follow, `teams.py` on joining,
  `ratings.py` on a match result — for both participants, `challenges.py`
  on completion, `achievements.py` on unlocking, `reservations.py` on
  opening a game to join) rather than the feed being assembled as a live
  union query across five differently-shaped tables at read time.
  `GET /activity/feed` returns events from users the caller follows,
  paginated with the same `limit`/`offset` convention as PR #33's other
  bounded list endpoints. New 4th tab on the dashboard's existing view-mode
  switcher (list/calendar/open/**feed**) — reuses the tab UI already
  there instead of a new nav item. New table only — no manual reseed
  cycle needed.
- Seasonal challenges — mirrors `achievements.py`'s exact shape (compute
  the metric fresh each call, store only the earned/completed marker via
  `ChallengeCompletion`), but a `Challenge` is admin/manager-authored via
  `POST /challenges` rather than hardcoded in code, so a manager can run a
  new seasonal push without a redeploy. Time-boxed (`starts_at`/`ends_at`)
  and optionally scoped to one sport. Four metrics reusing existing data
  (`RESERVATIONS_COMPLETED`, `COURTS_PLAYED`, `GUESTS_INVITED`,
  `REVIEWS_WRITTEN`) — no new tracking needed, all four are just a scoped
  version of a query this app already runs elsewhere (achievements,
  reviews, guest invites). `GET /challenges/mine` evaluates + awards +
  returns progress in one call, same pattern as `GET /achievements/mine`.
  New "Challenges" tab on the profile page (progress bars) and a small
  manager-only creation form on the admin page. New tables + a new
  `NotificationType` value — ran the manual drop/recreate/reseed cycle.
- Match results + skill rating — a standard Elo update per sport
  (`ratings.py`, K=32, default 1000), `SkillRating` (one row per user per
  sport, created lazily), `MatchResult` (one per reservation).
  `POST /reservations/{id}/result` (either participant, once, only for a
  `COMPLETED` reservation), `GET /ratings/me`, `GET /ratings/leaderboard?
  sport=`. **Deliberately scoped to 1-on-1 bookings only** — a
  `ReservationGuest` has no "side"/team field, so a group booking has no
  well-defined winner/loser pairing; building a team-assignment UI just to
  rate group games would be exactly the overengineering this session was
  asked to avoid throughout. A group/solo reservation gets a clear 409
  instead of a confusing partial rating. Ratings surfaced on the existing
  `PlayerProfileOut.stats` (same public/private gating as achievements —
  no new visibility rule needed) and a new "Rating" tab on the profile
  page's leaderboard section, alongside the existing completed-count
  leaderboard (a different metric, not a duplicate). "Report result"
  action added to `ReservationCard`'s existing more-actions menu.
  New tables + a new `NotificationType` value — ran the manual
  drop/recreate/reseed cycle.
- Persistent teams/clubs — `Team`, `TeamMember` (OWNER/MEMBER), reusing
  PR 3's chat infrastructure for a team's own group chat
  (`Conversation.team_id`, `GET /teams/{id}/chat`). Membership add is by
  email (`POST /teams/{id}/members`, owner-only) matching how inviting a
  reservation guest already works, rather than requiring the frontend to
  know a raw user id. Unlike a reservation's guest list, a team member
  removed from the team **immediately** loses conversation access (`chat.
  get_or_create_team_conversation` prunes stale `ConversationParticipant`
  rows on every membership change) — a deliberate asymmetry from PR 3's
  reservation-chat behavior, since team membership is a stronger,
  standing relationship than a one-off guest invite. A team must always
  keep at least one owner (409 on the last owner trying to leave — delete
  the team instead). Refactored `chat.py`/`api/chat.py` while wiring this
  in: the per-conversation "build a `ConversationOut`" assembly logic that
  three different endpoints needed (DM, reservation, now team) moved into
  one shared `chat.get_conversation_context`/`to_conversation_out` pair
  instead of a third near-duplicate copy. New `TeamsPage`/`TeamDetailPage`,
  a "Teams" nav entry. Two real bugs found and fixed during a real-browser
  verification pass (not just caught by tests): the frontend's
  `addTeamMember` call had drifted out of sync with the backend's
  email-based schema (still sending `user_id` — a live instance of exactly
  the class of bug `schema-change-sweep` exists to catch), and the chat
  WebSocket handler raised an unhandled exception when trying to close a
  socket that had already disconnected during the auth handshake. New
  tables + a new `team_id` column on `conversations` + a new
  `NotificationType` value — ran the manual drop/recreate/reseed cycle.
- Real-time chat — the first WebSocket infrastructure in this codebase.
  `Conversation` (DM/RESERVATION/TEAM kind), `ConversationParticipant`
  (membership + per-user `last_read_at`), `Message`. DM: `POST /chat/dm/
  {user_id}` (idempotent get-or-create, looked up by a sorted `dm_key`).
  Reservation group chat: `GET /reservations/{id}/chat` (booker + accepted
  guests only; re-syncs participants to the reservation's *current* guest
  list on every call rather than needing a separate membership-change
  hook). `GET/POST /conversations/{id}/messages`, `GET /conversations`
  (list mine, with last-message preview + unread count). Delivery:
  `@router.websocket("/ws/chat")` — client authenticates by sending
  `{"type":"auth","token":...}` as the first frame after connecting
  (deliberately not a `?token=` query string, which risks the JWT landing
  in access logs), then only *receives* live pushes; sending stays on the
  REST POST so there's one message-validation path, not two. Connection
  registry is an in-process `dict[user_id, set[WebSocket]]`
  (`chat_hub.py`) — same single-process tradeoff already accepted by
  `rate_limit.py`/`worker.py`, not warranted at this scale. Chat messages
  are deliberately **not** wired into `notify()`/push — a notification per
  message would spam the mute-respecting system built for everything
  else; unread state is tracked via `last_read_at` instead. New
  `PlayerProfilePage` gained a "Message" button; the reservation detail
  dialog gained a "Chat" button (booker and guest views both); a navbar
  icon shows a live+polled unread badge. New tables only — no manual
  reseed cycle needed. Verified: 7 backend tests including a real
  WebSocket round-trip (one client posts, another connected client
  receives the broadcast frame over its socket).
- Review comments — `ReviewComment` (open discussion, any signed-in player
  can reply to someone else's review, not just the author), `GET/POST
  /reviews/{id}/comments`, `DELETE .../comments/{comment_id}` (comment
  author or admin). Deliberately **not** a second "like" system — the
  existing `ReviewVote`/"helpful" toggle already covers reactions, this PR
  only adds the "say something back" half. Found and fixed a real,
  pre-existing gap while touching `delete_review`: `ReviewVote` rows were
  never cleaned up before deleting a review, so any review with a helpful
  vote on it couldn't be deleted at all (same missing-cascade shape as the
  `ReviewImage` fix from an earlier session) — now covered by a regression
  test. New tables only, no manual reseed cycle needed.
- Player profiles + follow — `User.bio`/`profile_public` (opt-out, default
  public), `PlayerFollow` (one-directional, no accept/decline handshake —
  mirrors how `ReservationGuest` invites already work), `GET /users/{id}/
  profile` (`PlayerProfileOut`: bio + achievements/stats reused from
  `achievements.player_stats`, `POST/DELETE /users/{id}/follow` (idempotent,
  mirrors `favorites.py`), `GET /users/{id}/followers`/`/following`. A
  private profile hides bio/stats server-side for non-owners (not just a
  frontend check) — verified directly in tests and in a real browser.
  New `PlayerProfilePage` (`/app/players/:id`), linked from anywhere a
  player's name already renders (frequent teammates, leaderboard, review
  authors). First PR of a 7-PR "Courtly Communities" social expansion
  (chat, teams, skill rating, seasonal challenges, activity feed to
  follow — see the rest land as separate PRs). New column + new
  `NotificationType` value — ran the manual drop/recreate/reseed cycle.
- Image loading performance — uploaded photos were already resized/
  recompressed client- and server-side (`images.py`), but the actual
  `<img>` tags had no `loading="lazy"` (every photo on a page downloaded
  immediately, even off-screen ones) and `/static/*` responses carried no
  `Cache-Control` (the browser re-validated with the server on every
  visit instead of using its own cache). Both fixed: `loading="lazy"` on
  every list/gallery-style image (court grids, admin/profile photo
  thumbnails, leaderboard/teammate avatars), `loading="eager"` kept on
  the one true per-page hero photo (`CourtDetailPage`'s cover shot) and
  the navbar/own-profile avatar so those aren't needlessly deferred; a
  `_CachedStaticFiles` subclass in `main.py` adds
  `Cache-Control: public, max-age=31536000, immutable`, safe because
  `images.py` always writes a fresh UUID filename and never overwrites
  one in place. No schema change.
- Web push notifications — `PushSubscription` table, `GET /push/public-key`,
  `POST/DELETE /push/subscribe`, a minimal `public/sw.js` service worker,
  and a "Browser notifications" toggle on the profile page (next to the
  per-category mute list, which it still respects — `notify()` now also
  best-effort-delivers via `pywebpush` whenever a type isn't muted). Not
  email — a separate, explicitly-excluded backlog item. Verified: backend
  subscribe/unsubscribe/upsert round-trip and delivery-failure handling
  (7 pytest tests, `pywebpush.webpush` monkeypatched); frontend permission
  request, service-worker registration and public-key fetch all verified
  working in a real (non-incognito) browser via Playwright — the final
  FCM handshake itself fails in that sandbox because Playwright's bundled
  Chromium has no Google API keys ("push service not available"), a
  browser/environment limitation confirmed via the exact error, not an
  app defect; the resulting error toast and graceful no-crash fallback
  were verified directly. New table only — no manual reseed cycle needed.
- Review photos — `ReviewImage` (same shape as `CourtImage`), `POST/DELETE
  /reviews/{id}/images` (author-only, capped at 4 — a review is a casual
  single-visit comment, not a court's marketing gallery), shown publicly
  on the court detail page and manageable from the profile page's "My
  reviews" tab. New table, no column change — no manual reseed cycle
  needed.
- Recurring (weekly) facility blocks — `FacilityBlock.series_id` groups every
  occurrence created by one "repeat weekly" request (2-26 weeks, same
  pattern as `ReservationSeries`); `DELETE /facility-blocks/series/{id}`
  removes a whole series at once, the single-occurrence delete still works
  unchanged. New column on an existing table — ran the manual drop/recreate/
  reseed cycle.
- Bounded `limit`/`offset` pagination on `GET /courts`, `/reservations`, `/reservations/admin`, `/admin/users` — the four previously-unbounded full-table reads. Deliberately backend-only: defaults match today's response sizes so no existing caller needed to change, and no frontend "load more" UI was added since current data volume doesn't need one yet — closes the reliability risk without building unused UI.
- Per-category notification mute preferences — `User.muted_notification_types`, `GET/PUT /notifications/preferences`, `notify()` now skips a muted type, 7-category settings UI on the profile page (backed by a shared type→category grouping, not 16 raw toggles). New column on an existing table — ran the manual drop/recreate/reseed cycle.
- "Book again" shortcut on a past reservation's card (dashboard) — links straight into the booking flow with the same court pre-selected (`/app/book?court=`), for any completed/cancelled/expired/rejected/no-show reservation on a still-active court. Verified in a real browser.
- Venue manager replies to reviews — `Review.manager_reply`/`manager_reply_at`, `PUT/DELETE /reviews/{id}/reply` (manager-only), rendered as a public "Venue reply" block on the court detail page with an inline reply composer for managers. Verified in a real browser (Playwright, separate anonymous browser context): the reply is public, but only a manager sees the reply/remove controls.
- Court photo gallery — `CourtImage` model, `POST/DELETE /courts/{id}/images` (manager-only, capped at 8), admin gallery editor and a clickable thumbnail strip on the court detail page. Verified in a real browser (Playwright): upload, detail-page render, and removal all round-trip correctly.
- Auth rate-limiting on `/auth/login`/`/auth/register` — `rate_limit.py`, PR merging `security/auth-rate-limit`.
- Worker reliability: per-subtask transaction isolation + consistent row-locking — `worker.py`, PR merging `reliability/worker-tick-isolation`.
- Dependency-audit baseline run (`pip-audit`/`npm audit`, both clean), `images.py` pixel-dimension cap, `transition()`'s locking contract documented, unhandled-exception logging hook — one PR, `backend/architecture` hardening batch.
- Reservation reschedule validation: verified `ReservationReschedule` already shares `validate_slot_shape()` with `ReservationCreate` (`schemas/reservation.py`) — not a drifted copy, no fix needed. Closing without a code change.
- Mobile `week-calendar.tsx` — single-day view below `sm`, PR merging `polish/mobile-week-calendar`.
- Admin stats 7/30/90-day window selector + CSV export status-filter bug fix, PR merging `feat/admin-stats-window-and-csv-filter`.
- Empty state for `CourtsTab` when the court catalog is genuinely empty, PR merging `polish/empty-courts-state`.
- Keyboard-only completability of the booking flow — verified in a real browser (Playwright), full pass, no code change needed.

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
