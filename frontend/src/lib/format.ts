import { useMemo } from "react"

import { useTranslation, type Lang } from "@/lib/i18n"

/** BCP-47 locale for each UI language — every date/number on screen goes
 * through these so a Czech user never sees English month names. */
export const LOCALE: Record<Lang, string> = { en: "en-GB", cs: "cs-CZ" }

export function todayDateString(): string {
  return toDateString(new Date())
}

/** Local `YYYY-MM-DD` for a Date (what `<input type="date">` and the
 * availability endpoint take) — not `toISOString()`, which is UTC and can be
 * a day off near midnight. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000)
}

/** The seed data and every price field on the backend is in CZK. */
const currencyFormatter = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 })
export function formatCurrency(amount: number): string {
  return `${currencyFormatter.format(amount)} Kč`
}

/** Locale-bound formatters for the current UI language. */
export function useFormatters() {
  const { lang, t } = useTranslation()

  return useMemo(() => {
    const locale = LOCALE[lang]
    const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" })
    const dateShort = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" })
    const dateMedium = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" })
    const dateLong = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" })
    const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" })
    const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: "short" })
    const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long" })
    const monthShort = new Intl.DateTimeFormat(locale, { month: "short" })
    const monthYear = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })
    const dateTime = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    const number = new Intl.NumberFormat(locale)
    const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 })

    function relativeTime(iso: string, now = Date.now()): string {
      const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000)
      const abs = Math.abs(diffSeconds)
      if (abs < 45) return t("time.justNow")
      if (abs < 3600) return relative.format(Math.round(diffSeconds / 60), "minute")
      if (abs < 86_400) return relative.format(Math.round(diffSeconds / 3600), "hour")
      if (abs < 86_400 * 7) return relative.format(Math.round(diffSeconds / 86_400), "day")
      if (abs < 86_400 * 30) return relative.format(Math.round(diffSeconds / (86_400 * 7)), "week")
      return dateMedium.format(new Date(iso))
    }

    /** "Today" / "Tomorrow" / "Yesterday" / "Thu 9 Oct" */
    function dayLabel(input: string | Date): string {
      const date = typeof input === "string" ? new Date(input) : input
      const today = startOfDay(new Date())
      const diff = Math.round((startOfDay(date).getTime() - today.getTime()) / 86_400_000)
      if (diff === 0) return t("time.today")
      if (diff === 1) return t("time.tomorrow")
      if (diff === -1) return t("time.yesterday")
      return dateShort.format(date)
    }

    function duration(minutes: number): string {
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      if (hours === 0) return t("time.minutesShort", { count: rest })
      if (rest === 0) return t("time.hoursShort", { count: hours })
      return `${t("time.hoursShort", { count: hours })} ${t("time.minutesShort", { count: rest })}`
    }

    return {
      locale,
      time: (iso: string | Date) => time.format(typeof iso === "string" ? new Date(iso) : iso),
      timeRange: (startIso: string, endIso: string) =>
        `${time.format(new Date(startIso))}–${time.format(new Date(endIso))}`,
      date: (iso: string | Date) => dateShort.format(typeof iso === "string" ? new Date(iso) : iso),
      dateMedium: (iso: string | Date) => dateMedium.format(typeof iso === "string" ? new Date(iso) : iso),
      dateLong: (iso: string | Date) => dateLong.format(typeof iso === "string" ? new Date(iso) : iso),
      dayMonth: (iso: string | Date) => dayMonth.format(typeof iso === "string" ? new Date(iso) : iso),
      weekday: (iso: string | Date) => weekdayShort.format(typeof iso === "string" ? new Date(iso) : iso),
      /** Name of a backend weekday index (0 = Monday … 6 = Sunday); 1 Jan 2024 was a Monday. */
      weekdayName: (index: number, style: "short" | "long" = "long") =>
        (style === "long" ? weekdayLong : weekdayShort).format(new Date(2024, 0, 1 + index)),
      monthShort: (iso: string | Date) => monthShort.format(typeof iso === "string" ? new Date(iso) : iso).replace(".", ""),
      monthYear: (iso: string | Date) => monthYear.format(typeof iso === "string" ? new Date(iso) : iso),
      dateTime: (iso: string | Date) => dateTime.format(typeof iso === "string" ? new Date(iso) : iso),
      /** "Thu 9 Oct · 18:00–19:30" */
      dateRange: (startIso: string, endIso: string) =>
        `${dateShort.format(new Date(startIso))} · ${time.format(new Date(startIso))}–${time.format(new Date(endIso))}`,
      dayLabel,
      relativeTime,
      duration,
      durationBetween: (startIso: string, endIso: string) => duration(minutesBetween(startIso, endIso)),
      number: (value: number) => number.format(value),
      percent: (ratio: number) => percent.format(ratio),
      currency: formatCurrency,
    }
  }, [lang, t])
}

export type Formatters = ReturnType<typeof useFormatters>
