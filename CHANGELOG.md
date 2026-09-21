# Changelog

All notable user- or developer-visible changes to Courtly (C01) are
documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

There is no tagged release process yet — see `versioning` skill — so
entries accumulate under `Unreleased` until the team decides to cut one.

## [Unreleased]

### Added

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

- A reservation can only be cancelled before its start time, from `PENDING`,
  `PENDING_APPROVAL` or `CONFIRMED` (previously any time, and from `CHECKED_IN`);
  the UI only offers Cancel when it will work.

### Fixed

- Confirming a hold whose 5 minutes had passed (but was not yet swept), or on a
  court that was deactivated, no longer succeeds.
- A late Confirm can no longer overwrite a Cancel that won the race, and the
  same holds for Approve/Reject/expiry (state changes now take a row lock).
- A `end_time` without a timezone offset returns 422 instead of a server error.
- The personal calendar feed no longer shows an unapproved request as confirmed.

