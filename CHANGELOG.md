# Changelog

All notable user- or developer-visible changes to Courtly (C01) are
documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

There is no tagged release process yet — see `versioning` skill — so
entries accumulate under `Unreleased` until the team decides to cut one.

## [Unreleased]

### Added

- **A "Recent games" section on player profiles.** The last 5 `COMPLETED`
  reservations a player was part of (as booker or accepted guest), with
  court/sport/date; a 1-on-1 game with a reported match result also shows
  the opponent and win/loss/draw. Respects the existing profile-visibility
  gate — hidden whenever the rest of a private profile's stats are.
- **Photos when writing a review**, not just afterward. Review photos
  shipped earlier (up to 4 per review, shown on the court detail page)
  but the only way to attach one was to add it after the fact from
  Profile → My reviews; the "Rate it" dialog now has the same picker at
  creation time too.
- **Player search and a players directory** (`/app/players`, navbar
  "Players" link). `GET /users/search?q=` matches public profiles by name
  (an exact email match still resolves a private profile, same as before)
  — this is what actually makes the profile pages from the "Courtly
  Communities" epic discoverable instead of only reachable by stumbling
  onto a link.
- **Public player profiles and follow.** A profile page per player
  (`/app/players/:id`) showing bio, achievements, skill ratings and a
  follow button; a profile is public by default with an opt-out toggle,
  which hides bio/stats (not name/avatar) from everyone but the owner.
  **Breaking for the dev database:** new `User` columns and a new
  notification type — run the drop/create/seed cycle from `backend/CLAUDE.md`.
- **Review comments.** Any signed-in player can reply to someone else's
  review, not just its author — the existing "helpful" vote already
  covered reactions, this adds the discussion half.
- **Real-time chat** — direct messages, a group chat per reservation, and
  a group chat per team, delivered live over a WebSocket
  (`/ws/chat`; see ADR-004) with REST as the fallback/history path. A
  navbar icon shows a live+polled unread badge.
- **Persistent teams/clubs**, each with its own roster and group chat
  reusing the chat infrastructure above. Membership is added by email
  (owner only); a removed member loses chat access immediately, unlike a
  reservation guest. **Breaking for the dev database:** a new `Conversation`
  column and a new notification type — run the drop/create/seed cycle.
- **Match results and skill rating.** Either participant of a completed,
  1-on-1 (exactly one guest) booking can report a win/loss/draw; ratings
  update with a standard Elo formula, surfaced on player profiles and a
  new sport-filterable leaderboard tab. Group bookings aren't rateable —
  there's no well-defined winner/loser pairing without a team-assignment
  UI this didn't seem worth building. **Breaking for the dev database:**
  a new notification type — run the drop/create/seed cycle.
- **Seasonal challenges.** A venue manager can run a time-boxed goal (e.g.
  "play 10 sessions this autumn") from the admin panel; players see
  progress bars on their profile. **Breaking for the dev database:** a new
  notification type — run the drop/create/seed cycle.
- **Activity feed** — a 4th tab on the dashboard showing what players you
  follow have been up to (followed someone, joined a team, played a
  rated match, completed a challenge or achievement, opened a game to
  join).
- **Web push notifications.** A "Browser notifications" toggle on the
  profile page delivers the same notifications to the browser via a
  service worker, even when the tab isn't open, respecting the existing
  per-category mute preferences.
- **Review photos** — up to 4 photos per review, shown publicly on the
  court detail page.
- **Recurring facility blocks.** A venue manager can repeat a maintenance
  block weekly (2–26 weeks) and remove every occurrence at once.
  **Breaking for the dev database:** a new `FacilityBlock` column — run
  the drop/create/seed cycle.

