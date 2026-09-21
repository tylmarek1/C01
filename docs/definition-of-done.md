# Definition of done: evidence-backed, not evidence-shaped

This file states one rule and how to apply it. It is not a checklist —
the checklists already exist (`docs/course/C01.md` §10,
`docs/course/C02.md`'s "Definice hotového", and each feature's own
acceptance criteria) and this file does not copy them, because a copy is
exactly the kind of second hand-maintained requirement that drifts from
the original (see root `CLAUDE.md` §0).

## The rule

**"Done" requires a pointer to concrete evidence, not a description of how
something looks.** A gate, a checklist item, or a feature is DONE only
when you can name one of:

- a file that exists with the required content (a spec section, a filled
  template field, a diagram);
- a test that passes and actually exercises the behavior in question, not
  just a function call (a happy-path test with no assertion is not
  evidence);
- a command's actual output (a test run's pass count, a build's exit code,
  a `curl`/script transcript);
- a screenshot or an executed scenario, for something no automated check
  can cover (a UI flow, per `frontend/CLAUDE.md`'s "no automated suite"
  gap);
- a commit or PR reference, for "was this reviewed/integrated";
- an explicit human sign-off, for something only a human can give (team
  approval of a specification — see below).

"It looks complete," "the code clearly does this," or "I'm confident this
works" are not evidence. If you can't point at one of the items above,
the honest status is **not done**, or **done except for X**, not done.

## What this changes about reporting status

When a workflow or a task finishes, state completion the same way:
`<item> — DONE — <evidence pointer>`, or `<item> — NOT DONE — <what's
missing and why>`. Don't round a partial result up to "done" because the
remaining piece is small — the C02 baseline is a live example: every
engineering gate is evidence-backed and closed, but the *team-approval*
gate (`docs/specification.md` §11, `docs/specification-v0.1.md` §11) is
open, and `docs/project-state.md` says so plainly rather than treating
"the spec is thorough" as a substitute for the team actually ticking it.

## A gate only a human can close

Some gates are not code, and a Claude session must not fabricate them:

- **Team approval of a specification** (`§11` of any `specification*.md`)
  is a named team member reviewing the changed/new parts and ticking their
  line. A session can *prepare* everything the approval covers (the spec
  itself, the consistency review, the evidence) but cannot tick the box on
  a person's behalf. If you find this gate open, say so in
  `docs/project-state.md` — don't check the box, don't argue it's
  effectively equivalent to done, and don't quietly drop it from a status
  report.
- Anything the course assignment (`docs/course/`) frames as a team
  decision (choosing the reserved resource, the one domain-specific rule,
  the Q/C/R/L future pressure) is the same kind of gate: a session can
  propose and draft it, but treating a draft as accepted without it being
  actually reviewed misrepresents the project's real state.

## How this is generated, not hand-copied

For C01 and C02, the actual checklist items live in `docs/course/C01.md`
and `docs/course/C02.md` — pasted verbatim from the assignment, so they
can't drift from what's graded. A workflow (`.claude/workflows/c01.md`,
`c02-baseline.md`, `c02-change.md`) walks that checklist directly and
records each item's status in `docs/project-state.md`'s gate tables, with
an evidence pointer per item. If a future course phase (C03, …) is added,
the same pattern applies: its checklist lives in `docs/course/C0N.md`,
and a new workflow walks it the same way — this file's rule doesn't
change, only which checklist it's applied to.

## Mechanical backing

Where a gate item can be checked by a command instead of by reading, use
the command and quote its actual output as the evidence (`uv run pytest
-v`'s pass count, `npm run build`'s exit code) rather than paraphrasing
"tests pass." `.claude/scripts/check-project-state.sh` (see root
`CLAUDE.md`) does this for the structural parts of this system itself —
that referenced docs/files actually exist — but it cannot and does not
check requirements content; only reading against `docs/course/` does
that.
