import { ArrowUpRight, Heart, ShieldCheck, Star } from "lucide-react"
import { Link } from "react-router-dom"

import { Tooltip } from "@/components/ui/tooltip"
import { CourtArt } from "@/components/shared/court-art"
import { SportTile, useSportLabels } from "@/components/shared/sport-icon"
import { AMENITY_ICON, useAmenityLabels } from "@/lib/amenities"
import { formatCurrency } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Court } from "@/types"

function RatingInline({ court, className }: { court: Court; className?: string }) {
  const { t } = useTranslation()
  if (court.review_count === 0 || court.average_rating === null) {
    return <span className={cn("text-xs text-subtle-foreground", className)}>{t("courts.noReviews")}</span>
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", className)}>
      <Star className="size-3.5 fill-star text-star" />
      <span className="font-semibold text-foreground tabular">{court.average_rating.toFixed(1)}</span>
      <span className="text-muted-foreground tabular">({court.review_count})</span>
    </span>
  )
}

function Price({ court, className }: { court: Court; className?: string }) {
  const { t } = useTranslation()
  if (court.price_per_hour === null) return <span className={cn("text-xs text-subtle-foreground", className)}>{t("courts.priceUnset")}</span>
  return (
    <span className={cn("text-[13px] text-muted-foreground", className)}>
      <span className="font-semibold text-foreground tabular">{formatCurrency(court.price_per_hour)}</span>
      {t("courts.perHourSuffix")}
    </span>
  )
}

function AmenityIcons({ court, max = 4 }: { court: Court; max?: number }) {
  const labels = useAmenityLabels()
  if (court.amenities.length === 0) return null
  return (
    <span className="flex items-center gap-1">
      {court.amenities.slice(0, max).map((amenity) => {
        const Icon = AMENITY_ICON[amenity]
        return (
          <Tooltip key={amenity} content={labels[amenity]}>
            <span className="flex size-6 items-center justify-center rounded-xs border border-border text-muted-foreground" aria-label={labels[amenity]}>
              <Icon className="size-3.5" />
            </span>
          </Tooltip>
        )
      })}
      {court.amenities.length > max && (
        <span className="px-1 font-mono text-[11px] text-muted-foreground">+{court.amenities.length - max}</span>
      )}
    </span>
  )
}

interface CourtCardProps {
  court: Court
  selected?: boolean
  onSelect?: (court: Court) => void
  /** When set, renders a card that links to the court's detail page instead of selecting inline. */
  href?: string
  /** With href: a compact row instead of the full showcase card with art. */
  compact?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (court: Court) => void
  className?: string
}

function CourtCard({ court, selected = false, onSelect, href, compact = false, isFavorite, onToggleFavorite, className }: CourtCardProps) {
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const meta = `${sportLabels[court.sport_type]} · ${court.indoor ? t("courts.indoor") : t("courts.outdoor")}`

  if (href && !compact) {
    return (
      <Link
        to={href}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-md border border-border bg-card outline-none surface-interactive focus-visible:ring-2 focus-visible:ring-ring/40",
          className,
        )}
      >
        <div className="relative">
          <CourtArt sport={court.sport_type} imageUrl={court.image_url} hideMeta className="rounded-none" />
          {court.requires_approval && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-xs bg-card px-1.5 py-1 font-mono text-[10px] leading-none font-medium tracking-[0.06em] text-foreground uppercase">
              <ShieldCheck className="size-3" /> {t("courts.requiresApproval")}
            </span>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onToggleFavorite(court)
              }}
              aria-pressed={Boolean(isFavorite)}
              className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-xs bg-card text-foreground transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95"
              aria-label={isFavorite ? t("courts.favorite.remove") : t("courts.favorite.add")}
            >
              <Heart className={cn("size-4 transition-colors", isFavorite && "animate-pop fill-brand text-brand")} />
            </button>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3 border-t border-border p-4">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">{meta}</span>
            <div className="flex items-start justify-between gap-3">
              <span className="display text-[28px] text-foreground decoration-2 underline-offset-4 group-hover:underline">{court.name}</span>
              <RatingInline court={court} className="mt-1 shrink-0" />
            </div>
          </div>
          {court.description && <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{court.description}</p>}
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-foreground/20 pt-3">
            <Price court={court} />
            <AmenityIcons court={court} max={3} />
          </div>
        </div>
      </Link>
    )
  }

  const body = (
    <>
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand" />}
      <SportTile sport={court.sport_type} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-bold text-foreground">{court.name}</span>
          {court.requires_approval && (
            <Tooltip content={t("courts.requiresApproval")}>
              <ShieldCheck className="size-3.5 shrink-0 text-info" aria-label={t("courts.requiresApproval")} />
            </Tooltip>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {meta}
          <RatingInline court={court} />
        </span>
      </span>
      <span className="ml-auto flex shrink-0 flex-col items-end gap-1">
        <Price court={court} className="text-xs" />
        {href && <ArrowUpRight className="size-4 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
      </span>
    </>
  )

  const rowClasses = cn(
    "group relative flex w-full items-center gap-3 overflow-hidden rounded-sm border p-3 text-left outline-none transition-[border-color,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring/40",
    selected ? "border-foreground bg-card pl-4" : "border-border bg-card hover:border-foreground",
    className,
  )

  if (href) {
    return (
      <Link to={href} className={rowClasses}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" disabled={!onSelect} aria-pressed={selected} onClick={() => onSelect?.(court)} className={cn(rowClasses, !onSelect && "cursor-default")}>
      {body}
    </button>
  )
}

export { AmenityIcons, CourtCard, Price as CourtPrice, RatingInline }
