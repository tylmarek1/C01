# C01 Engineering Spike

**Variant:** A — Persistence · **Date:** 2026-09-14 · **Branch:** `c01-spike`

Question / unknown:
Can we save a Reservation to a real PostgreSQL database and load it back unchanged, including time-zone-aware slot times, the state enum and references to Court and User?
And can the database itself enforce the common rule, "CONFIRMED reservations of the same court must not overlap", even when many players confirm the same slot at the same time (our Q future pressure)? Or do we need application-level locking?

What we did:
- Modelled `Court`, `User` and `Reservation` in SQLAlchemy 2 (`backend/src/reservations/models/`), with states `DRAFT / CONFIRMED / CANCELLED` stored as a PostgreSQL enum and `start_time`/`end_time` as `timestamptz`.
- Added a PostgreSQL exclusion constraint (needs the `btree_gist` extension). It rejects two CONFIRMED rows for the same court whose half-open ranges `[start, end)` overlap.
- Started a real PostgreSQL 16 with `docker compose up -d --wait db` and ran `uv run pytest -v -s`. The tests are in `backend/tests/test_persistence_spike.py`:
  1. `test_reservation_roundtrip`: saves a CONFIRMED reservation for 18:00–19:30 Europe/Prague and reads it back in a new session. It checks id, court/user FK, status, and that the times are tz-aware and the same instant.
  2. `test_db_rejects_overlapping_confirmed`: 18:00–19:30 CONFIRMED, then 19:00–20:00 CONFIRMED on the same court must fail. An overlapping DRAFT and a back-to-back CONFIRMED (19:30–21:00) must be accepted.
  3. `test_concurrent_confirmations_only_one_wins`: 10 threads, each with its own DB connection, commit a CONFIRMED 18:00–19:00 on the same court at the same moment (synchronised with a `threading.Barrier`).

Observed result:
```
tests/test_health.py::test_health PASSED
tests/test_persistence_spike.py::test_reservation_roundtrip PASSED
tests/test_persistence_spike.py::test_db_rejects_overlapping_confirmed PASSED
tests/test_persistence_spike.py::test_concurrent_confirmations_only_one_wins
concurrent outcomes: ['ExclusionViolation' x9, 'ok' x1]
PASSED
======================== 4 passed, 2 warnings in 2.54s =========================
```
Constraint as created in the database (`pg_get_constraintdef`, PostgreSQL 16.15):
```
no_overlapping_confirmed_reservations | EXCLUDE USING gist (court_id WITH =, tstzrange(start_time, end_time, '[)'::text) WITH &&) WHERE ((status = 'CONFIRMED'::reservation_status))
reservation_time_order                | CHECK ((end_time > start_time))
```
- The round trip works. Times come back tz-aware (as UTC from PostgreSQL) and equal to the stored instant, so we must compare instants and not wall-clock strings.
- The overlapping CONFIRMED insert fails with `psycopg.errors.ExclusionViolation` (wrapped in SQLAlchemy `IntegrityError`). Overlapping DRAFT and back-to-back slots are accepted.
- Under 10 concurrent confirmations exactly **1 succeeded and 9 were rejected** by the database. No overlap got through, without any application-level locking.
- The 2 warnings are third-party deprecation notices (starlette/anyio in `TestClient`), unrelated to the spike.

Decision / what changes because of the result:
- **The common overlap rule is enforced in PostgreSQL by the exclusion constraint** (ADR-001). Application code may still pre-check availability for nicer error messages, but that check is never the only guard.
- The confirm endpoint (C02+) will catch `IntegrityError` with `ExclusionViolation` and map it to **HTTP 409 Conflict** ("slot already taken").
- We stay on **PostgreSQL for tests** (docker compose) and do not use SQLite, because SQLite has no exclusion constraints or `tstzrange`.
- Times are stored as `timestamptz` and handled as tz-aware `datetime` everywhere. The domain slot rule (07:00–22:00, :00/:30) will be evaluated in venue local time `Europe/Prague`.
- Next open point: the schema is created with `create_all`, so we need migrations (Alembic) before the first schema change. That ties into Release/Operation.

---

## Evidence C02: specifikace → běžící aplikace (specification → running application)

**Environment of the runs below:** PostgreSQL **16.15** (Homebrew, private cluster on port 55432 — Docker is not installed on the machine that produced this evidence, so `docker compose up -d db` was not used; the version is the one ADR-001 names), Python 3.12, `uv` 0.12.17, real background worker (not a test double). Every number below was produced in this session; nothing is copied from an earlier run.

