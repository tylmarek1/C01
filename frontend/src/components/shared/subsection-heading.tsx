import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface SubsectionHeadingProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  count?: number
  className?: string
}

/** Heading for a block inside a page (a dashboard column, an admin panel). */
function SubsectionHeading({ title, description, action, count, className }: SubsectionHeadingProps) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          {title}
          {count !== undefined && (
            <span className="rounded-xs bg-muted px-1.5 py-px font-mono text-[11px] font-medium text-muted-foreground tabular">
              {count}
            </span>
          )}
        </h2>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export { SubsectionHeading }
