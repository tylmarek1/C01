---
name: improve-app
description: Structured audit of Courtly (C01) for requests like "improve the app," "make this more professional," "find weaknesses," "what should we add," or "find technical debt." Inspects product, backend, frontend, and engineering, and reports findings categorized by impact/effort/risk rather than a ranked best/worst list. Also the home for the lighter "does this task expose an obvious follow-up" check used mid-feature-work.
---

# Improving Courtly

This skill has two modes. Pick the one matching the request; both share the
same underlying inspection.

## Mode A — full audit ("improve the app," "find weaknesses," "what should we add")

Actually inspect the current code before reporting anything — don't produce
generic advice. Go through each lens below, note concrete findings (file/
location, not vague description), then report using the format at the end.

### Product
- Read `docs/intent-and-change.md`'s domain frame, then compare it to
  `backend/src/reservations/api/` and `frontend/src/pages/` — what's
  documented as intended that isn't built, and what's built that isn't
  documented (see also `update-docs`)?
- Walk the reservation lifecycle end to end (`PENDING → CONFIRMED →
  CHECKED_IN → COMPLETED`, or cancel/expire/no-show paths) — any state with
  thin or missing frontend affordance (nothing shows a `CHECKED_IN`
  reservation differently, an `EXPIRED` hold has no explanation shown to the
  user, etc.)?
- Missing feedback: does every mutation (book, cancel, confirm, join-request,
  review) produce a toast/visible confirmation, or do some silently succeed?

For any proposed new capability (not a fix to something existing), answer
before including it: *why* does this belong in Courtly specifically, *what*
existing user journey does it improve, *where* does it fit in the current
navigation/domain, and *what existing concept* can it reuse? A weak answer
to any of these means don't propose it — this is what keeps ideas grounded
instead of generic ("add gamification," "add a mobile app").

### Backend
- Re-run `architecture-review`'s lens across `api/` — any router with logic
  that belongs in a service module instead?
