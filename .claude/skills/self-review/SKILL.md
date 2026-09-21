---
name: self-review
description: Read your own diff on Courtly (C01) for correctness, architecture fit, security, performance, tests, UX, docs, and unnecessary changes — before calling non-trivial work done. Use after implementing a change and before finish-task's mechanical checks; this is the qualitative "is it good" pass, not the "does it run" pass.
---

# Review the diff, not your intent

`finish-task` checks that tests/build pass. This skill checks that the
change is actually good — read the diff as if reviewing someone else's PR,
not from memory of what you meant to do.

## Correctness

- Does the diff do what was asked, on the actual current code (not the stale
  docs' version of it — see root `CLAUDE.md` §0)?
- Any reservation-state or booking-rule change: re-check against
  `lifecycle.py`'s legal transitions and `rules.py`/`booking_validation.py`'s
  constraints. A change that's locally correct but skips a rule everywhere
  else respects is a regression.
- Any time-based logic: converted to `VENUE_TZ` before comparing, per
  `backend/CLAUDE.md`'s timezone section? Naive UTC comparisons have broken
  this app before.

## Architecture

- Re-run the relevant `architecture-review` questions if a new
  module/file/abstraction was added — does the diff actually follow an
  existing pattern, or does it quietly introduce a second way to do
  something the codebase already does one way?
- Any duplicated logic that should have called an existing helper
  (`notify()`, an existing query pattern, an existing validation function)?

## Security

- New endpoint: does it depend on `get_current_user` (or
  `get_current_manager` for manager-only actions)? Does it check ownership
  (a player can only touch their own reservation/favorite/review, not
  anyone's by guessing an id)?
- Any new raw SQL/`text()` usage? This codebase relies on the ORM and
  parameterized queries almost everywhere — a new string-built query is a
  red flag, check the `security-review` skill.
- Any secret, token, or password logged, echoed in an error message, or
  committed in a config default beyond the existing documented
  `SECRET_KEY` dev fallback?

## Performance

- A new endpoint that lists/aggregates: does it query once and iterate in
  memory (the existing pattern — see `admin.py`'s utilization endpoint), or
  does it query inside a loop? See the `performance-review` skill for what
  "once and iterate" looks like here.

## Tests

- Is the new/changed behavior actually covered by a test, not just
  exercised manually once? A bug fix without a regression test will come
  back — this project's timezone bug is exactly why that test exists.

## UX / frontend

- New user-facing text: routed through `t()` with real EN+CS content?
  (`i18n-check`)
- New color/style: using existing `index.css` tokens, not a hardcoded value?
- Does the change leave behind an inconsistent state — a loading state with
  no spinner, an error with no toast, a list with no empty state — compared
  to how sibling pages/components already handle it?

## Docs

- Did this change make a README/`docs/*.md` claim wrong? Fix it or flag it
  (`update-docs`) — don't leave it more wrong than you found it.

## Diff hygiene

- Is every changed line actually related to the request? Strip incidental
  reformatting, unrelated renames, or "while I was here" cleanups that
  weren't asked for and aren't required — flag them separately if they're
  genuinely worth doing (see `improve-app`), don't fold them in silently.
- Is the diff the smallest change that correctly implements the request?

## Adversarial pass (High-risk changes only)

For anything root `CLAUDE.md`'s "Review depth matches risk" table calls
High-risk (reservation concurrency/the exclusion constraint, auth/
authorization, a `lifecycle.py` transition, a database schema/migration
change, a large cross-layer change), do one more pass after the checklist
above: reviewing your own just-written code shares your own blind spots,
so a checklist alone doesn't force a genuine second look. Adopt three
hostile perspectives in sequence, and require **at least one finding from
each** — if a persona finds nothing, that means look again, not that the
diff is clean:

- **Saboteur** — how does this break in production? Bad input, a
  concurrent request, a resource leak, a crash mid-operation.
- **New Hire** — could someone unfamiliar with this code understand it in
  under three file-hops, six months from now, with no memory of why it's
  shaped this way?
- **Security Auditor** — walk the trust boundaries this diff actually
  touches (see this skill's own Security section) as if you didn't write
  the ownership/validation logic yourself.

A finding two personas independently raise is a stronger signal than one
only one persona caught — weight it accordingly in what you fix now versus
flag. This is a technique, not a new review layer to reach for by
default — it only applies at the High-risk tier above; don't run it on an
ordinary feature or bugfix.

## Report

List what you checked from the sections above that were actually relevant to
this diff (not every section applies to every change), and call out
anything you found and fixed, or found and are flagging instead of fixing.