### Přijatá baseline (accepted baseline)
| Baseline | Document | Status |
|---|---|---|
| **v0.1** — Create, Check Availability, Confirm, Cancel | [`specification-v0.1.md`](specification-v0.1.md) (frozen) | **Prepared for team approval** — the approval tick-boxes in its §11 are for the team; nothing here claims they were ticked |
| **v0.2** — v0.1 + approval process (Approve, Reject, expiry) | [`specification.md`](specification.md) | Prepared for team approval, same rule |

Both went through the nine-question acceptance review (§6 of each), the consistency review (§7), and carry an explicit decision register (D-01…D-20), assumptions (A-01…A-06) and unknowns.

### Předvedené základní operace (operations demonstrated)
All four operations run against the live API, each with a success case and a negative/boundary case (v0.1 run, executed again on top of the v0.2 code to prove nothing regressed — 20 of 20 checks as expected; a first run of the same script on the v0.1 code gave the same result):

```
# day under test: 2026-09-26 (Europe/Prague), court: Badminton Court 2

## OP-02 Check Availability (before anything is booked)
OK VE-02.x   expected 200      got 200 {'available': True, 'reason': None}

## OP-01 Create Reservation
OK VE-01.1   expected 201      got 201 {'id': '…', 'status': 'PENDING', 'hold_expires_at': '…'}
OK VE-01.7   expected 409      got 409  detail='This slot is currently held or booked by someone else — …'
OK VE-01.7b  expected 201      got 201 {'status': 'PENDING'}
OK VE-01.2   expected 422      got 422  detail='Value error, end_time must be after start_time'
OK VE-01.4   expected 401      got 401  detail='Not authenticated'
OK VE-01.5   expected 422      got 422  detail='Value error, reservation must lie within opening hours 07:00-22:00'

## OP-02 Check Availability (after the hold)
OK VE-02.2   expected 200      got 200 {'available': False, 'reason': 'RESERVATION_OVERLAP'}
OK VE-02.1   expected 200      got 200 {'available': True, 'reason': None}
OK VE-02.6   expected 422      got 422  detail='Value error, reservation must be 60, 90 or 120 minutes long'
OK VE-02.6b  expected 404      got 404  detail='Court not found'

## OP-03 Confirm Reservation
OK VE-03.5   expected 403      got 403  detail='Not your reservation'
OK VE-03.1   expected 200      got 200 {'status': 'CONFIRMED', 'hold_expires_at': None}
OK VE-03.2   expected 409      got 409  detail='Cannot move a CONFIRMED reservation to CONFIRMED'
OK VE-03.3   expected 409      got 409  detail='This hold has expired — book the slot again'
   status of the expired hold right after the rejected confirm: PENDING  (blocked: True)
   after 16s the server's own worker swept it -> EXPIRED; interval available again: True

## OP-04 Cancel Reservation
OK VE-04.1   expected 200      got 200 {'status': 'CANCELLED'}
   interval free again after cancel: True
OK VE-04.5   expected 409      got 409  detail='Cannot cancel a CANCELLED reservation'
OK VE-04.6   expected 403      got 403  detail='Not your reservation'
OK VE-04.2   expected 200      got 200 {'status': 'CANCELLED'}
OK VE-04.3   expected 409      got 409  detail='This reservation has already started and can no longer be cancelled'
   the started reservation is still: CONFIRMED
```

### Skutečně provedené příklady ověření (verification examples actually run)
| Where | What | Result |
|---|---|---|
| `backend/tests/test_spec_baseline.py` | every VE-01…VE-04 of v0.1 (43 test cases, incl. 8-way concurrent Create, 20× Confirm‖Cancel race, boundary tests with an injected clock) | 43 passed |
| `backend/tests/test_approval_api.py` | every VE of the v0.2 additions (approve, reject, expiry, delay, no-bypass, races, drift guards; 37 test cases) | 37 passed |
| whole backend suite | the 96 pre-existing tests + the two files above | **176 passed** (real PostgreSQL 16.15) |
| mutation check | seven guards deliberately broken in a scratch copy (BR-11 guard, approval-decision flag, blocking-state set, waitlist bypass, row lock, reschedule guard, reschedule lock) | each broken guard made the intended test(s) fail |
| frontend | `npm run build` (`tsc -b` + Vite) and `npm run lint` | build passes; lint shows only warnings that were there before. **The UI was not exercised in a browser in this session.** |

The v0.2 flows were also run live, including the real worker expiring an undecided request (the request that was *not* past its deadline stayed `PENDING_APPROVAL` through the same cycles — the "delay" case):