- **A new `ADMIN` role, above `VENUE_MANAGER`.** Inherits every venue-manager
  capability, plus two admin-only ones: changing anyone's role — including
  granting or revoking `ADMIN` itself (a venue manager keeps the existing
  player ↔ venue-manager toggle only) — and permanently deleting a court
  that has no reservation history (`DELETE /courts/{id}`; deactivating is
  still how you retire a court that's actually been used). The Admin →
  Users tab is now a role picker instead of a promote/demote toggle, with a
  confirmation step for anything touching the admin tier. The seeded demo
  venue-manager account is now the demo admin account
  (`admin@courtly.app`); a new `manager@courtly.app` demo account covers
  the venue-manager tier. **Breaking for the dev database:** a new enum
  value — run the drop/create/seed cycle from `backend/CLAUDE.md`.
- **Approval process for courts that require it** (C02, spec v0.2). A court can
  be flagged `requires_approval`; on it a player's Confirm submits the
  reservation (`PENDING_APPROVAL`, blocks the slot for up to 24 h or until the
  start) and a venue manager approves or rejects it (`POST /reservations/{id}/approve|reject`);
  undecided requests expire. Includes the manager approval queue in the admin
  panel, the court setting, "awaiting approval" everywhere reservations are
  shown, and in-app notifications for both sides (English/Czech).
  **Breaking for the dev database:** new columns and enum values — run the
  drop/create/seed cycle from `backend/CLAUDE.md`.
- `GET /courts/{id}/availability/check` — a yes/no answer (with cause) for one
  exact interval, including facility blocks.
- `docs/specification-v0.1.md`, `docs/specification.md`, `docs/change-c02-impact.md`
  — the executable specification of the reservation operations; its
  verification examples run as `test_spec_baseline.py` / `test_approval_api.py`.

- Team Git workflow: branch → PR → merge lifecycle is now Claude's default
  for meaningful changes, driven by `finish-task`, with a hook guarding
  against direct commits to `main`.
- This changelog.
- A public **Help Center** (`/help`), linked from the navbar and footer on
  every page: a getting-started walkthrough, how booking/holds/approval/limits
  work, a plain-language glossary of every reservation status, the social
  features (open games, guests, split cost, teammates), staying-on-top-of-it
  tools (waitlist, calendar sync, recurring bookings, reschedule), a
  venue-manager guide, and a full FAQ — in English and Czech.
- A landing-page "Why Courtly" section surfacing features that existed but
  weren't visible from the homepage (open games, waitlist, split cost,
  calendar sync, recurring bookings, achievements), an FAQ teaser, and a
  venue-manager callout linking into the new Help Center.
- `components/shared/error-state.tsx` — a shared "this failed to load, retry"
  state (the `isError` sibling of `EmptyState`), now wired into every page's
  primary data queries (dashboard, profile tabs, admin tabs, courts, book a
  court) — those previously rendered nothing on a failed request instead of
  an actionable error.

### Changed

- Inviting a guest to a reservation and adding a team member now search
  players by name in the UI instead of requiring their exact email
  address; both endpoints accept a `user_id` as an alternative to
  `email` (email still works, e.g. for a private profile you already
  know the address of).
- Gallery/list photos (court grids, admin/profile galleries, leaderboard
  and teammate avatars) now lazy-load instead of downloading immediately;
  the one true hero photo per page still loads eagerly. Uploaded files
  under `/static/*` are now cached indefinitely by the browser (safe
  because an upload never gets overwritten in place, always a fresh
  filename).
- A reservation can only be cancelled before its start time, from `PENDING`,
  `PENDING_APPROVAL` or `CONFIRMED` (previously any time, and from `CHECKED_IN`);
  the UI only offers Cancel when it will work.
- Whole-application UI/UX pass: `ReservationCard`'s up-to-six equal-weight
  action buttons are now one primary action plus a "more actions" menu;
  Dashboard reflows into a main column (reservations) and a secondary column
  (teammates/waitlist/join requests/shared-with-you) instead of one long
  single-column stack, with a shared `data-row.tsx`/`subsection-heading.tsx`
  primitive replacing six ad hoc copies of the same row/heading markup
  (also applied across Admin's reservations/users/availability tabs); the
  authenticated `/app/*` shell now shows a slim footer instead of the full
  marketing one; dialogs cap at 85vh with internal scroll so a long one
  (the admin court form) never pushes its Save button off-screen; `Input`/
  `Textarea` gained a shared `aria-invalid` styling hook; the booking-summary
  card on Book a court/Court detail is sticky on desktop; Courts' filtered
  empty state offers a "Clear filters" action; the 404 page has real (i18n'd)
  copy instead of hardcoded English court-themed text, plus a second action;
  a few remaining hardcoded `aria-label`s (star rating, password show/hide,
  mobile nav toggle) are now translated.

### Fixed

- Confirming a hold whose 5 minutes had passed (but was not yet swept), or on a
  court that was deactivated, no longer succeeds.
- A late Confirm can no longer overwrite a Cancel that won the race, and the
  same holds for Approve/Reject/expiry (state changes now take a row lock).
- A `end_time` without a timezone offset returns 422 instead of a server error.
- The personal calendar feed no longer shows an unapproved request as confirmed.

