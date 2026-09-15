import { CircleDot, Feather, Volleyball } from "lucide-react"

import { useTranslation } from "@/lib/i18n"
import type { SportType } from "@/types"

const SPORT_ICONS: Record<SportType, typeof CircleDot> = {
  TENNIS: CircleDot,
  VOLLEYBALL: Volleyball,
  BADMINTON: Feather,
}

function SportIcon({ sport, className }: { sport: SportType; className?: string }) {
  const Icon = SPORT_ICONS[sport]
  return <Icon className={className} />
}

/** Localized sport display names — read live from the current language. */
function useSportLabels(): Record<SportType, string> {
  const { t } = useTranslation()
  return {
    TENNIS: t("sport.TENNIS"),
    VOLLEYBALL: t("sport.VOLLEYBALL"),
    BADMINTON: t("sport.BADMINTON"),
  }
}

export { SportIcon, useSportLabels }
