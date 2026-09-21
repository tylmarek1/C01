---
name: feature-development
description: The default workflow for any high-level feature request on Courtly (C01) — "add notifications," "improve reservations," "add an admin module," "add a new reservation type." Use whenever asked to add or meaningfully change functionality, before writing any code. Classifies the kind of change, activates only the relevant skills for it, builds an impact map, implements the full vertical slice with product quality as first-class, then verifies/reviews/reports.
---

# Feature development on Courtly

A high-level request ("add X") is not an instruction to start editing files.
It's an instruction to run this loop. Don't skip to implementation — but
also don't force a one-line CSS tweak through every step meant for a
full-stack feature. Step 0 decides how much of this actually applies.

## Step 0 — Classify the change

Read the request against the actual current code, then pick the closest
row. This determines which of the later steps and which other skills
actually activate — don't run all of them regardless of fit.

| Change type | Activates |
|---|---|
| UI-only (styling, layout, copy, one component) | `component-design`, `i18n-check` if text changed, `accessibility-responsive`. Skip DB/API impact-mapping entirely. |
| API-only (new/changed endpoint, same data shape) | `api-design`, `security-review` (auth/ownership), `backend-testing`. Skip frontend design unless a consumer needs updating — check `feature-completeness` for that. |
| Database change (new/changed model or schema) | `database-evolution` first (is this safe with a reseed or not?), then `schema-change-sweep`, then whichever of API/frontend actually consumes the changed field. |
| Full-stack feature (new capability spanning layers) | The full Step 1-7 loop below, all relevant sub-skills. |
| Refactor (restructure, no behavior change) | `refactoring` and `architecture-review` — this skill's Steps 2-4 mostly don't apply; go there directly. |
| Bug fix | Understand the actual root cause first (don't patch the symptom), add a regression test (`backend-testing`), then this skill's Step 5-6. |
| Performance change | `performance-review` drives it; use this skill's Step 1-2 only to scope what's affected. |
| Security change | `security-review` drives it; treat as high-scrutiny even if it looks small. |
| Architecture change (new module/abstraction, cross-cutting) | `architecture-review` first — this is the one category where over-triggering everything else is actually appropriate, since a bad architectural call is expensive to reverse. |
| Docs-only | `update-docs` only. No code verification needed. |
| Developer tooling (hooks, settings, a new skill) | Not this skill — see root `CLAUDE.md`'s own workflow for changing the Claude configuration itself. |

Most real "add X" requests are **full-stack feature** — when in doubt
between that and a narrower row, treat it as full-stack; the cost of
checking an irrelevant section is one paragraph, the cost of missing a
layer is a half-built feature.

Once classified (any row except pure exploration/investigation), branch
off `main` before touching files — see root `CLAUDE.md`'s "Git workflow".
Everything from Step 4 onward happens on that branch, and `finish-task`
at Step 5 carries it through commit/push/PR/merge.

## Step 1 — Understand

- Read `docs/codebase-map.md` first for fast orientation — where the
  relevant modules/pages already live and what owns them — then confirm
  specifics against the actual source below; the map is a starting point,
  not a substitute for reading the code you're about to change.
- Grep `backend/src/reservations/` for anything resembling the feature
  already (a partial version, a similar pattern in a neighboring module).
- Check `backend/src/reservations/models/` and `schemas/` for entities the
  feature would touch or extend.
- Check `frontend/src/pages/` and `frontend/src/components/shared/` for
  existing UI that's adjacent or that the feature should reuse.
- Check `docs/intent-and-change.md` for whether this is already part of the
  documented domain frame, and `docs/project-state.md`/root `CLAUDE.md`'s
  "Known gaps" for whether it's a previously-noted gap.

**Ambiguous product decisions vs. inferable scope.** Ask only when the
codebase genuinely doesn't answer the question. Two worked examples:

- *"Add notifications"* is **not** ambiguous here: a `Notification` model,
  `NotificationType` enum, and in-app delivery already exist
  (`notifications.py`). There's no email/SMS/push boundary anywhere in this
  codebase, and project history has explicitly deferred those. The
  C01-native interpretation is: extend the existing in-app system with a
  new `NotificationType` and delivery point. Implement it; don't ask "email
  or in-app?"
- *"Add a new reservation type"* genuinely **is** ambiguous: it could mean a
  new sport-adjacent booking kind (an instructor-led lesson, needing a
  resource the domain doesn't model yet), or a variant of the existing
  court-booking flow (e.g. a tournament bracket slot). Nothing in
  `docs/intent-and-change.md` or the models resolves this. Ask, briefly,
  with the codebase-grounded options you found — don't guess a specific
  domain concept into existence.

The pattern: if an existing model/enum/module already represents the
concept, extend it and proceed. If the request implies a domain concept
that doesn't exist yet and could reasonably mean more than one thing, ask.

More generally, decide autonomously whenever the codebase provides the
evidence — component placement/decomposition, API structure, validation
strategy, which states to cover, reusable-primitive choices, responsive/
accessibility details, refactoring boundaries, test structure, naming, code
organization, database implementation details, and whether to extend an
existing module vs. add a new one. Ask only when a decision introduces a
fundamentally new business concept with multiple plausible meanings,
changes a core business rule, deletes existing functionality, introduces a
new externally-visible product policy, or would need a destructive
migration — decisions with materially different business consequences, not
decisions with materially different code. A broad request is not, by
itself, a reason to ask.

## Step 2 — Map the impact

For a full-stack feature, build an explicit map before writing code — not
a mental note, an actual list you work from. Worked example, grounded in
this codebase's real shape:

```
Feature: "Add notifications for X"

Database   — none, if reusing NotificationType; a new enum value if X is new
Backend    — notifications.py: new notify() call site at the right trigger point
           — worker.py: a periodic check, if X is time-based (like reminders)
           — api/notifications.py: only if the existing endpoints don't
             already expose what the frontend needs
Frontend   — notifications-bell.tsx: routing for the new NotificationType
             (it already routes by type — see its existing switch/map)
           — i18n: new notification title/body strings in en.ts + cs.ts
Tests      — test_notifications_api.py: the new trigger path
Docs       — none likely (an additive NotificationType isn't a new ADR)
```

Go through the real list for your feature:

- **Database** — new table, new column, new enum value on an existing type?
  If it's the last two: `database-evolution` before writing the model.
- **Backend API** — new router, new endpoint, new schema? `api-design`.
- **Business logic** — `lifecycle.py` (new state/transition), `rules.py`/
  `booking_validation.py` (new constraint), or a new feature-specific
  service module? Match the existing pattern.
- **Frontend** — new page, new component, or extending an existing screen?
  `component-design` and `api-integration`.
- **i18n** — new user-facing text needs real keys in both `en.ts`/`cs.ts`
  from the start — `i18n-check`.
- **Auth/authorization** — `get_current_user`/`get_current_manager`, or a
  new ownership rule?
- **Notifications/worker** — new `NotificationType`, or a periodic check in
  `worker.py`'s tick?
- **Tests** — which existing file extends, or a new `test_<feature>_api.py`?
- **Docs** — will this make README/`docs/*.md` more wrong, or move/rename/
  add a module in a way that makes `docs/codebase-map.md` stale? Note for
  Step 7 (`update-docs` has the trigger table).

## Step 3 — Design the smallest fit

Run `architecture-review`'s questions before introducing a new module: does
an existing module already own this? Can an existing pattern be reused?
Don't add a dependency, a new abstraction layer, or a config-driven system
for something that's currently one concrete case.

## Step 4 — Implement, with product quality as first-class

A vertical slice means the full trace, not just "the API returns data":

```
user action → frontend → API → validation → authorization →
business logic → database → response → frontend state → UI feedback → tests
```

A feature is incomplete if any link in that chain is missing — an endpoint
with no frontend consumer, or a frontend control with no correct backend
behavior, are equally unfinished (`feature-completeness` checks this
formally after implementation, but build with the full chain in mind, not
as an afterthought).

Implementing the frontend half means, from the start, not as a follow-up
pass:

- Every new query/mutation has a **loading**, **empty** (where a list can be
  empty), **error**, and **success-feedback** state — not just the happy
  path. See `accessibility-responsive`.
- A **destructive action** (cancel, delete, remove) gets a confirmation
  step via `components/shared/confirm-dialog.tsx` — the shared primitive
  for this, already wired into cancel-reservation, remove-guest,
  delete-review, and delete-facility-block. Use it rather than firing the
  mutation straight from the triggering button or inventing a one-off.
- **Disabled and permission states** are handled explicitly — a
  manager-only control hidden or disabled for a player, a submit button
  disabled while its mutation is pending, not just visually present but
  functionally inert.
- Sensible defaults, not empty/zero placeholders a user has to fill in from
  scratch when a reasonable default is inferable.
- New UI **reuses `components/shared/`** and the existing design tokens —
  see `component-design`. A new screen should look like it belongs to this
  application, not a new visual style invented for the occasion.
- New interactive elements are keyboard/screen-reader accessible and work
  at mobile width — same skill.
- New user-facing text goes through `t()` in both languages from the start.

Backend implementation follows `backend/CLAUDE.md` and `api-design`/
`database-evolution` for the layers you touched.

## Step 5 — Verify

Run `finish-task` — it picks the checks that match Step 0's classification
and what you actually changed.

## Step 6 — Review

- `self-review` — is the diff itself good (correctness, architecture,
  security, performance, tests, docs, hygiene)?
- `feature-completeness` — is the *feature* actually whole end-to-end (does
  every new backend piece have a frontend consumer, does every new state
  have UI that understands it, does the critical path have a test)? This
  catches gaps `self-review`'s diff-focused read can miss, since a diff
  can look complete while quietly leaving an endpoint unconsumed.
- `consistency` — does the new code match existing naming/patterns, or does
  it quietly introduce a second way to do something the codebase already
  does one way?
- **Outcome check, not just code check** — did this actually improve the
  thing it was meant to improve? Did it introduce inconsistency elsewhere?
  Would a user experience this as finished, or as "technically there"? A
  clean diff that doesn't actually deliver the requested improvement hasn't
  passed review.

If any of the above surfaces a problem inside this task's scope, fix it now
— see root `CLAUDE.md`'s "fix within scope" rule. Re-run `finish-task` after
a fix, don't assume it's still green.

## Step 7 — Flag, don't chase, further improvement

Ask: "does this change make an obvious next improvement visible?" Classify:

- **Required for this task** — fix it now.
- **Valuable, but separate** — mention it in your report; don't implement it
  unless asked.
- **Future idea** — one sentence, no more.
- **Overengineering** — don't do it, don't mention it as if needed.

Never let this turn one request into an open-ended rewrite. A substantial
finding belongs in `improve-app` (a full audit) or, for an already-working
feature that just needs elevating, `polish` — not a scope expansion of the
current task.

## Report

State what you built, across which layers, what you verified, and any
Step 7 findings in their category — not a narration of every file opened.