```
# day under test: 2026-09-27 (Europe/Prague); approval-required court = Tennis Court 2, normal court = Badminton Court 2

## Normal court is unchanged (v0.1 behaviour)
OK VE-03.8b  expected 200  got 200 {'status': 'CONFIRMED'}

## OP-03 Confirm on an approval-required court = submission
OK VE-03.8   expected 200  got 200 {'status': 'PENDING_APPROVAL', 'hold_expires_at': None, 'approval_expires_at': '+24 h'}
   slot still blocked: True; another player asking for it: OK VE-01.7   expected 409  got 409  detail='This slot is currently held or booked by someone else — …'
   manager notifications now include 'Approval needed': True
OK VE-03.10  expected 409  got 409  detail="Only a venue manager's decision can do that"

## OP-05 Approve
OK VE-05.2   expected 403  got 403  detail='Venue manager access required'
OK VE-05.1   expected 200  got 200 {'status': 'CONFIRMED', 'approval_expires_at': None}
   slot after approval still blocked: True
OK VE-05.3   expected 409  got 409  detail='Cannot move a CONFIRMED reservation to CONFIRMED'
OK VE-05.7   expected 409  got 409  detail='This court requires approval — cancel this reservation and request the new time instead'

## OP-06 Reject
OK VE-06.2   expected 403  got 403  detail='Venue manager access required'
OK VE-06.1   expected 200  got 200 {'status': 'REJECTED'}
   slot released: True; player notified: True
OK VE-06.3   expected 409  got 409  detail='Cannot move a REJECTED reservation to REJECTED'
OK VE-06.5   expected 201  got 201 {'status': 'PENDING'}

## Cancel a request (OP-04)
OK VE-04.8   expected 200  got 200 {'status': 'CANCELLED'}
   slot released: True
OK VE-05.3b  expected 409  got 409  detail='Cannot move a CANCELLED reservation to CONFIRMED'

## Delay and expiry (REQ-10) — the server's own worker does the expiring
OK VE-05.4   expected 409  got 409  detail='This approval request has expired'
   right after: expiring request is still PENDING_APPROVAL (blocking: True)
   after 30s the worker swept it -> EXPIRED; slot released: True
   VE-07.2 the undecided request is untouched by the same cycles: PENDING_APPROVAL (blocking: True)
OK VE-07.1   expected 409  got 409  detail='Cannot move a EXPIRED reservation to CONFIRMED'
   audit trail of the expired request: ['CREATED', 'SUBMITTED', 'EXPIRED (Approval request expired undecided)']
```

### Nalezený nesoulad a způsob vyřešení (mismatches found, and which source was wrong)
The rule of the assignment — do not assume "the code is wrong" — was applied per mismatch. The tests of `test_spec_baseline.py` were written from the specification **before** the code was touched; **20 of 43 failed on the unmodified app** (13 because the availability verdict endpoint did not exist, 2 because the boundary logic could not be exercised with a clock, 5 because of genuine behaviour defects).

