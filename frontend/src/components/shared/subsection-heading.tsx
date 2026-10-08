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
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="flex items-baseline gap-2 font-display text-[22px] leading-none font-extrabold tracking-[0.01em] text-foreground uppercase">
          {title}
          {count !== undefined && (
            <span className="font-mono text-[12px] font-medium tracking-normal text-muted-foreground tabular">
              ({String(count).padStart(2, "0")})
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
