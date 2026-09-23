# Changelog

All notable user- or developer-visible changes to Courtly (C01) are
documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

There is no tagged release process yet — see `versioning` skill — so
entries accumulate under `Unreleased` until the team decides to cut one.

## [Unreleased]

### Added

- **Venue managers and admins now get a "Your venue at a glance" snapshot
  on their `/app` dashboard** instead of landing on the same empty
  player-style "book your first court" view every role saw before. Shown
  only for `VENUE_MANAGER`/`ADMIN` (`DashboardPage.tsx`), it surfaces
  pending-approval count, recent reservation volume, court count, and
  no-show rate (reusing the existing `GET /admin/stats` endpoint — no
  backend change), plus a direct link into the admin panel and, when
  approvals are waiting, a one-click deep link to the pre-filtered
  Reservations tab (`/app/admin?tab=reservations&status=PENDING_APPROVAL`,
  the same convention the notification bell already used). The player's
  own dashboard is unchanged.

- **The navbar itself now reflects which of the three roles is signed
  in**, not just which links are visible. The account dropdown header
  (`navbar.tsx`) shows a role badge (Player/Venue manager/Admin, reusing
  `ROLE_VARIANT`/`useRoleLabels` from `lib/user-role.ts`, the same pattern
  `AdminPage.tsx`'s user list already used) next to the name. For
  `VENUE_MANAGER`/`ADMIN`, "Admin" moved from last to right after
  "Dashboard" in the top nav, the account dropdown, and the mobile menu —
  their primary duty, not an afterthought at the end of the list.

### Changed

- **Every primitive UI component now sources from the real shadcn/ui CLI
  registry instead of being hand-rolled.** `components/shared/{avatar,badge,
  button,card,dialog,dropdown-menu,input,label,select,separator,skeleton,
  sonner,switch,tabs,textarea}.tsx` moved to `components/ui/` and were
  regenerated via `npx shadcn add <name>` (`components.json` added), with
  this app's design-token classes, custom variants (e.g. `Button`'s `dark`
  variant), and previously-fixed bugs (e.g. `Tabs`' tab-bar overflow fix)
  ported forward onto the regenerated files rather than discarded — a raw,
  unmodified CLI drop-in would have reverted those to shadcn's generic
  neutral-gray defaults. The app now depends on the unified `radix-ui`
  package instead of per-primitive `@radix-ui/react-*` packages. No visual
  or behavioral change for users — verified by screenshotting every major
  page/state (landing, auth, courts, dashboard, profile, admin, dialogs,
  dropdowns) before and after. See `component-design` for the pattern to
  follow when adding a new primitive.

## [0.2.0] - 2026-09-23

### Fixed

- **Five pages were missing the app's page-shell convention entirely** —
  `mx-auto max-w-*xl px-6 py-16` plus a `SectionHeader` (eyebrow + big bold
  title + description), which every other page (Courts, Dashboard, Profile,
  Admin, Court detail, Book a court) already uses. `/app/players`,
  `/app/teams`, a team's detail page, and a player's public profile instead
  rendered a plain `<h1>` flush against the browser's edge with no gutter
  or max-width, and `/app/chat` had no page padding at all — the four
  looked like an unfinished fragment of the app next to every other page,
  not a deliberate visual difference. Found by direct comparison against
  the rest of the app rather than the earlier per-page UI audits, which
  each looked at pages individually and missed that these four had never
  been brought in line with the shell every other page converged on.
  Fixed by applying the same container + `SectionHeader` (or, for Chat's
  legitimately different full-height split-pane layout, the same page
  gutter without forcing it into a card-grid shape it shouldn't have).
- **Achievement icons switched from emoji to Lucide**, matching every other
  icon in the app (sport icons, activity-feed icons, stat tiles). The
  Achievements tab, a player's public profile, and the activity feed's
  "unlocked an achievement" entries all previously rendered a raw emoji
  (🎾, 🏆, 🦋, ...) next to otherwise-Lucide UI — a visual inconsistency
  flagged during the UI polish audit and confirmed with the user rather
  than resolved unilaterally, since it was a genuine style call. New
  `components/shared/achievement-icon.tsx` maps each achievement's `key` to
  a specific Lucide icon (e.g. `Flame` for a play streak, `Compass` for
  visiting different courts); the backend's `Achievement.icon` emoji field
  is unchanged and still returned, just no longer rendered by the frontend.

### Added

- **UI polish pass, round 2 — a second mobile-overflow bug in the
  Dashboard's own layout, plus smaller fit-and-finish fixes** found by
  re-verifying round 1's fixes in a real 375px viewport rather than trusting
  them on sight:
  - **Dashboard's two-column layout (`grid-cols-[1fr_320px]`) overflowed the
    viewport below `lg`** even after round 1's tab-bar fix — CSS Grid's
    `min-width: auto` default meant neither the reservation-list column nor
    the sidebar would shrink below its own content's intrinsic width.
    `document.documentElement.scrollWidth` measured 422px against a 375px
    viewport; adding `min-w-0` to both grid children brought it back to
    exactly 375px. This also explains why the round-1 tab-pill fix wasn't
    fully effective on this page — it was resolving against an
    already-oversized parent. The view-mode tab bar itself (List/Calendar/
    Find a partner/Feed) also picked up `overflow-x-auto` and `shrink-0` so
    it scrolls instead of wrapping oddly on narrow screens, and the stat-tile
    row now uses a 2-column grid on mobile instead of stacking to one.
  - **Admin's Availability tab**: the block-a-court "From"/"To" datetime
    inputs sat side-by-side unconditionally, squeezing to unusable width on
    mobile — now stack to one column below `sm`. The block-list cards had no
    max width and stretched uncomfortably wide on a large desktop viewport —
    capped at `max-w-xl`, matching the form column beside it.
  - **Admin's Users tab**: the role `<Select>` was too narrow (`w-40`) for
    "Správce sportoviště" (Czech for "Venue manager") to fit on one line —
    widened to `w-48`.
  - **Courts page's "All courts" section duplicated every card already
    shown above it** in Trending/Recommended — with the seeded demo
    catalog's small size, that meant nearly every court printed twice on
    the page. Now filters "All courts" down to courts not already curated
    above, and hides the section entirely rather than showing an empty grid
    when nothing's left to show.
- **UI polish pass, round 1 — a real shared-component bug, a real mobile
  overflow bug, and design-token cleanup.** A full visual audit of every
  page (4 parallel passes, desktop + mobile) against the existing "navy
  ink on cool marble" system found two genuine, reproduced defects and a
  batch of small consistency fixes:
  - **`TabsList` (`components/shared/tabs.tsx`) had no overflow handling.**
    On a narrow screen, a page with enough tabs (Profile's 7, Admin's 6)
    grew wider than the viewport with no scroll container, and activating
    an off-screen tab auto-scrolled the whole page horizontally — every
    panel on the page shifted with it, independently reproduced by two
    separate audit passes (Admin: 2 of 6 tabs completely hidden; Profile:
    tab content rendering with a large negative horizontal offset, verified
    via `getBoundingClientRect()`, not a screenshot artifact). Fixed at the
    shared-component level (`overflow-x-auto` + `max-w-full`), benefiting
    every tabbed page at once; Profile additionally got the same
    edge-bleeding scroll wrapper Admin already had, for a consistent feel.
  - **`court-card.tsx`'s plain (`onSelect`) variant — used in Book a
    court's court list — genuinely overflowed the viewport at 375px** when
    a card had enough content (the `requires_approval` badge + a rating
    line): `document.documentElement.scrollWidth` measured 400px against a
    375px viewport. The text content block had no `min-w-0`, so the
    non-shrinking price pushed past the card edge instead of wrapping.
    Fixed with `min-w-0`/`flex-wrap`/`truncate`, verified back to exactly
    375px.
  - Chat: a short conversation's messages floated near the top of the
    scroll area with a large empty gap before the composer instead of
    sitting just above it; the per-message react/delete icon row was
    always fully visible, reading as slightly cluttered next to the rest
    of the app's cleaner styling — now dims to 60% opacity until hovered
    (or while its reaction picker is open).
  - Removed a duplicate Courtly logo on mobile Login/Register (the page
    navbar already shows one) and a stray `overflow-hidden` on
    About/Help's hero sections that clipped their decorative glow into a
    hard edge, inconsistent with how the same component renders
    everywhere else it's used.
  - **Design-token cleanup**: 20 occurrences of two literal hex values
    (`#e6f0ff`, `#eaf3ff`) across 15 files — a real violation of this
    project's own "never hardcode a hex color" rule — replaced with two
    new named tokens (`--tint-blue`, `--highlight-blue`) alongside the
    existing palette in `index.css`; two button hover-state hex literals
    got the same treatment (`--signal-blue-hover`, `--ink-navy-hover`).
    Zero visual change — same colors, now named and reusable instead of
    copy-pasted.
- **A second UX-completeness pass**, this time auditing in the direction
  the first one didn't: every backend endpoint checked for a real,
  reachable frontend consumer (not just every page checked against its
  own API calls). Found and fixed: a team join request could be sent but
  never cancelled (`cancelTeamJoinRequest` existed, had no button —
  Discover's "Requested" state is now a working "Cancel request"); the
  profile's Rating tab only ever showed one sport's leaderboard, with no
  way to see your own rating across every sport you'd played without
  cycling through each one (`GET /ratings/me` existed, had no caller — now
  a small "Your ratings" summary above the leaderboard). Also closed
  content gaps a second pass over previously-unaudited pages found: the
  landing page's "Why Courtly" section promised "the whole social side of
  showing up to play" while showing 0 of the 6 shipped social features —
  added teams, chat, and rating/challenges tiles; the Help Center gained
  a favorites entry (never covered) and an admin-only-powers entry in the
  venue-manager section, and its recurring-facility-block description now
  actually says it's recurring.
- **Chat rebuild: delete, reactions, and photo attachments.** You can now
  delete your own message (soft-deleted — other participants see a
  "Message deleted" placeholder rather than the row just vanishing);
  react to any message with a fixed set of 6 emoji (tap again to remove
  your reaction); and attach a photo, with or without a caption, from the
  composer. All three are live over the existing chat WebSocket for every
  participant, the same as a new message already was. **Breaking for the
  dev database**: new `Message.deleted_at`/`image_url` columns and a new
  `message_reactions` table — run the drop/create/reseed cycle from
  `backend/CLAUDE.md`.
- **Teams rebuild: public discovery/join, a CAPTAIN role, and a team
  avatar.** A team is public by default (owner can flip it private from
  a new edit-team dialog); `/app/teams`'s new "Discover" tab lists public
  teams you're not already in, with a "Request to join" flow the owner or
  a captain accepts/declines from a new "Join requests" panel on the team
  page. A new `CAPTAIN` role (owner-promoted) can add/remove non-owner
  members and manage join requests, but can't delete the team, change its
  visibility, or touch another captain — those stay owner-only. Owners
  and captains can upload a team avatar, same compress-and-store pipeline
  as a user avatar/court photo/review photo. **Breaking for the dev
  database**: a new `TeamRole.CAPTAIN` enum value, a new
  `team_join_requests` table, new `Team.avatar_url`/`is_public` columns,
  and 3 new `NotificationType` values — run the drop/create/reseed cycle
  from `backend/CLAUDE.md`.
- **The players directory is now actually browsable**, not just a search
  box that returns nothing until you already know someone's name.
  `GET /users/search` with an empty/short `q` now returns a paginated
  list of public profiles instead of `[]`; `/app/players` shows it as a
  card grid with "load more".
- Team detail now shows when the team was created and when each member
  joined — both were already returned by the API, never rendered.
- The dashboard activity feed has a "Load more" button instead of being
  hard-capped at the most recent 30 events.
- **A venue manager's reservation queue and history now show what was
  previously hidden.** The admin reservation list includes each booking's
  guests (previously only the booker was visible — a real gap for
  resolving a group check-in/no-show dispute), the reservation history
  dialog now shows who performed each action instead of just what
  happened, and a `PENDING`/`PENDING_APPROVAL` row shows its hold/approval
  expiry so the queue can be triaged by urgency. Court cards in the admin
  Courts tab now show the same star rating the public court page does,
  and a challenge card in the admin Challenges tab shows how many players
  have completed it.
- **Recurring bookings are now visibly marked as a group.** A "Recurring"
  badge on `ReservationCard` and the reservation detail dialog when a
  reservation belongs to a series — previously all 8+ weekly occurrences
  looked like unrelated one-off bookings.

- **Help Center coverage for the "Courtly Communities" features.** Chat,
  teams/clubs, player profiles/follow, skill rating and the leaderboard,
  seasonal challenges, the activity feed and review photos were all
  shipped without ever being added to the Help Center — the "Playing with
  others" section and FAQ now cover all of them.
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

- **A private profile's follower/following list is no longer readable by
  anyone signed in.** `GET /users/{id}/followers`/`/following` never applied
  the same visibility gate `get_player_profile` already uses for
  bio/stats — found during a UX audit of the social pages, fixed
  alongside it since it's the same file and a two-line permission check.
  Follower/following *counts* are unaffected (same as most social apps,
  a private account's counts are still visible, only the list isn't).
- **A facility-maintenance block is now visible before you try to book it.**
  `GET /courts/{id}/availability` only ever reflected reservations, never
  `FacilityBlock`s, even though booking into a blocked window was already
  rejected server-side — a slot could look free on the occupancy timeline
  and the start-time picker, then 409 at submit. The timeline and picker
  now show it as a distinct "Unavailable" state (with the manager's reason
  on hover), separate from a genuinely booked slot.
- A court that `requires_approval` is now flagged on its detail page and in
  the "Book a court" court list, not just after you've already picked it
  and reached the confirm step.
- Clicking a "added to a team," "match result reported" or "challenge
  completed" notification no longer goes nowhere, and all three can now be
  muted from Profile → Notifications — the frontend's `NotificationType`
  list had drifted out of sync with the backend's since the PRs that added
  them.
- Confirming a hold whose 5 minutes had passed (but was not yet swept), or on a
  court that was deactivated, no longer succeeds.
- A late Confirm can no longer overwrite a Cancel that won the race, and the
  same holds for Approve/Reject/expiry (state changes now take a row lock).
- A `end_time` without a timezone offset returns 422 instead of a server error.
- The personal calendar feed no longer shows an unapproved request as confirmed.

