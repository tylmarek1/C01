import { ArrowUpRight, Heart, ShieldCheck, Star } from "lucide-react"
import { Link } from "react-router-dom"

import { Tooltip } from "@/components/ui/tooltip"
import { CourtArt } from "@/components/shared/court-art"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
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
            <span className="flex size-6 items-center justify-center rounded-xs bg-muted text-muted-foreground" aria-label={labels[amenity]}>
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
          "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs outline-none surface-interactive focus-visible:ring-2 focus-visible:ring-ring/40",
          className,
        )}
      >
        <div className="relative p-1.5 pb-0">
          <CourtArt sport={court.sport_type} imageUrl={court.image_url} hideMeta className="rounded-lg" />
          {court.requires_approval && (
            <span className="absolute bottom-2.5 left-3.5 inline-flex items-center gap-1 rounded-xs bg-card/95 px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-xs backdrop-blur-sm">
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
              className="absolute top-3.5 right-3.5 flex size-8 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm backdrop-blur-sm transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95"
              aria-label={isFavorite ? t("courts.favorite.remove") : t("courts.favorite.add")}
            >
              <Heart className={cn("size-4 transition-colors", isFavorite && "fill-danger text-danger")} />
            </button>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[15px] leading-snug font-semibold tracking-[-0.01em] text-foreground">{court.name}</span>
              <RatingInline court={court} className="mt-0.5 shrink-0" />
            </div>
            <span className="text-[13px] text-muted-foreground">{meta}</span>
          </div>
          {court.description && <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{court.description}</p>}
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
            <Price court={court} />
            <AmenityIcons court={court} max={3} />
          </div>
        </div>
      </Link>
    )
  }

  const body = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md transition-colors",
          selected ? "bg-brand text-brand-foreground" : "bg-muted text-foreground",
        )}
      >
        <SportIcon sport={court.sport_type} className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-foreground">{court.name}</span>
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
    "group flex w-full items-center gap-3 rounded-lg border p-3 text-left outline-none transition-[border-color,background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/40",
    selected
      ? "border-foreground/80 bg-card shadow-sm ring-1 ring-foreground/80"
      : "border-border bg-card hover:border-border-strong hover:shadow-sm",
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
