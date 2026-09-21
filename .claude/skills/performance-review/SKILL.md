---
name: performance-review
description: C01-specific performance checklist — real, currently-verified findings (frontend bundle size) plus what to check when adding a new aggregation endpoint or list view, grounded in Courtly's actual code rather than generic advice. Use when adding a data-heavy endpoint/page, or when asked to review/improve performance.
---

# Performance review, grounded in Courtly's actual code

## Backend: query patterns

The existing aggregation endpoints (`admin.py`'s court-utilization heatmap,
`stats.py`'s leaderboard) already follow the right shape: **one query,
iterate the results in memory** (`for reservation in db.scalars(stmt): ...`)
rather than querying inside a loop. When adding a new
listing/aggregation/report endpoint, follow that same shape — a for-loop
that calls `db.get(...)`/`db.scalars(...)` again per iteration is an N+1
and should be one query with a join or an `IN (...)` filter instead.

As of the last audit, no confirmed N+1 pattern exists in the current
codebase — this is a "don't introduce one" checklist, not a "go fix
existing ones" list. If you find one while working nearby, flag it via
`improve-app` rather than fixing it unprompted in an unrelated change.

## Frontend: known, current finding

Routes are code-split: `App.tsx` lazy-loads every page except `LandingPage`
and `NotFoundPage` via `React.lazy`, with a `Suspense` boundary in
`app-layout.tsx` around `<Outlet />` (fallback is a skeleton block, not a
blank screen). A new top-level page should follow the same
`lazy(() => import(...).then((m) => ({ default: m.X })))` pattern rather
than an eager import at the top of `App.tsx` — that's exactly how the
previous single >500kB chunk crept back in before this was fixed.

## Frontend: query/fetch patterns

- Watch for a page issuing more requests than necessary to render (e.g. a
  page that could use one endpoint's response but instead fetches several
  and cross-references client-side). Note: `ProfilePage`'s reviews tab
  fetching `listCourts()` to build a `court_id → name` lookup is a known,
  deliberate tradeoff (no `court_id → name` join in `ReviewOut`), not
  something to "fix" unprompted — check whether a new instance of this
  pattern is similarly deliberate or just avoidable duplication before
  copying it.
- TanStack Query's caching means a naive re-fetch-on-every-render is
  unlikely, but check that a new query has a sensible key so it doesn't
  invalidate/refetch more often than the data actually changes.

## Backend: the worker

`worker.py` runs on a fixed tick (hold-expiry, reminders, auto-complete,
waitlist cascade). A new periodic check added to it should scale with the
number of *active* reservations it needs to examine, not the whole table —
filter by status in the query, don't fetch everything and filter in Python.

## When to use this

Before adding a new list/aggregation endpoint or a large new frontend
page/bundle, and when asked to review or improve performance — in the
latter case, walk both the backend query-pattern section and the frontend
bundle/fetch section rather than only one stack.
