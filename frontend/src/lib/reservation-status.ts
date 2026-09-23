import type { BadgeProps } from "@/components/ui/badge"
import { useTranslation } from "@/lib/i18n"
import type { ReservationStatus } from "@/types"

/** Badge color per status — purely visual, no localization needed. */
export const STATUS_VARIANT: Record<ReservationStatus, BadgeProps["variant"]> = {
  PENDING: "warning",
  PENDING_APPROVAL: "warning",
  CONFIRMED: "success",
  CHECKED_IN: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  EXPIRED: "secondary",
  REJECTED: "destructive",
  NO_SHOW: "destructive",
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
