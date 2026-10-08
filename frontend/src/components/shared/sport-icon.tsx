import { CircleDot, Feather, Volleyball } from "lucide-react"

import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
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

const SURFACE: Record<SportType, string> = {
  TENNIS: "bg-court-tennis",
  VOLLEYBALL: "bg-court-volleyball",
  BADMINTON: "bg-court-badminton",
}

/** The sport's icon in chalk on its court colour — the same surface the
 * painted court illustrations use, so a sport reads the same everywhere. */
function SportTile({ sport, size = "md", className }: { sport: SportType; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xs text-court-line",
        SURFACE[sport],
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-[18px]",
        size === "lg" && "size-12 [&_svg]:size-5",
        className,
      )}
    >
      <SportIcon sport={sport} />
    </span>
  )
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

export { SportIcon, SportTile, useSportLabels }
