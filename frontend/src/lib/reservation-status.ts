import type { BadgeProps } from "@/components/shared/badge"
import { useTranslation } from "@/lib/i18n"
import type { ReservationStatus } from "@/types"

/** Badge color per status — purely visual, no localization needed. */
export const STATUS_VARIANT: Record<ReservationStatus, BadgeProps["variant"]> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CHECKED_IN: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  EXPIRED: "secondary",
  NO_SHOW: "destructive",
}

/** Localized status display names — read live from the current language. */
export function useStatusLabels(): Record<ReservationStatus, string> {
  const { t } = useTranslation()
  return {
    PENDING: t("status.PENDING"),
    CONFIRMED: t("status.CONFIRMED"),
    CHECKED_IN: t("status.CHECKED_IN"),
    COMPLETED: t("status.COMPLETED"),
    CANCELLED: t("status.CANCELLED"),
    EXPIRED: t("status.EXPIRED"),
    NO_SHOW: t("status.NO_SHOW"),
  }
}
