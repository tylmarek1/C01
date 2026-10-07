import type { ReactNode } from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/** Toggleable pill for multi-facet filters (amenities, status). */
function FilterChip({
  active,
  onClick,
  children,
  count,
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-[background-color,border-color,color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border-strong bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        className,
      )}
    >
      {active && <Check className="size-3" />}
      {children}
      {count !== undefined && <span className={cn("font-mono tabular", active ? "opacity-70" : "text-subtle-foreground")}>{count}</span>}
    </button>
  )
}

export { FilterChip }
