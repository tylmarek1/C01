import { Star } from "lucide-react"
import { useState } from "react"

import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  value: number
  className?: string
  size?: "sm" | "md"
}

/** Read-only star display for an average rating. */
function StarRating({ value, className, size = "sm" }: StarRatingProps) {
  const starSize = size === "sm" ? "size-3.5" : "size-5"
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < Math.round(value)
        return (
          <Star key={index} className={cn(starSize, filled ? "fill-star text-star" : "text-border-strong")} />
        )
      })}
    </span>
  )
}

interface StarRatingInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

/** Interactive 1-5 star picker for submitting a review. */
function StarRatingInput({ value, onChange, className }: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const { t } = useTranslation()
  const shown = hovered ?? value

  return (
    <span role="radiogroup" aria-label={t("starRating.group")} className={cn("inline-flex items-center gap-1", className)}>
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1
        const filled = starValue <= shown
        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={starValue === value}
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHovered(starValue)}
            onMouseLeave={() => setHovered(null)}
            className="flex size-9 items-center justify-center rounded-full transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-95"
            aria-label={t("starRating.ariaLabel", { count: starValue })}
          >
            <Star className={cn("size-6", filled ? "fill-star text-star" : "text-border-strong")} />
          </button>
        )
      })}
    </span>
  )
}

export { StarRating, StarRatingInput }
