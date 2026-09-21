---
name: polish
description: Take an already-working Courtly (C01) feature or area from "works" to "feels professionally built" — UX friction, visual consistency, error/edge-case handling, small backend inconsistencies. Use for requests like "make notifications feel production-ready," "polish the booking flow," "make this better" when aimed at a specific existing feature (not the whole app — see improve-app for that).
---

# Polish: works → feels professionally built

This skill is scoped to a specific feature/area someone names or that's
obviously implied ("polish the booking flow," "make notifications feel
production-ready"). For a whole-application audit, use `improve-app`
instead — don't run a full-app pass when the request names one feature.

A feature passing `finish-task`/`self-review` means it's correct. It
doesn't mean using it feels good. This skill inspects the named area
through four lenses and produces concrete, implementable fixes — then
implement the ones worth doing (see "scope the response" below).

## UX

- Walk the actual user flow, not the code. How many clicks/steps does
  something take versus how many it should? (E.g., does confirming a
  reservation require navigating away and back, when it could be inline?)
- Is there feedback after every action (a toast, a visible state change),
  or does something succeed silently?
- Are labels/microcopy clear, or do they read like internal names leaking
  through ("PENDING" shown verbatim instead of a human label — check
  `reservation-status.ts`'s `useStatusLabels()` pattern is actually used
  everywhere this status renders)?
- Is the information hierarchy right — is the thing the user cares about
  most (the next action, the most relevant status) visually primary, or is
  everything the same weight?
- Confusing states: does the UI ever show something a user can't act on
  without knowing why (a disabled button with no explanation)?

## UI

- Spacing/alignment consistent with sibling components in
  `components/shared/`? Reuse the existing patterns (`component-design`)
  rather than introducing slightly-different spacing for "this one area."
- Typography hierarchy matches how similar screens use it (heading weights,
  sizes) — check a comparable existing page.
- Responsive behavior actually checked at mobile width, not just assumed
  fine (`accessibility-responsive`).

## Backend

- Inconsistent error messages for the same class of failure across
  endpoints in this feature area (`consistency`).
- Duplicated logic that should call one existing helper.
- Missing validation on an edge case a user could actually hit (not a
  theoretical one — ground this in the feature's real usage).
- A query that could be simpler/cheaper without changing behavior
  (`performance-review`).

## Engineering

- Is the polished behavior covered by a test, or does the improvement live
  only in what you eyeballed once?
- Does a UX/copy change make a doc/screenshot in `docs/` stale
  (`update-docs`)?

## Scope the response

List what you found using the four lenses above, then implement the ones
that are genuinely small, low-risk, and clearly improve the named feature —
that's what "polish" means. If a finding is actually a bigger redesign or a
new capability, don't fold it in silently; name it as a separate,
larger-scope idea (point to `improve-app`/`feature-development` for that)
rather than turning a polish pass into a rewrite.

## Verify

Run `finish-task` and `accessibility-responsive`'s manual-verification
checklist on the changed area before reporting done — a polish pass that
wasn't actually looked at in the browser is just a guess.