| # | Mismatch | Wrong source | Resolution |
|---|---|---|---|
| 1 | Project Frame / ADR-001 / the assignment's reference example: a non-blocking `DRAFT`, only `CONFIRMED` excluded. The app (deliberately) blocks with a 5-minute `PENDING` hold. | **Documents** — not the code | Decision D-01 written into the specification; ADR-001 amended; Project Frame and READMEs updated. No code change. Reference REQ-03/04 ("Confirm fails on overlap") rewritten: with D-01 Confirm cannot fail that way. |
| 2 | No interval verdict for Check Availability (only a day list of busy slots, ignoring facility blocks) | **Implementation gap** | `GET /courts/{id}/availability/check` added (VE-02.x). The day view remains a UI read model; its facility-block gap is recorded as G-01, not fixed here. |
| 3 | Confirm accepted a hold past its deadline (200 instead of 409) — VE-03.3 | **Implementation** | Guard in `lifecycle.py`. |
| 4 | Confirm accepted a deactivated court — VE-03.4 | **Implementation** | Same guard. |
| 5 | Cancel had no time boundary and allowed `CHECKED_IN`; the docs never defined a policy — VE-04.3 | **Specification was silent** → policy chosen (D-03), then implementation and UI aligned | `check_cancellable` (strictly before start; `PENDING`/`PENDING_APPROVAL`/`CONFIRMED`); the UI hides Cancel otherwise. |
| 6 | A naive `end_time` crashed with **HTTP 500** (`TypeError`), spec says 422 — VE-01.2b | **Implementation** | Validation in `validate_slot_shape`. |
| 7 | Concurrent Confirm and Cancel both returned 200 and the reservation ended `CONFIRMED` — a cancelled booking came back to life (lost update) — VE-03.6 | **Implementation** | Row lock (`SELECT … FOR UPDATE`) in the state-changing endpoints; the worker sweep skips locked rows. |
| 8 | v0.2, found by tracing every path to `CONFIRMED`: waitlist acceptance created `CONFIRMED` directly and reschedule moved an approved booking — both would bypass approval | **Design gap of the change**, found before implementing | BR-11 / REQ-11; guard inside the state machine; waitlist accept becomes `PENDING_APPROVAL`; reschedule refused for approved bookings (VE-05.7, VE-08.1, VE-08.2). |
| 9 | v0.2: the transition table alone would let the owner turn their own `PENDING_APPROVAL` into `CONFIRMED` via the ordinary Confirm endpoint | **Design gap**, closed while designing (a decision flag only Approve/Reject pass); not something a test found first | VE-03.10 verifies it. |
| 10 | v0.2: the calendar export silently mapped unknown statuses to `CONFIRMED`, so a request awaiting approval would have appeared as confirmed in the player's calendar | **Implementation** (found by sweeping every place that lists states) | Status map extended; test added. |
| 11 | Independent code review of the branch: the new approval notifications formatted the start time in the *server's* time zone instead of the venue's (known pitfall #1), and `reschedule` did not take the row lock the other state-changing endpoints do | **Implementation** (my own new code) | Notifications use `Europe/Prague`; reschedule locks the row (VE-05.7b, mutation-checked). Not changed, only noted: older notification texts use the same server-zone formatting, and waitlist acceptance does not check that the court is still active (both pre-date this work). |

### Shrnutí dopadu změny (change impact)
The change touched: BR-02/03/07/09/10 (extended), new BR-11/BR-12; REQ-04/06/07 changed, REQ-08…REQ-11 new; two new operations (Approve, Reject) for the *existing* Venue Manager actor; two new states (`PENDING_APPROVAL`, `REJECTED`); `EXPIRED` reused. Untouched: Create and Availability (their text), BR-01/04/05/06/08. New data: `courts.requires_approval`, `reservations.approval_expires_at`, three enum values ×2 → the dev database needs the drop/create/seed cycle. Full analysis, written before the specification: [`change-c02-impact.md`](change-c02-impact.md).

### Zbývající předpoklad / neznámá (remaining assumptions / unknowns)
- **Team approval of both baselines is still to be given** (tick-boxes in §11 of each specification).
- A-01 hold 5 min, A-05 approval window 24 h — product values without an external source, to be confirmed with the venue. A-06 no separation of duties.
- U-01 e-mail / external notification (Project Frame boundary) is not implemented; U-03 rejection reason text; U-04 re-approval instead of refusing to move an approved booking.
- G-01: the day-view availability ignores facility blocks (outside the baseline).
- Not verified: the UI in a browser; a run on the `docker compose` PostgreSQL (see the environment note).

### Architektonické drivery přenesené do C03 (architectural drivers carried into C03)
Details and code evidence in [`change-c02-impact.md`](change-c02-impact.md) §3. In short: **AD-1** a long-lived persisted time-bounded process (in-process 30 s polling worker, single-instance assumption); **AD-2** "which states block a court" is defined in four places (constraint, status tuple, availability, limits) — now only guarded by a drift test; **AD-3** row-level serialisation is load-bearing and lives in routers, not in one place; **AD-4** several doors to `CONFIRMED` (confirm, approve, waitlist accept); **AD-5** notifying a person who must act (in-app only, no delivery guarantees); **AD-6** authorisation beyond two roles.

### Commit / tag aplikace
Branch `feat/c02-spec-and-approval-flow` (merge commits keep these SHAs reachable). No tags — the repository has no tagging process (`versioning` skill); the SHAs identify the states:

| State | Commit |
|---|---|
| Baseline v0.1 specification | `4bb0239` |
| App conforming to v0.1 (5 fixes + verdict endpoint + 43 spec tests) | `76c99ba` |
| Change impact analysis (before any v0.2 edit) | `b5f1438` |
| Specification v0.2 | `b417cde` |
| App for v0.2 (backend + approval tests) | `a5345b5` |
| Frontend, docs and this evidence | the following commits of the same branch / pull request |

**Reproduce:**
```bash
docker compose up -d --wait db                      # or any PostgreSQL 16 with btree_gist
cd backend && uv sync
uv run pytest -v                                    # wipes the database it points at (see backend/CLAUDE.md)
uv run python -m reservations.seed                  # after the drop/create cycle for the new columns
uv run fastapi dev src/reservations/main.py         # Swagger at /docs; demo logins are printed by the seed
```
