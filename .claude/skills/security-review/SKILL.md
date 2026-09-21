---
name: security-review
description: C01-specific security checklist covering Courtly's actual auth, authorization, validation, and trust boundaries — not generic security theater. Use when adding an endpoint, changing auth/role logic, handling file uploads, or when asked to review/improve security.
---

# Security review, grounded in what Courtly actually does

## Authentication

JWT (HS256, `pyjwt`), `sub` = user id, `bcrypt` password hashing. Every
protected endpoint should depend on `get_current_user` (`deps.py`) — never
re-implement token decoding in a new router. `SECRET_KEY` has an insecure
local-dev fallback (ADR-003) — that's deliberate, not a bug; flag it only if
asked to prepare something for beyond local development.

## Authorization — the check that's easy to skip

Two dependency layers exist: `get_current_user` (any authenticated user) and
`get_current_manager` (`deps.py:47`, requires
`current_user.role == UserRole.VENUE_MANAGER`). When adding an endpoint, ask
explicitly:

- Is this manager-only? Use `get_current_manager`, don't hand-roll a role
  check inline in the route body.
- Is this "any user, but only their own data"? The dependency only proves
  *who* the caller is — the route body must still filter/check ownership
  (e.g. a reservation lookup must confirm `reservation.user_id ==
  current_user.id` unless the caller is a manager). A missing ownership
  check is the single most likely real vulnerability class in a codebase
  shaped like this one — an endpoint that trusts an id path parameter
  without checking who it belongs to.

## Input validation

Pydantic schemas validate shape/types at the boundary; `rules.py`/
`booking_validation.py` validate business constraints. A new endpoint should
use a Pydantic request schema, not raw dict/query-param parsing, and should
route business-rule validation through the existing modules rather than
inline checks that could drift from the canonical rule.

## SQL injection / raw SQL

The codebase is SQLAlchemy-ORM-first; the few `text()`/`literal_column()`
uses that exist are fixed, developer-authored strings (the exclusion
constraint DDL, test `TRUNCATE`), never built from request input. If a new
change introduces a `text()` call built with any user-supplied value via
string formatting/concatenation, that's a real SQL-injection risk — use
bound parameters (`text("... :param").bindparams(...)`) or, better, stay in
the ORM.

## CORS

Configured via `FRONTEND_ORIGIN` (`config.py`) — a new deployment target
means updating that env var, not loosening CORS to a wildcard.

## Secrets and sensitive data

Never log a JWT, password, or password hash. `SECRET_KEY` and
`DATABASE_URL` come from environment variables with local-dev-only
fallbacks — don't add a new secret with a hardcoded non-dev value, and don't
add a new insecure-by-default fallback beyond the two that already exist and
are documented.

## File uploads

`images.py` validates content-type and size (8MB) before accepting an
avatar/court photo. Any new upload endpoint must do the same — don't accept
arbitrary file types or skip the size check because "it's just for admins."

## Frontend trust boundary

The frontend must never be the only place a rule is enforced (e.g. a
lead-time or role check done only in a React component) — the backend is
the source of truth; a client-only check is a UX nicety, not security. This
codebase has hit this exact class of bug before (a client-side-only
lead-time validation gap caught by manual testing, per project history) —
if you add a frontend-side validation, confirm the backend enforces the same
rule independently.

## When to use this

Before adding any new endpoint or role-gated action, and whenever asked to
"review" or "improve" security — in the latter case, walk every section
above against the current code rather than only the area you were last
working in.
