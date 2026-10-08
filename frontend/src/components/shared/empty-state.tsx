import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
  /** `compact` — inside a card/sidebar; default — a page-level section. */
  size?: "default" | "compact"
  className?: string
}

/** "Nothing here yet" — always says why it's empty and, where possible, what to do next. */
function EmptyState({ title, description, action, icon: Icon, size = "default", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex animate-fade-in flex-col items-center text-center",
        size === "default" && "gap-3 rounded-md border border-dashed border-foreground/25 px-6 py-14",
        size === "compact" && "gap-2 rounded-sm border border-dashed border-foreground/20 px-4 py-8",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex items-center justify-center rounded-sm bg-foreground text-background",
            size === "default" ? "mb-1 size-11" : "size-9",
          )}
        >
          <Icon className={size === "default" ? "size-5" : "size-4"} />
        </span>
      )}
      <p
        className={cn(
          "text-foreground",
          size === "default" ? "display text-[26px]" : "text-[13px] font-semibold",
        )}
      >
        {title}
      </p>
      {description && (
        <p className={cn("max-w-sm text-pretty text-muted-foreground", size === "default" ? "text-[13px]" : "text-xs")}>
          {description}
        </p>
      )}
      {action && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
