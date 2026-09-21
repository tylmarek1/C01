# Courtly (C01) — root CLAUDE.md

Courtly is a sports-court reservation system (tennis/volleyball/badminton).
It started as the **SWI** course's engineering-spike deliverable ("C01") and
was then expanded, at the team's own initiative, into a much fuller
product-style app. Team: VTG Courts (Adam Vrána, Marek Tyl, Josef Glogar,
Adam Mikoláš).

This file holds rules that apply regardless of which half of the repo you're
touching. Backend-specific and frontend-specific rules live in
`backend/CLAUDE.md` and `frontend/CLAUDE.md` — read the one that matches
what you're changing before you start. Don't duplicate those here.

**Operating principle:** the prompt is intent, the repository is context, the
skills are method, you provide judgment, the implementation is the result.
A short, high-level request ("add notifications," "make the frontend much
better") is not underspecified — it's normal. Investigate before asking;
decide what's inferable from the codebase yourself; ask only when a
decision is genuinely product-defining and the repository doesn't answer
it (see `feature-development`'s Step 1 for the line between the two).

## 0. Read this first: docs and code have diverged

`README.md`, `backend/README.md`, `frontend/README.md`, `docs/*.md` and
`cviko1/todo.md` all describe the project as it stood on **2026-09-14**: a
3-state reservation flow (`DRAFT → CONFIRMED → CANCELLED`) with only
auth + courts + reservations. The actual code on `main` today is well past
that — a 7-state lifecycle (`PENDING → CONFIRMED → CHECKED_IN → COMPLETED`,
or `→ CANCELLED/EXPIRED/NO_SHOW`), a dozen backend routers, a full admin
panel, i18n, achievements, reviews, waitlists, and 90+ tests, none of it
reflected in prose anywhere.

**Rule:** for "what currently exists," trust `backend/src/` and
`frontend/src/` over any README or doc. Treat `docs/intent-and-change.md`
(the Project Frame) and `docs/architecture-and-decisions.md` (the ADRs) as
binding *decisions* that are still accurate for what they cover, just silent
on everything added later — not as an outdated feature inventory to correct
wholesale. When a doc and the code disagree on a fact (an endpoint list, a
state name, a test count), the code is right; fix the doc opportunistically
(see the `update-docs` skill) rather than trusting the doc's prose.

## Repository layout

```
docs/intent-and-change.md           Project Frame (domain, states, rules) — graded, still accurate as decisions
docs/architecture-and-decisions.md  ADR-000..003 — stack choice, exclusion-constraint design, repo split, JWT auth
docs/evidence-and-evolution.md      the executed C01 spike write-up (persistence + concurrency evidence)
backend/                            FastAPI app — see backend/CLAUDE.md
frontend/                           React app — see frontend/CLAUDE.md
cviko1/todo.md                      historical C01 Definition-of-Done checklist, not an active backlog
docker-compose.yml                  single `db` service (Postgres 16) shared by both apps
```

## Stack overview

| | Backend | Frontend |
|---|---|---|
| Language | Python 3.12 | TypeScript |
| Framework | FastAPI + SQLAlchemy 2 | React 19 + Vite |
| Package manager | `uv` | `npm` |
| Data | PostgreSQL 16 (psycopg 3) | TanStack Query over a hand-written fetch client |
| Styling | — | Tailwind CSS 4 (CSS-first config) + Radix + shadcn-style components |
| Tests | pytest + httpx, against real Postgres | none exist yet (see frontend/CLAUDE.md) |
| Lint | not configured (a stray `.ruff_cache` is the only trace of ruff) | `oxlint`, default rules |

There is **no CI/CD and no Alembic migrations** anywhere in this repo.
That's the real current state, not an oversight for you to silently fix —
see "Known gaps" below. There is one narrow pre-commit hook (blocks commits
on `main`, see "Git workflow" below) plus the existing ruff-format
post-edit hook — neither is a substitute for CI.

## Cross-cutting architectural rules

- **Two toolchains, never mixed.** Backend is `uv`, frontend is `npm`
  (ADR-002 split them into separate directories on purpose so this stays
  unambiguous). Don't propose unifying them or running one from the other's
  directory.
- **PostgreSQL is load-bearing, not an implementation detail.** The "no
  double-booking" rule is enforced by a Postgres exclusion constraint
  (`no_overlapping_active_reservations`, see backend/CLAUDE.md), not by
  application code. Never suggest mocking or swapping the database, or
  moving the overlap check into Python "for simplicity" or "to make tests
  faster" — that would silently remove the actual concurrency guarantee
  ADR-001 exists to provide. Tests run against real Postgres for the same
  reason; that's deliberate, not a gap.
- **No migrations.** `backend/src/reservations/db.py` only has
  `create_all`/`drop_all`. This has a specific, easy-to-miss failure mode —
  full details and the exact recovery command are in `backend/CLAUDE.md`;
  read it before changing an existing model.

## How to approach a change

1. **A high-level request ("add notifications," "improve reservations," "add
   an admin module") is not an instruction to start editing files.** Use the
   `feature-development` skill — it drives understand → impact → design →
   implement → verify → review → improvement-check, and points to the more
   specific skills below at each step. Investigate the repository yourself
   before asking a clarifying question; only ask when a genuine product
   decision can't be inferred from the codebase.
2. **Find the real current code first**, don't assume a README describes it
   (see §0). Look for an existing analogous pattern before introducing a new
   one — use the `architecture-review` skill before adding a new
   module/file. This codebase already has conventions for most things;
   match them instead of inventing a parallel way to do the same thing.
3. For a non-trivial or ambiguous request, briefly restate the scope you
   understood before making sweeping multi-file edits.
4. Implement, then verify — see "Definition of done" below. Never report a
   change as complete with a failing test or a broken build.
5. **A meaningful change owns its own Git lifecycle by default** — branch,
   commit, push, PR, merge. You do not need to be asked for any of these
   individually; see "Git workflow" below and `finish-task`, which drives
   this lifecycle after implementation. The one thing that still needs an
   explicit ask is a **destructive** git action (force-push, `reset --hard`,
   deleting someone else's branch) — see the Environment's own Git Safety
   Protocol for what counts.

A request to *improve*, *audit*, or *find weaknesses in* the app (rather
than build something specific) is a different workflow — use `improve-app`,
which inspects the actual product/backend/frontend/engineering before
reporting anything, rather than producing generic suggestions.

## Definition of done

Two distinct passes, both before calling non-trivial work done:

- **`finish-task`** — the mechanical pass: picks the right test/build/lint
  commands for what you actually changed and confirms they pass. This repo
  has no CI, so this is the closest thing to one.
- **`self-review`** — the qualitative pass: reads the diff for correctness,
  architecture fit, security, performance, tests, UX, docs, and unnecessary
  changes.

For a review beyond your own, the built-in `/code-review` skill also works;
point it at the same risk areas `self-review` covers (the reservation state
machine, the exclusion constraint, timezone comparisons, hand-written
frontend types drifting from backend schemas, incomplete i18n).

**If a review step finds a problem within the current task's scope, fix it
before reporting done — don't just list it.** "I found this but left it" is
only the right answer when the fix is genuinely out of scope, too large to
do safely right now, or itself needs a product decision — say which, don't
default to reporting over fixing.

## Known pitfalls (grounded in real bugs, not hypothetical ones)

Every entry here has actually bitten this codebase once. Skills reference
this list rather than re-explaining each bug from scratch — if you find
yourself about to write a paragraph re-deriving why one of these matters,
link here instead.

1. **Naive UTC vs. venue-local time.** Comparing a wall-clock hour/minute
   directly against the `Europe/Prague` opening-hours rule rejected valid
   bookings from browsers in other offsets. Fix: `astimezone(VENUE_TZ)`
   before any hour/minute comparison. Regression-tested; don't reintroduce
   a naive comparison. (`backend/CLAUDE.md` §Timezones)
2. **i18n treated as "mostly done."** Pages have shipped with static
   English label maps and untranslated toasts because i18n coverage was
   treated as gradual. A page is complete-or-nothing: every string routed
   through `t()` before the page is considered finished, not deferred as
   "minor." (`i18n-check`)
3. **Frontend-only business-rule enforcement.** A lead-time check existed
   only in the booking UI, not the backend, and was caught by manual
   testing, not a review. A client-side check is a UX nicety; the backend
   (`rules.py`/`booking_validation.py`) is the only enforcement that counts.
   (`api-integration`, `security-review`)
4. **The exclusion constraint's status list going stale.** Adding a new
   reservation status that should still hold a court, without adding it to
   `no_overlapping_active_reservations`'s `WHERE status IN (...)` clause,
   silently removes double-booking protection for that status.
   (`database-evolution`)
5. **`create_all` doesn't alter existing tables.** A column/enum change on
   an existing table looks like it worked (no error) but the dev database
   silently doesn't have it until the manual drop/recreate/reseed cycle
   runs. (`database-evolution`)

If you discover a new one of these while working, decide where it belongs
using the next section, and add it here only if it's genuinely a durable
trap — not every bug fix earns an entry.

## Where a new rule belongs — strongest enforcement wins

When you learn a new project-specific constraint (including one of the
traps above, or one you just found), prefer the strongest mechanism that
can actually enforce it, in this order:

```
mechanically enforceable (a lint rule, a type, a DB constraint, a hook)
        >
a skill's explicit instruction (loaded when relevant, actionable)
        >
CLAUDE.md prose (loaded always, costs attention forever)
        >
docs/README (reference material, not loaded automatically)
```

A rule a linter or the type system can enforce shouldn't live only as prose
someone has to remember. A rule that's only relevant to one kind of task
(e.g. "sweep for references before renaming a field") belongs in the skill
for that task, not in CLAUDE.md where it's dead weight on unrelated work.
CLAUDE.md prose is for constraints that are both durable *and* apply broadly
enough that every session needs them regardless of task. Don't invent
automation for its own sake — the `.claude/settings.json` ruff-format hook
exists because it was cheap and genuinely useful, not because "more
automation" is a goal in itself.

## What belongs in CLAUDE.md (and what doesn't)

This file and the two below it load into **every** session on this repo —
they cost attention forever, so they only get durable constraints that would
silently break something if violated (a trap, an invariant, a "the tool
won't warn you" gap). Feature history, "we added X," and session narration
do **not** belong here — that's what commit messages and PR descriptions are
for. If you're about to add a sentence describing what a feature does rather
than a rule about how to safely change something, it probably belongs in a
README or docs file instead (see the `update-docs` skill).

## Git workflow (default, not optional)

`main` is protected by convention, and a hook backs that up mechanically
(see below): **never develop directly on `main`.** For any meaningful
change, the default lifecycle is:

```
branch → implement → verify (finish-task) → review (self-review) →
docs/changelog → commit → push → PR (gh) → merge → cleanup
```

Drive this yourself; the user shouldn't have to separately ask for a
branch, a commit, a push, or a PR — `finish-task` owns Steps after
implementation. Details:

- **Branch from `main`** (`git fetch origin && git checkout -b <type>/<short-desc>
  origin/main`) before touching files. Name it `feat/…`, `fix/…`,
  `refactor/…`, `perf/…`, `docs/…`, or `chore/…` per Conventional Commits.
  One logical task per branch.
- **Commits**: Conventional Commits style (`feat: …`, `fix: …`, `refactor:
  …`, `test: …`, `docs: …`, `chore: …`, `perf: …`), explaining *why* not
  restating the diff. Commit once the change verifies cleanly, not every
  intermediate edit.
- **Push and open a PR** with `gh pr create` once verification passes —
  this repo's remote is GitHub (`tylmarek1/C01`), not GitLab, so `gh` is
  the tool, not `git push` alone. PR description: what changed, why,
  affected areas, tests/validation run, notable decisions, risks — see
  `finish-task` for the exact template.
- **Author ≠ reviewer** in spirit — if nothing else can review it, run the
  built-in `/code-review` skill against the branch before merging, don't
  self-certify silently.
- **Merge** with `gh pr merge` once checks/review are satisfied. This repo
  has no CI, so "checks satisfied" means `finish-task`'s own verification
  already passed on the branch — don't treat the absence of CI as license
  to skip that. Never merge a change you know is broken.
- **Cleanup** — delete the merged branch (`gh pr merge --delete-branch`, or
  `git branch -d`/`git push origin --delete` after merge) and sync local
  `main`.
- A **destructive** git action — force-push, `reset --hard` past the last
  push, deleting a branch that isn't the one just merged — still needs an
  explicit ask; it's the one thing this default lifecycle doesn't cover
  autonomously.

A pre-commit hook (`.claude/hooks/guard-main.sh`) mechanically blocks `git
commit`/`git push` while `main` is checked out, so forgetting to branch
fails loudly instead of silently landing on `main`.

## Security baseline

Auth is stateless JWT (HS256) + bcrypt password hashing (see
`backend/CLAUDE.md` for specifics). `SECRET_KEY` has an insecure default
fallback — that's a deliberate, documented local-dev convenience (ADR-003),
not a bug to "fix" by hardcoding a different secret; flag it if you're ever
asked to prepare this for anything beyond local development. Never log
tokens, passwords, or password hashes.

## Known gaps — flag, don't silently fix

No CI, no Alembic, no generated frontend API types, no frontend test suite.
These are real, current, and known (several are explicitly named in
`cviko1/todo.md`'s own "nice to have" list). If closing one of these would
genuinely help the task you're doing, propose it and say why — don't
silently add a new dependency, config file, or pipeline as a side effect of
an unrelated change.

## Skills available in this repo

Skills live at three levels — Claude Code discovers them per-directory, most
specific wins, so a skill under `backend/.claude/skills/` or
`frontend/.claude/skills/` applies when you're working in that half of the
repo; the ones below apply everywhere.

| Skill | Use it when |
|---|---|
| `feature-development` | Any "add X" / "change X" request — the default entry point, classifies the change and drives the rest |
| `architecture-review` | Before adding a new module/file — does something existing already own this? |
| `finish-task` | Before declaring any non-trivial change done — picks the right checks to run, then owns commit → push → PR → merge → cleanup |
| `self-review` | Before declaring any non-trivial change done — qualitative diff read |
| `feature-completeness` | After implementing a feature, or "is X actually complete" — traces the whole feature end-to-end, not just the diff |
| `consistency` | Before adding a new endpoint/component, or asked to review consistency — follow existing conventions, flag drift rather than adding a third variant |
| `improve-app` | "Improve the app," "find weaknesses," "what should we add," "find technical debt" — whole-application audit, can select a scope and implement it |
| `polish` | "Make X feel production-ready," "polish X" for a **named** feature/area — works → feels professionally built |
| `production-readiness` | "Make the application production-ready," "is this ready to ship" — blocking/important/nice-to-have gate |
| `schema-change-sweep` | Adding, renaming, retyping or removing a model field/table, a Pydantic schema, or a hand-maintained frontend type |
| `security-review` | Adding an endpoint/role logic, or asked to review/improve security |
| `performance-review` | Adding a data-heavy endpoint/page, or asked to review/improve performance |
| `refactoring` | Any "refactor/clean up/restructure" request |
| `versioning` | Deciding whether a change is breaking, bumping the version, and keeping backend/frontend/docs in step |
| `update-docs` | After a change that could make a README, `docs/*.md`, or `CHANGELOG.md` wrong |

Backend-only (`backend/.claude/skills/`): `api-design`, `database-evolution`,
`backend-testing` — see `backend/CLAUDE.md`.

Frontend-only (`frontend/.claude/skills/`): `component-design`,
`api-integration`, `accessibility-responsive`, `i18n-check` — see
`frontend/CLAUDE.md`.

**Skill system governance.** These are tools, not bureaucracy — don't invoke
every skill for every change (`feature-development`'s Step 0 exists
precisely to avoid that). Before adding a new skill, check whether an
existing one already covers the problem with a small addition instead; this
list grew by strengthening existing skills far more often than by adding
new ones, and should keep growing that way. Before adding an instruction
anywhere, run it through "Where a new rule belongs" above — most new
knowledge should extend a skill, not this file.
