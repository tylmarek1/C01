import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline py-16 text-center",
        className,
      )}
    >
      <p className="font-medium text-ink-navy">{title}</p>
      {description && <p className="max-w-xs text-sm text-slate-gray">{description}</p>}
      {action}
    </div>
  )
}

export { EmptyState }
