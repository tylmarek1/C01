---
name: api-integration
description: How to call the backend from Courtly's frontend — TanStack Query + the lib/api.ts fetch wrapper, error handling via ApiError, and the plain-controlled-input form pattern (no React Hook Form/Zod in this codebase). Use when adding any new query/mutation, wiring a new page to the API, or building a form.
---

# Data fetching, state, errors, and forms (frontend)

These are one pattern in this codebase, not four separate concerns — a
query/mutation via `lib/api.ts` *is* the state management, and its
`ApiError` *is* the error handling.

## Data fetching and mutations

- Always through TanStack Query (`useQuery`/`useMutation`) calling into
  `frontend/src/lib/api.ts`'s typed fetch wrapper. Never call raw `fetch()`
  from a component — `api.ts` centralizes the base URL, auth header, and
  error parsing.
- Before adding a new query/mutation, find an existing hook against the
  same or a similar resource and match its query-key shape and invalidation
  calls (`queryClient.invalidateQueries`) rather than inventing a new
  convention. Query keys should be specific enough that unrelated data
  doesn't get invalidated together, but consistent with how sibling
  resources key their queries.
- `assetUrl()` (`api.ts`) is the existing helper for turning a relative
  upload path (avatar, court photo) into a full URL — reuse it, don't
  hand-roll URL concatenation.
- **Optimistic updates** aren't used anywhere in this codebase today — every
  mutation waits for the response, then invalidates. That's the right
  default; consider an optimistic update (`onMutate` updating the query
  cache directly, rolling back in `onError`) only for a fast, low-stakes,
  instantly-reversible toggle where the wait is visibly annoying (the
  favorites heart toggle — `court-card.tsx`/`CourtDetailPage.tsx`/
  `ProfilePage.tsx` — is the one existing candidate). Don't reach for it for
  anything that can fail for a business reason (booking, confirming,
  cancelling) — a rollback after the user thinks it worked is worse than
  the wait.

## Error handling

- `ApiError` (status + message, message read from the backend's `detail` —
  a string or the first Pydantic validation error's `msg`) is thrown by the
  wrapper on a non-2xx response. Catch it where you need a user-facing
  message (typically in a mutation's `onError`) and show it via the
  existing toast pattern (`sonner`) — don't swallow it silently, and don't
  build a second error-parsing path.
- A component showing data from a query should handle the `isError` state
  visibly (a message, not a blank area) — check a similar existing page for
  the pattern rather than inventing a new empty/error-state style.

## Forms — the actual pattern here

There is **no React Hook Form or Zod** in this codebase — forms are plain
controlled inputs (`useState` + `onChange`) with inline validation, not a
schema-validation library. Match that pattern for a new form rather than
introducing RHF/Zod for just one form (that would be a new dependency and a
second, inconsistent form-handling style — flag it via `improve-app` as a
future idea if the number of forms genuinely justifies it, don't add it
unprompted).

- Client-side validation in a form (e.g. the booking form's lead-time/slot
  checks) is a UX nicety, mirroring a backend rule (`rules.py`/
  `booking_validation.py`) for immediate feedback — it is **never** the
  only enforcement. If a form validates something the backend rule set
  covers, make sure the frontend check actually matches the backend rule;
  a drifted client-side copy of a business rule is exactly the class of bug
  this project has shipped before (a missing lead-time check in the booking
  UI, caught by manual testing). Treat a business-rule change in
  `rules.py`/`booking_validation.py` as a signal to check whether a
  frontend form needs the matching update too.
- Submit via a mutation (see above); disable the submit control while
  pending, show the `ApiError` message on failure, matching an existing
  form's pattern (check `pages/auth/` or the booking flow for the current
  convention before building a new one).

## Before finishing

New user-facing copy anywhere in this flow (labels, validation messages,
toasts) goes through `t()` — see `i18n-check`.
