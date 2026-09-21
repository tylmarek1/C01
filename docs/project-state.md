# Project State

This file is a **state index**, not a source of truth for requirements —
it exists so a new session doesn't have to re-derive "where are we" from
scratch. It records *what phase the project is in* and *what's evidenced*;
it does not define *what the rules are* (that's `docs/specification.md`)
or *what the course requires* (that's `docs/course/`).

**Keep this file current.** Any workflow in `.claude/workflows/` that
completes a phase, an operation, or a gate item updates this file as its
last step. If you finish work that changes the picture below and don't
update this file, the next session will start from a wrong premise.

---

## Current phase

**C01: DONE.** **C02: engineering complete, formal team sign-off
outstanding** (the one gate this repository's tooling cannot close
itself — see "Pending / open gates"). C03 has not started.

| | |
|---|---|
| C01 | **DONE** — all 15 `docs/course/C01.md` §10 items evidence-backed complete |
| C02 | Baseline v0.1 and the "approval process" change (v0.2) are both engineering-complete and evidenced; **team approval of both specification baselines is the one item still open** |
| Specification baseline | v0.2 — `docs/specification.md` (v0.1 frozen in `docs/specification-v0.1.md`) |
| Next phase | C03 (architecture) — not started; no `docs/course/C03.md` yet. This repository is otherwise ready for it to be added (see "How to add C03" below) |

## Completed gates

Evidence-backed only — each line names where the proof actually lives, not
just an assertion. Cross-referenced against `docs/course/C01.md` §10 and
`docs/course/C02.md`'s "Definice hotového" checklist; this table does not
restate those checklists, it tracks status against them.

**C01 (all 15 items, `docs/course/C01.md` §10):** complete. Evidence: PR
[#5](https://github.com/tylmarek1/C01/pull/5) merged 2026-09-14 (reviewed
by a non-author per the C01 review-cycle requirement),
`docs/evidence-and-evolution.md`'s "C01 Engineering Spike" section (all
four fields filled), `docs/intent-and-change.md` (Project Frame, all
fields filled including the Q future pressure). (Root `README.md` no
longer carries its own copy of this per-item checklist — the C01 course
checklist itself lives in `docs/course/C01.md` §10 and status against it
is tracked here, not duplicated in the product README.)

**C02 baseline v0.1 (`docs/course/C02.md`, "A. Baseline v0.1," items
1–11):** complete. Evidence: `docs/specification-v0.1.md` §1–10 (all four operations fully
specified, §6 requirement acceptance review, §7 consistency review, §5
use-case/state/activity diagrams); `backend/tests/test_spec_baseline.py`
(43 tests, all VE-01…VE-04); `docs/evidence-and-evolution.md`'s "Evidence
C02" section (success + negative/boundary run of all four operations,
commit `76c99ba`).

**C02 change "approval process" (`docs/course/C02.md` items 12–16):**
complete. Evidence: `docs/change-c02-impact.md` (impact analysis, written
*before* the spec edit — item 10 — with affected/unaffected parts
explicit — item 11); `docs/specification.md` §4 OP-05/OP-06 (fully
specified — item 12), §5.1/§5.2 (updated diagrams — item 13);
`backend/tests/test_approval_api.py` (38 tests, VE-05…VE-08 — 37 from the
v0.2 change plus VE-06.2, added in this repository's own governance pass
to close a spec↔test gap);
`docs/evidence-and-evolution.md`'s "Evidence C02" section (live run,
`change-c02-impact.md` §3 architectural drivers AD-1…AD-6 — item 16).

## Pending / open gates — needs human action, not more code

- **Team approval of both baselines is not yet given.** `docs/course/C02.md`'s
  own DoD requires the team to explicitly approve baseline v0.1 (see its
  "Definice hotového" list), and `docs/specification.md` §11 states v0.1's
  approval is a prerequisite for v0.2's. The checkboxes in
  `docs/specification-v0.1.md` §11 and `docs/specification.md` §11 are
  unticked for all four team members, and the approval date is blank in
  both. **This is the one gate a Claude session cannot close** — it
  requires the actual team to review and tick it.
  `docs/evidence-and-evolution.md`'s own "remaining assumptions/unknowns"
  section already names this same gap.
- Because of the above, item 14 of `docs/course/C02.md`'s DoD ("running
  app matches the *approved* baseline v0.2") is evidenced *behaviorally*
  (the app matches what v0.2 says) but not formally, since v0.2 isn't yet
  approved.

## Architectural drivers carried into C03

From `docs/change-c02-impact.md` §3 (full detail and code evidence there —
don't restate it here, it will drift):

AD-1 (long-lived persisted time-bounded process), AD-2 (blocking-state set
defined in four places), AD-3 (row-level serialisation is load-bearing),
AD-4 (several doors to `CONFIRMED`), AD-5 (notification delivery has no
guarantees), AD-6 (authorization beyond two roles).

## Current assumptions and unknowns

Full register: `docs/specification.md` §8 (A-01…A-06, U-01…U-04). Not
restated here — this section exists only to flag that they exist and
where, so a session doesn't have to search for them.

## Latest verification

- `cd backend && uv run pytest -v` — **177 passed** (176 baseline + one
  test added closing a spec↔test coverage gap, VE-06.2) against real
  PostgreSQL. Last run: 2026-09-21.
- `cd frontend && npm run build && npm run lint` — build and lint pass
  (per `docs/evidence-and-evolution.md`'s C02 evidence; not re-run as part
  of this pass since no frontend code changed).

## Latest evidence

`docs/evidence-and-evolution.md` — both the C01 spike section and the
"Evidence C02" section. That file is the durable evidence record; this
section just points to it.

## Latest relevant commit

`cf5df74` — `fix: make review scale with risk, not with how many skills
exist (#12)`, merged to `main`. The C02 engineering work itself landed via
PR [#9](https://github.com/tylmarek1/C01/pull/9) (merge commit `ede421d`).

---

## How to add C03

Nothing here invents C03's content — the course hasn't handed it out yet.
When it does: paste it verbatim into `docs/course/C03.md`, the same way
`docs/course/C01.md`/`C02.md` were added (root `CLAUDE.md` §0's rule
against copying course text applies to every other file, not this one).
Root `CLAUDE.md`'s routing table's "připrav mě na C03" row already checks
for this file's existence, so that row needs no edit. This file's
"Architectural drivers carried into C03" section is exactly the input C03
is meant to start from (it's the record of what C02 already flagged as an
open architectural question — read it before designing anything, don't
re-derive it). A `.claude/workflows/c03.md` can be added then, following
the same shape as `c01.md`/`c02-baseline.md`; if you add it, also add it
to the routing table's "dokonči C02" row's workflow list (currently
`c01.md` / `c02-baseline.md` / `c02-change.md`) so picking up course work
still resolves to the right file once C03 is the active phase. There's
nothing to add speculatively before the actual assignment exists.

---

## How to update this file

A workflow updates the specific section its work affects — don't rewrite
the whole file for a small change. If a gate moves from pending to
complete, move its line and add the evidence pointer. If a new phase
starts, update "Current phase" and add a "Completed gates" entry for the
phase that just finished. Don't let this file accumulate historical
narrative — that belongs in `docs/evidence-and-evolution.md` or commit
history; this file only describes *now*.
