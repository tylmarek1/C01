---
name: consistency
description: Check whether new Courtly (C01) code follows existing naming/pattern conventions across backend and frontend, and flag existing inconsistencies rather than silently adding a third variant. Use before adding a new endpoint/component/module (does a convention already exist to follow?) and when asked to review or improve consistency.
---

# Protect consistency; don't add to the drift

The rule: **if a good existing convention exists, new code follows it. If
conventions are already inconsistent, say so explicitly rather than picking
a third way.**

## Backend

- **API naming** — resource-plural router prefixes (`/courts`,
  `/reservations`, `/facility-blocks`), action verbs as sub-paths
  (`/reservations/{id}/confirm`), matching the existing `api/*.py` files.
- **Validation** — Pydantic schemas for shape, `rules.py`/
  `booking_validation.py` for business constraints — not inline ad hoc
  checks in a route body when an existing module already owns that kind of
  rule.
- **Errors** — `HTTPException(status, "message")`, plain string `detail` —
  every existing router does this; a new one should too (`api-design`).
- **Response structures** — a Pydantic response schema per resource in
  `schemas/`, not a raw dict or ORM model returned directly.
- **Authorization** — `get_current_user`/`get_current_manager` dependencies,
  not a hand-rolled role check in a route body.
- **Service module pattern** — one file per feature-specific concern
  (`achievements.py`, `waitlist_service.py`, `calendar_export.py`) holding
  real logic; routers stay thin.
- **Constants** — a value used more than once lives in `rules.py` or
  `schemas/reservation.py` and is imported, not restated. A known,
  already-real instance of this drifting: `VENUE_TZ` is independently
  defined in both `schemas/reservation.py` and `seed.py` instead of one
  importing the other — an example of what this check is meant to catch,
  not something to silently fix as a side effect of unrelated work (flag it
  via `improve-app` if you want to address it deliberately).

## Frontend

- **Components** — check `components/shared/index.ts` before writing a new
  primitive; follow the existing `cva`-variant pattern for a new one
  (`component-design`).
- **Data fetching** — TanStack Query + `lib/api.ts`, never raw `fetch()`
  (`api-integration`).
- **Forms** — plain controlled inputs, not a new form library introduced
  for one form (`api-integration`).
- **i18n** — `t()` for every user-facing string, keys in both `en.ts`/
  `cs.ts` (`i18n-check`).
- **Styling** — existing `index.css` tokens/Tailwind classes, never a
  hardcoded color (`component-design`).
- **Navigation** — match the existing route/page structure under
  `pages/<area>/` rather than a new top-level layout convention.

## Project

- **File/module naming** — match the existing pattern in the directory
  you're adding to (singular vs. plural, `snake_case` vs. `kebab-case` —
  Python backend is `snake_case` throughout, frontend TS files are
  `kebab-case` for components).
- **Commands** — `uv run ...` for backend, `npm run ...` for frontend;
  don't introduce a third invocation style (a Makefile target, a shell
  script) for something one of those already does cleanly.
- **Testing** — `test_<feature>_api.py` naming, matching the router split.

## When you find an existing inconsistency

Don't silently "fix" it as a side effect of unrelated work (that's scope
creep, and a drive-by fix without full context can be wrong). Don't add a
third variant either. Name it explicitly in your report — where it is, what
the two (or more) conventions are, and let the user or a dedicated
`improve-app`/`refactoring` pass decide whether and how to converge them.
