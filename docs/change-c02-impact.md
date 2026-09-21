# Change C02 — approval process: impact analysis

**Written before** `specification.md` (v0.2) was touched, and kept as the reasoning behind it. It answers the nine questions of the assignment against Specification Baseline v0.1 (`specification-v0.1.md`) and the running app. The consolidated "Dopad změny C02" block is at the end (§4).

## 1. The change card

> Some Resources require approval by an authorised person before a Reservation can become `CONFIRMED`. Approval may be delayed, rejected, or may expire.

It answers the Project Frame's open *Unknown*: "Is confirmation automatic, or does it need venue-manager approval first?" — **both**, per court.

**Terms used below.** *Approval-required Resource* = a court with `requires_approval = true`. *Approver* = an authorised person; in this system the only authorised role is `VENUE_MANAGER`.

## 2. Impact analysis, area by area

| Area | Question | Answer | Consequence |
|---|---|---|---|
| **Create** | Does Create change, or does it still only create a hold? | **Unchanged.** Create still produces a `PENDING` hold for any court. The approval decision is not made at Create; it is reached at Confirm. | OP-01 and REQ-01/02 keep their text. Only BR-07's *set of counted states* grows (a request awaiting approval still counts as an active reservation). |
| **Availability** | Does a request awaiting approval block the Resource? Why? | **Yes.** It gets its own state `PENDING_APPROVAL`, which joins the blocking states of BR-02. Reasons: (1) if it did not block, two players could both wait for approval of the same slot and approving the second would fail *after* a human decision, forcing a conflict-resolution flow the change does not ask for; (2) it is the same reasoning that made a `PENDING` hold block (D-01); (3) the existing exclusion constraint then enforces it for free. Cost: a slow approver blocks a slot for others — bounded by the approval deadline (BR-12) and by Reject/Cancel. | BR-02, OP-02 (REQ-03 text unchanged, its meaning follows BR-02), constraint `WHERE` list, `ACTIVE_RESERVATION_STATUSES` (pitfall #4). |
| **Confirm** | Is Confirm still one immediate operation, or does it split into a request and a later approval? | **It splits, per Resource.** On a normal court Confirm behaves exactly as in v0.1 (`PENDING → CONFIRMED`). On an approval-required court the player's Confirm is a **submission**: `PENDING → PENDING_APPROVAL`, and `CONFIRMED` is reachable only through the new Approve. The endpoint stays the same; the outcome depends on the Resource, which the server decides, not the client. | REQ-04 changes (result depends on `requires_approval`); OP-03 alternative outcomes; a hold no longer runs during approval — the hold is replaced by the approval deadline. |
| **Approve** | Is there a new actor goal / a new operation? Who may perform it? | **Yes: OP-05 Approve Reservation**, and its mirror **OP-06 Reject Reservation** (the change says approval can be rejected, and a reject must be a goal of its own, not a side effect). Only a Venue Manager may perform either. Separation of duties (approver ≠ requester) is **not** required (assumption A-06): a venue is small, a manager may book courts, and a "manager cannot approve own booking" rule could leave a one-manager venue with requests nobody can decide. | New OPs, new REQs (08, 09), new rejection outcomes; full template in `specification.md`. |
| **Cancel** | Can a `PENDING_APPROVAL` reservation be cancelled? | **Yes**, by the owner (withdrawing the request) or a manager, under the same BR-03: strictly before start. It releases the slot. | BR-03 gains one state; REQ-06 changes; VE for it. |
| **State diagram** | Do we need `PENDING_APPROVAL`, `REJECTED`, `EXPIRED`, or something else? | `PENDING_APPROVAL` — **new**, blocking. `REJECTED` — **new**, terminal, non-blocking; not folded into `CANCELLED` because who ended it and why differ (a decision by the venue vs a withdrawal by the player) and the player's UI/notification reads differently. `EXPIRED` — **reused**: an undecided request that timed out means the same as an unconfirmed hold that timed out (terminal, non-blocking, "nobody acted in time"); which stage timed out is kept in the audit note. | New transitions in BR-09; state diagram redrawn. |
| **Use case diagram** | New approver actor, or new goal? | **No new actor** — the Venue Manager already exists and is the approver. **Two new goals** for that actor (Approve, Reject). No external supporting actor appears: notifications stay in-app. | §5.1 gains two use cases, nothing else changes. |
| **Verification** | How do we verify delay, rejection, expiry and their effect on availability? | *Delay:* a submitted request stays `PENDING_APPROVAL` and keeps blocking without any decision, and is not confirmed by the passing of time. *Rejection:* Reject → `REJECTED`; interval `available`; the player is notified; a waitlisted player is offered the slot. *Expiry:* move the deadline into the past directly in the database (the only way to make 24 h pass in a test), run one worker cycle → `EXPIRED`; the interval is `available`; a late Approve/Reject is `CONFLICT`. Each has an executable VE in `test_approval_api.py`, plus a live run. | New VEs in the v0.2 operations. |
| **Architecture** | Is there a new driver for a persistent/asynchronous process, a timer, or an external notification? | **Yes — see §3.** | Carried to C03; not solved here. |

## 3. What else the change touches (found by tracing every way to `CONFIRMED`)

The change is only correct if **no other path** produces `CONFIRMED` on an approval-required court. Tracing the code found three:

| Path | Problem | Decision |
|---|---|---|
| **Waitlist accept** creates a reservation directly as `CONFIRMED`. | Would bypass approval entirely. | On an approval-required court the accepted offer becomes `PENDING_APPROVAL`, with the same deadline and manager notification as a Confirm. |
| **Reschedule** of a `CONFIRMED` reservation moves an already-approved booking to another time. | The approval was for a different slot. | On an approval-required court a `CONFIRMED` reservation cannot be rescheduled (`CONFLICT`: cancel and request again). Rescheduling a `PENDING` hold is unaffected; a `PENDING_APPROVAL` request cannot be rescheduled (same rule as today for any non-PENDING/CONFIRMED state). Re-approval on move is a possible later improvement, not needed for the change. |
| **Manager Confirm on behalf of a player** | `_get_owned_reservation` lets a manager confirm any reservation. | Not a bypass: it yields `PENDING_APPROVAL` like anyone's Confirm; only Approve confirms. |

The invariant that captures all of it is new rule **BR-11**: *on an approval-required Resource, a reservation reaches `CONFIRMED` only by Approve.* It is enforced in the state machine itself (`lifecycle.transition`), not just in the confirm endpoint, so a future fourth path cannot bypass it silently.

**Switching the flag.** Turning `requires_approval` on affects only future Confirms: existing `CONFIRMED` reservations stay valid (grandfathered), existing `PENDING` holds are evaluated when they are confirmed, and `PENDING_APPROVAL` requests that already exist stay decidable even if the flag is later switched off.

### Architectural drivers revealed by the change (input for C03 — recorded, not solved)

| ID | Driver | Why it is new | Evidence in the current code |
|---|---|---|---|
| **AD-1** | **A long-lived, persisted, time-bounded process.** A request lives up to 24 h, across requests and restarts, and its expiry must fire even if nobody calls the API. | v0.1 only had a 5-minute hold. | State and deadline are columns; the timer is an in-process asyncio loop polling every 30 s (`worker.py`). It assumes **one** instance; a second would sweep in parallel (row locks with `skip_locked` keep the sweep safe, but reminders/notifications are not idempotent). |
| **AD-2** | **One definition of "blocking".** The set of states that occupy a court is now written in four places: the exclusion constraint's `WHERE`, `ACTIVE_RESERVATION_STATUSES`, the availability check and the per-user limit. Forgetting one place silently removes double-booking protection (known pitfall #4). | Growing the set from three to four states made the risk concrete. | `models/reservation.py` (constraint and tuple are separate literals). |
| **AD-3** | **Row-level serialisation is now load-bearing.** Confirm, Cancel, Approve, Reject, hold expiry and approval expiry all change one reservation's state and race with each other. | More competing writers per row than in v0.1. | `SELECT … FOR UPDATE` in the router; `skip_locked` in the worker; no shared "apply a transition" function. |
| **AD-4** | **Several doors to `CONFIRMED`** (confirm, approve, waitlist accept) plus reschedule. | The invariant BR-11 must hold across all. | Guard in `lifecycle.transition`, but waitlist accept builds rows without it and is patched separately. |
| **AD-5** | **Notification to a person who must act.** A manager has to *learn* that a request is waiting. Today: an in-app notification only. If approvers should be reached outside the app (e-mail, chat) this becomes an external boundary needing delivery guarantees and retries. | v0.1 notifications were informational. | `notifications.py` writes rows; no delivery, no retry, no outbox. |
| **AD-6** | **Authorisation beyond two roles.** "Any venue manager" is the approver; per-Resource approvers or separation of duties would need a real authorisation model. | Approve is the first operation whose authority is not "owner or manager". | `deps.get_current_manager`. |

## 4. Dopad změny C02 (summary block)

**Changed condition:** Some Resources require approval by an authorised person before a Reservation may become `CONFIRMED`; approval may be delayed, rejected or expire.

**Affected requirements / parts of the specification:**
REQ-04 (Confirm) — result now depends on the Resource; REQ-06 (Cancel) — `PENDING_APPROVAL` becomes cancellable; REQ-07 (serialisation) — list of racing operations extended; BR-02 (blocking states +1); BR-03 (cancellable states +1); BR-07 (counted states +1); BR-09 (lifecycle table); OP-03 alternative outcomes; §2 states; §5.1 use case diagram; §5.2 state diagram; §5.3 activity diagrams (Confirm changed, Approve/Reject/expiry new); §6 acceptance review; §7 consistency review; §8 decisions/assumptions.

**Unaffected requirements / parts + why:**
- REQ-01 and REQ-02 (Create, and concurrent Create): Create still creates a `PENDING` hold; the approval decision lives at Confirm.
- REQ-03 (Availability): the text is stated in terms of "blocking states"; only BR-02's set changes.
- REQ-05 (hold expiry): applies to `PENDING` only; a request awaiting approval has its own deadline (BR-12).
- BR-01 (intervals), BR-04 (slot shape), BR-05 (booking window), BR-06 (hold), BR-08 (facility blocks), BR-10 (authorisation for owner/manager operations): the change does not touch time semantics, slot shape or holds.
- Rejection categories (§1): the existing five suffice.

**New actor / operation:** no new actor. New operations **OP-05 Approve Reservation** and **OP-06 Reject Reservation** (Venue Manager).

**Changed rules / meaning of states:** new states `PENDING_APPROVAL` (blocking) and `REJECTED` (terminal); `EXPIRED` now also ends an undecided request. New rules BR-11 (approval invariant) and BR-12 (approval deadline).

**Change to the use case diagram:** Venue Manager gains two use cases (Approve, Reject). No new actor, no external actor.

**Change to the state diagram:** `PENDING → PENDING_APPROVAL` (submit) alongside `PENDING → CONFIRMED` (normal court); `PENDING_APPROVAL → CONFIRMED | REJECTED | CANCELLED | EXPIRED`.

**New verification examples:** VE-02.7, VE-03.8, VE-04.8, VE-05.x (Approve), VE-06.x (Reject), VE-07.x (approval expiry), VE-08.x (no bypass) — in `specification.md`.

**Architectural drivers for C03:** AD-1 … AD-6 above; the most consequential are **AD-1** (durable timers for a process that outlives a request) and **AD-2/AD-3** (one definition of "blocking", one serialised place where transitions are applied).
