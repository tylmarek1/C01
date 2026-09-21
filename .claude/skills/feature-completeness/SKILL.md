---
name: feature-completeness
description: Trace a specific Courtly (C01) feature end-to-end (database → backend → API → frontend → tests → docs) to find a layer that's missing, inconsistent, or left behind — a backend endpoint with no frontend consumer, a new state old UI doesn't understand, a form with a loading state but no error state. Use after implementing a feature (feature-development Step 6) and whenever asked "is X actually done/complete."
---

# Is this feature actually whole?

`self-review` reads your diff. This skill reads the **feature**, whether or
not it was just touched — it can find gaps that were left behind rounds
ago, not only in the current change. It's the same full-stack trace
`feature-development` builds forward from a user action
(user action → frontend → API → validation → authorization → business
logic → database → response → frontend state → UI feedback → tests) — this
skill walks it backward from the data model outward, which is the more
natural direction when the feature already exists and you're checking it,
not building it.

## Trace the path

Pick the feature/resource and walk every layer it should have, in this
order:

1. **Database** — does the model have every field the feature needs? Is
   there a field that exists but nothing validates or uses?
2. **Backend logic** — does `lifecycle.py`/`rules.py`/a service module
   actually enforce every rule the feature implies, or does an endpoint
   skip a check a sibling endpoint has?
3. **API** — does every state/field the model can hold have a corresponding
   way to read/act on it via the API? A `ReservationStatus` value with no
   endpoint that can transition into or out of it is a dead state.
4. **Frontend consumption** — for every backend endpoint relevant to this
   feature, grep `frontend/src/lib/api.ts` and the pages/components: is it
   actually called anywhere? An endpoint with zero frontend call sites is
   either dead code or a half-shipped feature.
5. **UI state coverage** — for each consuming component: does it handle
   loading, empty, error, and success, or only the happy path? (Check
   against `accessibility-responsive`'s state checklist.)
6. **Stale consumers of new states** — if a new enum value or field was
   added to an existing concept, grep every place that already branches on
   that type (a `switch`/`if` chain, a label lookup like
   `reservation-status.ts`'s `STATUS_VARIANT`) and confirm it handles the
   new case rather than falling through to a default that doesn't fit.
7. **Tests** — does the critical path (the thing a user actually does, not
   just each function in isolation) have a test, or only the individual
   pieces?
8. **Docs** — is the feature's existence and scope reflected anywhere it
   should be (see `update-docs`), or does it only exist in code?

## Report

For each gap found:
```
Layer: <database/backend/API/frontend/tests/docs>
Feature: <what>
Gap: <the specific missing/inconsistent piece>
Consequence: <what a user or developer hits because of it>
```

Distinguish a gap that's **required to consider the current task done**
(fix it) from one that's **pre-existing, found while looking, unrelated to
the current change** (flag via `improve-app`'s classification, don't scope-
creep into fixing it now unless it's trivial and directly adjacent).
