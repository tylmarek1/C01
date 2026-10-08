import { toMinute } from "@/lib/time-of-day"
import type { OpeningHoursDay } from "@/types"

// VENUE_TZ mirrors backend/src/reservations/schemas/reservation.py. Opening
// hours are data per venue (ADR-009, GET /venues/{id}/opening-hours); the
// DEFAULT_CLOSING_HOUR is what every venue starts with — lib/slots.ts uses it
// only to guess whether today still has a bookable start.
export const VENUE_TZ = "Europe/Prague"
export const DEFAULT_CLOSING_HOUR = 22

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TZ,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})
const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }


/** Venue-local weekday (0 = Monday, like the backend) and minutes since
 * midnight — known pitfall #1: never use the browser's own wall clock. */
export function venueClock(now: number): { weekday: number; minutes: number } {
  const parts = Object.fromEntries(clockFormatter.formatToParts(new Date(now)).map((part) => [part.type, part.value]))
  return { weekday: WEEKDAY_INDEX[parts.weekday], minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

export interface VenueStatus {
  open: boolean
  /** Today's hours, if the venue opens today at all. */
  today: OpeningHoursDay | null
  /** When it next opens, if it's closed now. */
  next: OpeningHoursDay | null
}

export function venueStatus(hours: OpeningHoursDay[], now: number): VenueStatus {
  const { weekday, minutes } = venueClock(now)
  const byDay = new Map(hours.map((day) => [day.weekday, day]))
  const today = byDay.get(weekday) ?? null
  const open = today !== null && minutes >= toMinute(today.opens_at) && minutes < toMinute(today.closes_at)
  let next: OpeningHoursDay | null = null
  if (!open) {
    if (today && minutes < toMinute(today.opens_at)) next = today
    else
      for (let offset = 1; offset <= 7 && !next; offset++) {
        next = byDay.get((weekday + offset) % 7) ?? null
      }
  }
  return { open, today, next }
}
