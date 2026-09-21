---
name: api-design
description: House style for adding or changing a FastAPI endpoint on Courtly's backend — router placement, request/response schema conventions, status codes, error shape, and where business logic belongs. Use whenever adding a new endpoint, changing an endpoint's request/response shape, or adding validation/error behavior.
---

# API design conventions (backend)

Inspect an existing router in `backend/src/reservations/api/` for the
closest analog before adding a new endpoint — match its shape rather than
inventing a new style.

## Router placement

- A new independently-addressable resource gets its own router file in
  `api/`, registered in `main.py` the same way the existing ones are.
- A new action on an *existing* resource (confirm/cancel/check-in style) is
  a new endpoint on that resource's existing router, not a new file.
- Routers stay thin: parse/validate input (via a Pydantic schema and
  `Depends`), call into a service/logic module
  (`lifecycle.py`/`rules.py`/`booking_validation.py`/a feature module like
  `achievements.py`), translate the result to a response schema. If a route
  handler is doing real branching/computation itself, that logic almost
  certainly belongs in one of those modules instead.

## Request/response schemas

- Every request body and response gets a Pydantic schema in `schemas/`,
  named and placed next to the schemas for the same resource
  (`schemas/reservation.py`, etc.) — don't return a raw ORM model or an ad
  hoc dict.
- New optional fields are additive and safe. A new **required** field on an
  existing request schema breaks every current caller — check
  `frontend/src/lib/api.ts` and call sites first, and coordinate the
  frontend change in the same PR (see `versioning`, project-wide).

## Status codes and error shape

- Use `fastapi.HTTPException(status.HTTP_xxx, "message")` with a plain
  string `detail` — this is the shape the frontend's `extractErrorMessage`
  (`frontend/src/lib/api.ts`) actually parses. Don't introduce a different
  error envelope (e.g. a structured problem-details body) for one new
  endpoint; the frontend doesn't know how to read it.
- Match existing status-code conventions: `404` for "not found",
  `403` for "not allowed for this role/owner", `409` for a state conflict
  (including the exclusion-constraint violation on double-booking —
  translate `ExclusionViolation` to `409`, never a `500` or a silent retry),
  `422` is handled automatically by Pydantic validation failures.

## Validation

- Type/shape validation belongs in the Pydantic schema. Business-rule
  validation (lead time, slot alignment, opening hours, ownership, role)
  belongs in `rules.py`/`booking_validation.py` or the route's dependency
  chain (`get_current_user`/`get_current_manager`) — not duplicated inline
  in the route body in a way that could drift from the canonical rule.

## Auth

Reuse `get_current_user`/`get_current_manager` (`deps.py`) — never
re-implement token decoding or role checks in a new router. See
`security-review` (project-wide) for the ownership-check discipline beyond
just picking the right dependency.

## Before finishing

Run the `schema-change-sweep` skill (project-wide) if you added/changed a
schema field, and the backend tests via `finish-task`.
