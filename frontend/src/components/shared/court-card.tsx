import { ArrowRight, Heart } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/shared/badge"
import { CourtArt } from "@/components/shared/court-art"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { StarRating } from "@/components/shared/star-rating"
import { useAmenityLabels } from "@/lib/amenities"
import { formatCurrency } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Court } from "@/types"

function PriceTag({ court }: { court: Court }) {
  const { t } = useTranslation()
  if (court.price_per_hour === null) return null
  return <span className="text-xs font-medium text-signal-blue">{t("courts.pricePerHour", { price: formatCurrency(court.price_per_hour) })}</span>
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
}

function CourtCard({
  court,
  selected = false,
  onSelect,
  href,
  compact = false,
  isFavorite,
  onToggleFavorite,
}: CourtCardProps) {
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const amenityLabels = useAmenityLabels()
  const indoorOutdoor = court.indoor ? t("courts.indoor") : t("courts.outdoor")

  if (href && !compact) {
    return (
      <Link
        to={href}
        className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div className="relative">
          <CourtArt sport={court.sport_type} indoor={court.indoor} imageUrl={court.image_url} className="rounded-none" />
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                onToggleFavorite(court)
              }}
              className="absolute top-3 left-3 flex size-8 items-center justify-center rounded-full bg-paper/90 text-ink-navy shadow-sm backdrop-blur-sm transition-transform hover:scale-105"
              aria-label={isFavorite ? t("courts.favorite.remove") : t("courts.favorite.add")}
            >
              <Heart className={cn("size-4", isFavorite && "fill-red-500 text-red-500")} />
            </button>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-ink-navy">{court.name}</span>
            <Badge variant="secondary">{sportLabels[court.sport_type]}</Badge>
          </div>
          {court.review_count > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRating value={court.average_rating ?? 0} />
              <span className="text-xs text-slate-gray">
                {court.average_rating?.toFixed(1)} ({court.review_count})
              </span>
            </div>
          )}
          {court.description && <p className="line-clamp-2 text-sm text-slate-gray">{court.description}</p>}
          {court.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {court.amenities.slice(0, 3).map((amenity) => (
                <Badge key={amenity} variant="secondary" className="text-[10px]">
                  {amenityLabels[amenity]}
                </Badge>
              ))}
              {court.amenities.length > 3 && (
                <Badge variant="secondary" className="text-[10px]">
                  +{court.amenities.length - 3}
                </Badge>
              )}
            </div>
          )}
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="flex items-center gap-1 text-sm font-semibold text-signal-blue">
              {t("courts.viewCourt")}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
            <PriceTag court={court} />
          </div>
        </div>
      </Link>
    )
  }

  if (href && compact) {
    return (
      <Link
        to={href}
        className="group flex items-center gap-4 rounded-2xl border border-hairline bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-pebble text-ink-navy">
          <SportIcon sport={court.sport_type} className="size-5" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="font-semibold text-ink-navy">{court.name}</span>
          <span className="flex items-center gap-2 text-sm text-slate-gray">
            {sportLabels[court.sport_type]}
            <Badge variant="secondary">{indoorOutdoor}</Badge>
          </span>
          {court.review_count > 0 && (
            <span className="flex items-center gap-1.5">
              <StarRating value={court.average_rating ?? 0} />
              <span className="text-xs text-slate-gray">({court.review_count})</span>
            </span>
          )}
        </span>
        <span className="ml-auto flex flex-col items-end gap-1">
          <PriceTag court={court} />
          <ArrowRight className="size-4 shrink-0 text-slate-gray transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    )
  }

  const interactive = Boolean(onSelect)

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onSelect?.(court)}
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-4 text-left transition-all",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-card",
        selected ? "border-signal-blue bg-[#eaf3ff] shadow-card" : "border-hairline bg-card",
        !interactive && "cursor-default",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          selected ? "bg-signal-blue text-paper" : "bg-pebble text-ink-navy",
        )}
      >
        <SportIcon sport={court.sport_type} className="size-5" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-semibold text-ink-navy">{court.name}</span>
        <span className="flex items-center gap-2 text-sm text-slate-gray">
          {sportLabels[court.sport_type]}
          <Badge variant="secondary">{indoorOutdoor}</Badge>
        </span>
        {court.review_count > 0 && (
          <span className="flex items-center gap-1.5">
            <StarRating value={court.average_rating ?? 0} />
            <span className="text-xs text-slate-gray">({court.review_count})</span>
          </span>
        )}
      </span>
      <span className="ml-auto shrink-0">
        <PriceTag court={court} />
      </span>
    </button>
  )
}

export { CourtCard }
