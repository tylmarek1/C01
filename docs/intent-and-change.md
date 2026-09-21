# Project Frame

## Reservation domain
Sports courts at a single sports venue: tennis, volleyball and badminton courts booked in time slots.

## Purpose
The system lets players book a court for a specific time without calling the venue, and lets the venue avoid double bookings.
Players see which courts are free and get a confirmation. The venue manager gets a reliable schedule of court usage.

## Users / Stakeholders
- **Player**: creates, confirms and cancels their own reservations.
- **Venue manager**: manages courts (activate/deactivate) and can cancel any reservation.
- **Venue (business owner)**: wants high court utilization and no double bookings.

## Core concepts
- **Court (Resource)**: a bookable court with a sport type (TENNIS / VOLLEYBALL / BADMINTON), indoor/outdoor, active flag.
- **Reservation**: a booking of one court by one user for one time slot, with a state.
- **User**: a player or a venue manager.
- **Time slot**: `[start_time, end_time)` interval, half-open, stored with time zone.
- **Opening hours**: the venue's daily window (07:00–22:00) in which courts can be booked.

## Core operations
- Create reservation (as DRAFT)
- Confirm reservation (DRAFT → CONFIRMED)
- Cancel reservation (DRAFT/CONFIRMED → CANCELLED)
- Check availability (which slots of a court are free in a given time range)

## Persistent state
- **Reservation**: id (UUID), court_id, user_id, start_time, end_time (timestamptz), status, created_at.
- **Court**: id, name, sport_type, indoor, active.
- **User**: id, name, email, role.

## State-changing operation
`DRAFT → CONFIRMED` (confirm). Also `DRAFT → CANCELLED` and `CONFIRMED → CANCELLED` (cancel). `CANCELLED` is final.

## Common business rule
Confirmed reservations for the same resource must not overlap.

## Domain-specific business rule
A reservation must last 60, 90 or 120 minutes, start on a full or half hour (:00 or :30), and lie entirely within opening hours 07:00–22:00.

## External / system boundary
**Notification Service**: sends the player a message (e-mail) when a reservation is confirmed or cancelled.

## Assumption
A court is always booked as a whole by one user. There is no shared or half-court booking and no "find me a partner" booking.

## Unknown
Is confirmation automatic (the player confirms their own draft), or does it need venue-manager approval or payment first?

## Selected future pressure
Category: **Q**

Concrete pressure: when next week's slots open (Friday 18:00), booking attempts on the same popular courts rise about 10×. Many players try to confirm the same evening slot within a few seconds.

Why it is relevant to our reservation system: prime-time court slots are scarce and contested. If the overlap rule is checked in application code (SELECT, then INSERT/UPDATE), two concurrent requests can both pass the check, which creates two CONFIRMED overlapping reservations. That is exactly the common business rule breaking under load.

## Update after C02 (2026-09-21)
The frame above stays valid as the *decisions* of C01. C02 refined it, in detail, in [`specification-v0.1.md`](specification-v0.1.md) and [`specification.md`](specification.md):
- `DRAFT` became `PENDING`, a 5-minute **hold that already blocks the court** (decision D-01); the common rule therefore covers `PENDING`, `CONFIRMED` (and `CHECKED_IN`, and later `PENDING_APPROVAL`) reservations, not only `CONFIRMED`.
- The **Unknown** — "is confirmation automatic, or does it need venue-manager approval?" — is answered: **per court**. A court with `requires_approval` turns the player's Confirm into a request that a venue manager approves or rejects; it may also expire (`PENDING_APPROVAL`, `REJECTED`, `EXPIRED`).
- The **Notification Service** boundary is still not implemented; notifications are in-app only.
