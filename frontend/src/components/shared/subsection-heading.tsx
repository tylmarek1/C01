import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface SubsectionHeadingProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** A smaller, left-aligned sibling of SectionHeader — for a subsection
 * inside an already-titled page (a Dashboard block, an Admin tab group),
 * not a full page header. */
function SubsectionHeading({ title, description, action, className }: SubsectionHeadingProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-semibold text-ink-navy">{title}</h3>
        {description && <p className="text-sm text-slate-gray">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export { SubsectionHeading }
