import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

interface StatTileProps {
  label: string
  value: ReactNode
  icon?: LucideIcon
  hint?: ReactNode
  /** Highlights the figure (e.g. a non-zero approval queue). */
  tone?: "default" | "attention"
  to?: string
  className?: string
}

/** A figure from the programme's "by the numbers" box: a heavy rule on top,
 * mono label, a big condensed numeral, an optional note. No card around it —
 * put several in a grid and the rules line up into a scoreboard. */
function StatTile({ label, value, icon: Icon, hint, tone = "default", to, className }: StatTileProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow group-hover/stat:text-foreground">{label}</span>
        {Icon && <Icon className={cn("size-4 shrink-0", tone === "attention" ? "text-brand" : "text-subtle-foreground")} />}
      </div>
      <span className={cn("display text-[44px] sm:text-[52px]", tone === "attention" ? "text-brand" : "text-foreground")}>
        {value}
      </span>
      {hint && <span className="text-[13px] text-muted-foreground">{hint}</span>}
    </>
  )
  const classes = cn(
    "group/stat flex min-w-0 flex-col gap-2 border-t-2 pt-3",
    tone === "attention" ? "border-brand" : "border-foreground",
    to && "transition-colors hover:border-brand",
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
