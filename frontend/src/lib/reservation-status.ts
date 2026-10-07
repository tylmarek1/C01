import type { BadgeProps } from "@/components/ui/badge"
import { useTranslation } from "@/lib/i18n"
import type { Reservation, ReservationStatus } from "@/types"

/** Badge tone per status — purely visual, no localization needed. */
export const STATUS_VARIANT: Record<ReservationStatus, BadgeProps["variant"]> = {
  PENDING: "warning",
  PENDING_APPROVAL: "info",
  CONFIRMED: "success",
  CHECKED_IN: "brand",
  COMPLETED: "secondary",
  CANCELLED: "secondary",
  EXPIRED: "secondary",
  REJECTED: "destructive",
  NO_SHOW: "destructive",
}

/** Statuses that still hold the court (mirrors the backend's
 * ACTIVE_RESERVATION_STATUSES — display grouping only, the backend's
 * exclusion constraint is what actually enforces it). */
export const ACTIVE_STATUSES: ReservationStatus[] = ["PENDING", "PENDING_APPROVAL", "CONFIRMED", "CHECKED_IN"]
export const ENDED_STATUSES: ReservationStatus[] = ["COMPLETED", "CANCELLED", "EXPIRED", "REJECTED", "NO_SHOW"]

export function isActive(reservation: Pick<Reservation, "status">): boolean {
  return ACTIVE_STATUSES.includes(reservation.status)
}

/** Still ahead of us (or in progress) and still holding the court. */
export function isUpcoming(reservation: Pick<Reservation, "status" | "end_time">, now = Date.now()): boolean {
  return isActive(reservation) && new Date(reservation.end_time).getTime() > now
}

/** Group a list by local calendar day, keeping input order inside each day. */
export function groupByDay<T extends { start_time: string }>(items: T[]): { key: string; date: Date; items: T[] }[] {
  const groups = new Map<string, { key: string; date: Date; items: T[] }>()
  for (const item of items) {
    const date = new Date(item.start_time)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const group = groups.get(key)
    if (group) group.items.push(item)
    else groups.set(key, { key, date, items: [item] })
  }
  return [...groups.values()]
}

/** Localized status display names — read live from the current language. */
export function useStatusLabels(): Record<ReservationStatus, string> {
  const { t } = useTranslation()
  return {
    PENDING: t("status.PENDING"),
    PENDING_APPROVAL: t("status.PENDING_APPROVAL"),
    CONFIRMED: t("status.CONFIRMED"),
    CHECKED_IN: t("status.CHECKED_IN"),
    COMPLETED: t("status.COMPLETED"),
    CANCELLED: t("status.CANCELLED"),
    EXPIRED: t("status.EXPIRED"),
    REJECTED: t("status.REJECTED"),
    NO_SHOW: t("status.NO_SHOW"),
  }
}
