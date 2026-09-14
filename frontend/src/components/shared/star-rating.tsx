import { Star } from "lucide-react"
import { useState } from "react"

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
          <Star key={index} className={cn(starSize, filled ? "fill-amber-400 text-amber-400" : "text-hairline")} />
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
  const shown = hovered ?? value

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1
        const filled = starValue <= shown
        return (
          <button
            key={index}
            type="button"
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHovered(starValue)}
            onMouseLeave={() => setHovered(null)}
            className="rounded p-0.5 transition-transform hover:scale-110"
            aria-label={`Rate ${starValue} star${starValue > 1 ? "s" : ""}`}
          >
            <Star className={cn("size-6", filled ? "fill-amber-400 text-amber-400" : "text-hairline")} />
          </button>
        )
      })}
    </span>
  )
}

export { StarRating, StarRatingInput }
