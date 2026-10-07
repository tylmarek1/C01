import type { BusySlot, CourtAvailability } from "@/types"

// Mirror backend/src/reservations/rules.py — the UI disables what the API
// would reject, but the backend stays the only real enforcement (known pitfall #3).
export const MIN_LEAD_MINUTES = 15
export const MAX_ADVANCE_DAYS = 14
const SLOT_STEP_MINUTES = 30
// Mirrors the backend's CLOSING_HOUR (Europe/Prague) — used only to skip a
// "today" that has no bookable start left; availability is the real source.
const CLOSING_HOUR = 22
const SHORTEST_SLOT_MINUTES = 60

/** Today, or tomorrow once no slot can still start today (YYYY-MM-DD, local). */
export function firstBookableDate(now = new Date()): string {
  const lastStart = new Date(now)
  lastStart.setHours(CLOSING_HOUR, 0, 0, 0)
  lastStart.setMinutes(-SHORTEST_SLOT_MINUTES)
  const day = new Date(now)
  if (now.getTime() + MIN_LEAD_MINUTES * 60_000 > lastStart.getTime()) day.setDate(day.getDate() + 1)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
}

export type SlotState = "free" | "booked" | "held" | "blocked" | "past"

export interface Slot {
  start: Date
  end: Date
  state: SlotState
  blocker?: BusySlot
}

/** Every start time between opening and closing at which a `durationMinutes`
 * session fits, classified against the busy list. */
export function buildSlots(availability: CourtAvailability, durationMinutes: number, now = Date.now()): Slot[] {
  const open = new Date(availability.opens_at).getTime()
  const close = new Date(availability.closes_at).getTime()
  const slots: Slot[] = []
  for (let t = open; t + durationMinutes * 60_000 <= close; t += SLOT_STEP_MINUTES * 60_000) {
    const start = new Date(t)
    const end = new Date(t + durationMinutes * 60_000)
    const blocker = availability.busy.find(
      (slot) => start.getTime() < new Date(slot.end_time).getTime() && end.getTime() > new Date(slot.start_time).getTime(),
    )
    let state: SlotState = "free"
    if (t < now + MIN_LEAD_MINUTES * 60_000) state = "past"
    else if (blocker?.source === "FACILITY_BLOCK") state = "blocked"
    else if (blocker && (blocker.status === "CONFIRMED" || blocker.status === "CHECKED_IN")) state = "booked"
    else if (blocker) state = "held"
    slots.push({ start, end, state, blocker })
  }
  return slots
}

