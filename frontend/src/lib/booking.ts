import { toDateString } from "@/lib/format"

/** Deep link into the booking flow, optionally with a court and a slot preselected. */
export function bookingHref(courtId: string, slotStart?: Date): string {
  const params = new URLSearchParams({ court: courtId })
  if (slotStart) {
    params.set("date", toDateString(slotStart))
    params.set("start", slotStart.toISOString())
  }
  return `/app/book?${params.toString()}`
}
