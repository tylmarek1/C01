import type { BadgeProps } from "@/components/ui/badge"
import { useTranslation } from "@/lib/i18n"
import type { UserRole } from "@/types"

/** Badge color per role — purely visual, no localization needed. */
export const ROLE_VARIANT: Record<UserRole, BadgeProps["variant"]> = {
  PLAYER: "secondary",
  VENUE_MANAGER: "success",
  ADMIN: "default",
}

/** Localized role display names — read live from the current language. */
export function useRoleLabels(): Record<UserRole, string> {
  const { t } = useTranslation()
  return {
    PLAYER: t("role.PLAYER"),
    VENUE_MANAGER: t("role.VENUE_MANAGER"),
    ADMIN: t("role.ADMIN"),
  }
}