- Any endpoint missing an ownership check (`self-review`'s security section)?
- Any business rule duplicated between `rules.py`/`booking_validation.py`
  and a frontend-side check instead of being the single source of truth?

### Frontend

**Scope the sweep to the request.** "Improve the app"/"find weaknesses"
(whole-app) or "improve the frontend"/"improve all pages"/"make the
frontend much better" (whole-frontend): walk **every** route under
`pages/{landing,auth,app,courts}/`, not a sample — the point of those
requests is application-wide coherence, and sampling defeats it. A request
naming one feature/page: check that one area only (and consider whether
`polish` fits better than a full audit).

For a whole-frontend sweep, go through each surface once across all pages
rather than one pass per page: navigation/layout consistency
(`app-layout.tsx`/`navbar.tsx` used everywhere it should be), forms (do they
all follow the same controlled-input + inline-validation shape —
`api-integration`), tabular/list data (no shared table primitive exists —
`AdminPage.tsx` uses CSS grid layouts ad hoc; is a new one about to
duplicate that ad hoc-ness a third time?), dialogs (`dialog.tsx` reused, not
reinvented), notifications (`notifications-bell.tsx`'s pattern), filters and
pagination (if any page has grown enough data to need them and doesn't),
loading/empty/error states (every page, not a sample — see above), mobile
layout at each page, typography/spacing/color consistency against
`index.css`'s tokens, icon usage (`sport-icon.tsx`/`lucide-react` used
consistently vs. ad hoc), and interaction-pattern consistency (does
"confirm before destructive action" exist everywhere it should — a shared
`components/shared/confirm-dialog.tsx` primitive exists, wired into cancel
reservation, remove guest, delete review, and delete facility block; check
any *new* destructive action against it before adding a bare onClick).

- Check `frontend/src/locales/en.ts` size/coverage against pages added since
  — any page you can find with a literal string not going through `t()`?
- Routes are code-split (`App.tsx` uses `React.lazy` per page, with a
  `Suspense` boundary in `app-layout.tsx` around `<Outlet />`) — the
  previous >500kB single-chunk warning is fixed; a *new* page should stay
  lazy-loaded rather than added as an eager import.

Prefer consolidating a repeated pattern into `components/shared/` over
listing the same finding once per page it appears on — "this markup is
duplicated across 4 pages" is one finding with one fix, not four.

### Engineering
- Tests: which backend feature areas have thin test files relative to their
  route count in `api/`? Frontend has zero automated tests — note this once,
  don't repeat it as a finding on every audit.
- Docs: is `README.md`'s Definition-of-Done/test-count/endpoint list still
  accurate, or has it drifted further since the last check?
- Tooling: still no CI, no committed lint config, no Alembic — these are
  known (see root `CLAUDE.md`'s "Known gaps"), only re-surface them if
  something you found makes one of them newly costly.

### Report format

For each finding:

```
[Impact: low/med/high] [Effort: low/med/high] [Risk: low/med/high]
Where: <file/area>
What: <the concrete gap>
Why it matters: <consequence if left alone>
Possible direction: <a concrete way to address it, not just "fix it">
Dependencies: <anything that must happen first, or "none">
```

If the request scopes to one stack ("improve the frontend," "improve the
backend"), still walk every lens briefly — a frontend problem sometimes
traces back to a backend cause — but weight the report and any selected
action toward the named stack.

No best/worst ranking, no top-5 — list everything genuinely worth surfacing
and let impact/effort/risk speak for itself. If asked for "ideas" rather
than "an audit," present the Product-lens findings as grounded feature
ideas instead of debt items, but keep them tied to what you actually
inspected — never generic ("add gamification," "add a mobile app") unless
it's a direct, specific extension of something that already exists here.

### Update the capability map

After a full Mode A audit (not the lightweight Mode B check), update the
relevant rows in `docs/capability-map.md`: a status that changed (Weak →
Strong once something's fixed, or a newly-discovered Weak/Missing), and
one line per new finding under its Backlog section. Targeted edits only —
same discipline as `docs/codebase-map.md`'s own "Keeping this current,"
not a rewrite. This is what makes findings compound across sessions
instead of living only in a chat reply that's gone by the next one.

### Then: act, when the request was action-oriented

"Improve the app" and "find weaknesses" are different asks. If the request
was action-oriented ("improve the app," "make this more professional"
— as opposed to "what should we add" / "find weaknesses," which are asking
for the list itself):

1. **Select a coherent, bounded scope** from the findings — a small set that
   fits together (e.g. "loading/empty/error state coverage across every
   page missing them" is coherent; "fix 12 unrelated things across the
   whole app" is not a single change). Weigh findings by user impact,
   frequency of use, severity, correctness/security first, then
   architectural leverage, performance, and maintainability — against
   effort and risk. Say which findings you're acting on and which you're
   leaving as reported-only, and why.
2. **Implement** the selected scope via `feature-development` (for new
   capability) or `polish`/`refactoring` (for elevating/restructuring
   existing code) — don't hand-implement ad hoc outside those skills'
   discipline.
3. **Validate** with `finish-task` and `self-review` before reporting done.

Don't silently implement everything you found — a bounded, explained scope
beats a sprawling unrequested rewrite. If the audit surfaced far more than
fits one coherent change, report the full list and implement only the
clearest, smallest high-value slice, naming the rest as follow-up.

## Mode B — the lightweight check used inside other skills

`feature-development`'s Step 7 uses this same classification vocabulary
without a full audit:

- **Required for current task** — part of doing the task properly, fix now.
- **Valuable improvement** — real, but not required for the current ask;
  report it, don't implement it unprompted.
- **Future idea** — one sentence, no more.
- **Overengineering** — don't do it, don't suggest it as if needed.

This mode never triggers a full audit — it's a one-line classification of
something you happened to notice, not a reason to switch tasks.
