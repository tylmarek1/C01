import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface FeatureItemProps {
  icon: LucideIcon
  title: string
  description: string
  active?: boolean
  className?: string
}

function FeatureItem({ icon: Icon, title, description, active = true, className }: FeatureItemProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md border",
          active ? "border-border bg-card text-foreground shadow-xs" : "border-transparent bg-muted text-subtle-foreground",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className={cn("text-[15px] font-semibold tracking-[-0.01em]", active ? "text-foreground" : "text-subtle-foreground")}>
          {title}
        </h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export { FeatureItem }
