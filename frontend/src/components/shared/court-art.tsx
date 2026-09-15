import type { ReactElement } from "react"

import { DecorativeBlob } from "@/components/shared/decorative-blob"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { assetUrl } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { SportType } from "@/types"

/**
 * Branded line-art illustration per sport, standing in for a real venue
 * photo. Every court renders one of exactly three sport illustrations, so
 * it stays crisp and on-brand instead of depending on external photography
 * that could 404 or look inconsistent between venues.
 */

const BLOB_BY_SPORT: Record<SportType, "cyan" | "magenta"> = {
  TENNIS: "cyan",
  VOLLEYBALL: "magenta",
  BADMINTON: "cyan",
}

function TennisLines() {
  return (
    <g stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.55">
      <rect x="10" y="14" width="80" height="52" rx="1.5" />
      <rect x="16" y="14" width="68" height="52" rx="1.5" />
      <line x1="10" y1="40" x2="90" y2="40" strokeDasharray="2 2" />
      <line x1="50" y1="14" x2="50" y2="66" />
      <line x1="34" y1="14" x2="34" y2="66" opacity="0.4" />
      <line x1="66" y1="14" x2="66" y2="66" opacity="0.4" />
    </g>
  )
}

function VolleyballLines() {
  return (
    <g stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.55">
      <rect x="12" y="16" width="76" height="48" rx="1.5" />
      <line x1="50" y1="16" x2="50" y2="64" strokeWidth="2.5" />
      <line x1="50" y1="8" x2="50" y2="16" />
      <line x1="50" y1="64" x2="50" y2="72" />
      <line x1="34" y1="16" x2="34" y2="64" opacity="0.4" />
      <line x1="66" y1="16" x2="66" y2="64" opacity="0.4" />
    </g>
  )
}

function BadmintonLines() {
  return (
    <g stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.55">
      <rect x="14" y="14" width="72" height="52" rx="1.5" />
      <line x1="50" y1="14" x2="50" y2="66" strokeWidth="2.5" />
      <line x1="22" y1="14" x2="22" y2="66" opacity="0.4" />
      <line x1="78" y1="14" x2="78" y2="66" opacity="0.4" />
      <line x1="14" y1="26" x2="86" y2="26" opacity="0.4" />
      <line x1="14" y1="54" x2="86" y2="54" opacity="0.4" />
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
}

function CourtArt({ sport, indoor, className, compact = false, imageUrl }: CourtArtProps) {
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const Lines = LINES_BY_SPORT[sport]
  const photo = assetUrl(imageUrl)

  return (
    <div
      className={cn(
        "relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-2xl bg-pebble text-ink-navy",
        className,
      )}
    >
      {photo ? (
        <img src={photo} alt={`${sportLabels[sport]} court`} className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <DecorativeBlob color={BLOB_BY_SPORT[sport]} className="-top-8 -right-6 size-32 opacity-40" />
          <DecorativeBlob
            color={BLOB_BY_SPORT[sport] === "cyan" ? "magenta" : "cyan"}
            className="-bottom-10 -left-8 size-28 opacity-30"
          />
          <svg viewBox="0 0 100 80" className="relative h-full w-full">
            <Lines />
          </svg>
        </>
      )}
      <span
        className={cn(
          "absolute flex items-center justify-center rounded-2xl bg-ink-navy text-paper shadow-button",
          compact ? "size-10" : "size-14",
        )}
      >
        <SportIcon sport={sport} className={compact ? "size-4.5" : "size-6"} />
      </span>
      {indoor !== undefined && !compact && (
        <span className="absolute top-3 right-3 rounded-full bg-paper/90 px-2.5 py-1 text-xs font-medium text-ink-navy shadow-sm backdrop-blur-sm">
          {indoor ? t("courts.indoor") : t("courts.outdoor")}
        </span>
      )}
      <span className="sr-only">{sportLabels[sport]} court illustration</span>
    </div>
  )
}

export { CourtArt }
