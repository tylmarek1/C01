const dateFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" })
const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })

export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`
}

export function todayDateString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

const currencyFormatter = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 })

/** The seed data and every price field on the backend is in CZK — this
 * formats just the number+currency, locale-invariant like the date/time
 * formatters above; callers add their own translated "/hr" suffix. */
export function formatCurrency(amount: number): string {
  return `${currencyFormatter.format(amount)} Kč`
}
