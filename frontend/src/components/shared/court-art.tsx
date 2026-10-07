import type { ReactElement } from "react"

import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { assetUrl } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { SportType } from "@/types"

/**
 * A court's cover: its real photo when it has one, otherwise a branded
 * line-art plan of the sport's court — crisp and consistent instead of
 * depending on external photography that could 404.
 */

function TennisLines() {
  return (
    <g fill="none" strokeWidth="1.2">
      <rect x="10" y="12" width="80" height="56" rx="1" />
      <rect x="10" y="18" width="80" height="44" />
      <line x1="50" y1="12" x2="50" y2="68" strokeWidth="2" />
      <line x1="28" y1="18" x2="28" y2="62" />
      <line x1="72" y1="18" x2="72" y2="62" />
      <line x1="28" y1="40" x2="72" y2="40" />
    </g>
  )
}

function VolleyballLines() {
  return (
    <g fill="none" strokeWidth="1.2">
      <rect x="12" y="14" width="76" height="52" rx="1" />
      <line x1="50" y1="8" x2="50" y2="72" strokeWidth="2" />
      <line x1="37" y1="14" x2="37" y2="66" />
      <line x1="63" y1="14" x2="63" y2="66" />
    </g>
  )
}

function BadmintonLines() {
  return (
    <g fill="none" strokeWidth="1.2">
      <rect x="14" y="14" width="72" height="52" rx="1" />
      <rect x="14" y="18" width="72" height="44" />
      <line x1="50" y1="14" x2="50" y2="66" strokeWidth="2" />
      <line x1="22" y1="14" x2="22" y2="66" />
      <line x1="78" y1="14" x2="78" y2="66" />
      <line x1="40" y1="14" x2="40" y2="66" />
      <line x1="60" y1="14" x2="60" y2="66" />
      <line x1="22" y1="40" x2="40" y2="40" />
      <line x1="60" y1="40" x2="78" y2="40" />
    </g>
  )
}

const LINES_BY_SPORT: Record<SportType, () => ReactElement> = {
  TENNIS: TennisLines,
  VOLLEYBALL: VolleyballLines,
  BADMINTON: BadmintonLines,
}

interface CourtArtProps {
  sport: SportType
  indoor?: boolean
  className?: string
  compact?: boolean
  /** A real venue photo, when the court has one — falls back to the illustration otherwise. */
  imageUrl?: string | null
  /** "eager" for the one hero photo on a page (e.g. CourtDetailPage) so it
   * doesn't compete with the lazy default that's right everywhere this
   * renders many courts at once (grids, admin lists). */
  loading?: "lazy" | "eager"
  /** Hide the indoor/outdoor chip (when the caller renders its own meta). */
  hideMeta?: boolean
}

function CourtArt({ sport, indoor, className, compact = false, imageUrl, loading = "lazy", hideMeta = false }: CourtArtProps) {
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const Lines = LINES_BY_SPORT[sport]
  const photo = assetUrl(imageUrl)

  return (
    <div
      className={cn(
        "relative isolate flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl bg-muted text-foreground",
        className,
      )}
    >
      {photo ? (
        <>
          <img
            src={photo}
            alt={t("courtArt.photoAlt", { sport: sportLabels[sport] })}
            loading={loading}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/25 to-transparent" />
        </>
      ) : (
        <>
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_0%,color-mix(in_oklab,var(--brand)_28%,transparent),transparent_60%)]" />
          <svg viewBox="0 0 100 80" aria-hidden className="relative h-[78%] w-[78%] stroke-foreground/25 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
            <Lines />
          </svg>
          <span
            className={cn(
              "absolute flex items-center justify-center rounded-lg bg-card text-foreground shadow-md ring-1 ring-border",
              compact ? "size-9" : "size-12",
            )}
          >
            <SportIcon sport={sport} className={compact ? "size-4" : "size-5"} />
          </span>
          <span className="sr-only">{t("courtArt.illustrationAlt", { sport: sportLabels[sport] })}</span>
        </>
      )}
      {indoor !== undefined && !compact && !hideMeta && (
        <span className="absolute top-2.5 right-2.5 rounded-xs bg-card/90 px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-xs backdrop-blur-sm">
          {indoor ? t("courts.indoor") : t("courts.outdoor")}
        </span>
      )}
    </div>
  )
}

export { CourtArt }
