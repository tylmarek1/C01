---
name: production-readiness
description: Systematic gate answering "is Courtly (C01) — or a specific feature of it — ready for production," categorized into blocking/important/nice-to-have, grounded in this project's actual (course-project, dev-only) architecture rather than generic enterprise checklists. Use for "make the application production-ready" or "is this ready to ship" requests.
---

# Is this production-ready?

This is a gate, not an audit for its own sake: every finding is categorized
by whether it actually blocks calling something "production-ready," not
just "could theoretically be improved." Don't invent enterprise requirements
this project doesn't need (a message queue, a Kubernetes manifest, a
metrics platform) — ground every item in what "production" would concretely
require for *this* app as it actually exists.

## Correctness

- Re-run `feature-completeness` on the area in question.
- Any known bug class from root `CLAUDE.md`'s "Known pitfalls" reintroduced
  anywhere in this area?

## Security — blocking by default

- `SECRET_KEY`'s insecure fallback (ADR-003, deliberate for local dev) is
  **blocking** for anything beyond local development — a real secret must
  be set via environment, not the fallback.
- Any endpoint missing an ownership/role check (`security-review`) is
  blocking.
- CORS (`FRONTEND_ORIGIN`) must be set to the real deployed origin, not left
  at the local default — blocking.

## Reliability

- The in-process `worker.py` background task has no supervision — if the
  process restarts, does anything resume correctly (holds, reminders)?
  Currently: yes, because it re-derives state from the DB each tick rather
  than holding in-memory state — this is actually fine as-is, not a gap;
  confirm this is still true if `worker.py` changes.
- No retry/backoff exists anywhere for external calls — there currently are
  none (no email/SMS/payment integration), so this is **not applicable**,
  not a gap to invent work for.

## Configuration

- `.env.example` values are dev defaults, not production secrets — confirm
  nothing production-sensitive is hardcoded outside environment variables.
- Database: `docker-compose.yml` only provisions a local Postgres; there is
  no production database configuration story at all. This is **blocking**
  for an actual deployment, but *not* something to invent a solution for
  unprompted (a specific hosting target changes the right answer) — name it
  as a blocking gap, don't guess at infrastructure.

## Error handling

- Consistent `HTTPException(status, "message")` shape (`consistency`) — an
  inconsistent error shape isn't blocking but is a real rough edge for any
  future API consumer.
- Frontend: does every mutation surface a failure to the user, or can
  something fail silently (`accessibility-responsive`)?

## Testing

- Backend: a substantial suite against real Postgres (see `backend/CLAUDE.md`
  for the current count) — solid for what it covers, but coverage gaps in
  less-tested feature areas are **important**, not blocking, unless the area
  in question is what's being shipped.
- Frontend: **zero automated tests** — genuinely important for a real
  production app, but this project's current, deliberate state (see root
  `CLAUDE.md`'s "Known gaps") — report as important, not as if it were a
  surprise finding, and don't treat "add a full test suite" as the
  automatic recommendation without scoping it to what actually needs it.

## Performance

- Run `performance-review`'s checklist for regressions. Bundle size is
  **important**, not blocking, for a course-scale app if it resurfaces.

## Observability

- There is **no logging/metrics/error-tracking** at all beyond FastAPI's
  default request handling. For an actual production deployment this is
  **important** (you'd fly blind on errors), but building a full
  observability platform is exactly the overengineering the project's own
  CLAUDE.md warns against — the right-sized version is probably "log
  unhandled exceptions somewhere," not a platform. Name it, don't build it
  unprompted.

## Documentation

- Re-run `update-docs`'s stale-doc check — a production launch is exactly
  the moment root/backend/frontend README claims need to be accurate.

## Deployment assumptions

- Backend and frontend run natively (`uv run`/`npm run`), not containerized
  beyond Postgres — there is no production build/deploy path defined
  anywhere in this repo. This is **blocking** for an actual deployment and
  **out of this project's current scope** to solve speculatively; report it
  as a real gap requiring a deliberate decision (what host, what process
  manager, containerize or not), not something to scaffold unasked.

## Report

```
[BLOCKING / IMPORTANT / NICE-TO-HAVE]
Area: <section above>
Finding: <what>
Why: <consequence of shipping without addressing it>
```

Be honest when something is "not applicable" (no retry logic needed because
there's nothing to retry) rather than manufacturing a finding to fill a
section.
