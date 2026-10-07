import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

interface StatTileProps {
  label: string
  value: ReactNode
  icon?: LucideIcon
  hint?: ReactNode
  /** Highlights the tile (e.g. a non-zero approval queue). */
  tone?: "default" | "attention"
  to?: string
  className?: string
}

/** A KPI: label on top, big tabular number, optional hint underneath. */
function StatTile({ label, value, icon: Icon, hint, tone = "default", to, className }: StatTileProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground inline-block first-letter:uppercase">{label}</span>
        {Icon && (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-sm",
              tone === "attention" ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <span className="text-[26px] leading-none font-semibold tracking-[-0.03em] text-foreground tabular">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </>
  )
  const classes = cn(
    "flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs",
    tone === "attention" && "border-brand/60 ring-1 ring-brand/40",
    to && "surface-interactive",
    className,
  )
  if (to) {
    return (
      <Link to={to} className={classes}>
        {body}
      </Link>
    )
  }
  return <div className={classes}>{body}</div>
}

export { StatTile }
