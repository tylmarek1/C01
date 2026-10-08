// Mirrors OPENING_HOUR / CLOSING_HOUR / VENUE_TZ in
// backend/src/reservations/schemas/reservation.py. Display-only — the
// availability endpoint stays the real source of opening hours.
export const VENUE_TZ = "Europe/Prague"
export const OPENING_HOUR = 7
export const CLOSING_HOUR = 22

const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: VENUE_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

/** Minutes since venue-local midnight. */
function venueMinutes(now: number): number {
  const [hours, minutes] = hourFormatter.format(new Date(now)).split(":").map(Number)
  return hours * 60 + minutes
}

/** Whether the venue is open right now, in venue-local time (known pitfall #1:
 * never compare the browser's own wall clock against the venue's hours). */
export function isVenueOpen(now: number): boolean {
  const minutes = venueMinutes(now)
  return minutes >= OPENING_HOUR * 60 && minutes < CLOSING_HOUR * 60
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`
}
