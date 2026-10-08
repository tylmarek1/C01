/** Venue-local "HH:MM" on the half hour, 00:00–24:00 — the only times the
 * backend accepts for opening hours and rate boundaries (ADR-009). */
export const HALF_HOURS: string[] = Array.from({ length: 49 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`)

export function toMinute(value: string): number {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}
