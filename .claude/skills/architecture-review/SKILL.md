---
name: architecture-review
description: Decide whether new Courtly (C01) functionality fits an existing module or genuinely needs a new one, before writing code. Use before adding a new backend module/service file, a new frontend page area, or any "add a module for X" request — prevents both jamming unrelated logic into an existing file and fragmenting the codebase into one-off parallel mechanisms.
---

# Does this fit the current architecture?

Courtly's backend is a flat, feature-module layout (one file per concern);
the frontend is `pages/<area>/` + a shared `components/shared/` reuse
layer — see `docs/codebase-map.md` for the full map, not repeated here.
There is no plugin system, no
dependency-injection framework, no microservice boundary — "architecture"
here means: does this belong in an existing file, a new file next to
similar ones, or does it change a cross-cutting concern (`lifecycle.py`,
auth, the exclusion constraint)?

If the answer to question 4 below is "yes, this genuinely needs a new
file/module," that's exactly the kind of change `docs/codebase-map.md`
should reflect — a one-line addition to the relevant table, not a new
document.

## Questions to answer before adding a new module/file

1. **Does an existing module already own this responsibility?** Grep for the
   closest existing concept. A new "penalty" rule probably belongs next to
   `check_no_show_penalty` in `booking_validation.py`, not a new
   `penalties.py`. A new kind of background job belongs in `worker.py`'s
   tick, not a second scheduler.
2. **Can an existing abstraction be reused instead of a parallel one?** E.g.
   `Notification`/`NotificationType` already exists — a new "tell the user
   something happened" feature should add a `NotificationType` value and use
   `notifications.py`'s `notify()`, not invent a second notification path.
3. **Would this introduce coupling that doesn't already exist?** If the
   feature would require a router to import deeply from another router
   (rather than from a shared service module), that's a sign the shared
   logic belongs in a service module both routers can call, not in either
   router directly.
4. **Does this genuinely need a new file?** A new file is justified when the
   concept is a distinct, non-trivial responsibility (the existing
   `achievements.py`/`waitlist_service.py`/`calendar_export.py` split is the
   precedent — each is a real feature with its own logic, not a grab-bag).
   It's not justified for a single helper function — put that next to its
   one caller or in an existing module with related helpers.
5. **Does the data model need to change, and is that change additive or
   structural?** An additive new table is cheap here (no Alembic needed,
   just a reseed). A new column/enum on an *existing* table is not free —
   see the `database-evolution` skill before deciding this is a small change.
6. **Does the API boundary make sense?** A new resource gets its own router
   only if it's independently addressable (has its own id, its own
   CRUD-ish lifecycle). A new sub-behavior of an existing resource (like
   "confirm" or "cancel" on a reservation) is a new endpoint on the existing
   router, not a new one.
7. **Does the frontend need a corresponding boundary?** A new backend
   resource usually wants its own `pages/<area>/` entry or a clearly-scoped
   addition to an existing page — not scattered logic bolted onto an
   unrelated page because it was convenient.

## What to avoid

- Don't create a new top-level module for something that's really a rule
  variant, a new enum value, or a new field — extend the module that owns
  that concept already.
- Don't reach into another feature's internals (e.g. a new feature querying
  `Reservation` directly with ad hoc filters instead of reusing an existing
  query helper) when a shared helper should be extracted instead.
- Don't add a registry/plugin/strategy-pattern abstraction for something
  that currently has one or two concrete cases — the achievements catalog
  (`achievements.py`'s `ACHIEVEMENTS` list) is the one place in this
  codebase that pattern is actually earned; don't reach for it by default.

## How to use this in practice

Answer the seven questions above in a sentence or two each before writing
the new module/file. If every answer points to "reuse/extend," don't create
something new. If the answers genuinely point to a new file, say so plainly
in your report along with which existing pattern it follows.
