import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface FeatureItemProps {
  icon: LucideIcon
  title: string
  description: string
  active?: boolean
}

function FeatureItem({ icon: Icon, title, description, active = true }: FeatureItemProps) {
  return (
    <div className="flex gap-4 border-b border-hairline py-5 last:border-b-0">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          active ? "bg-tint-blue text-signal-blue" : "bg-pebble text-mist-gray",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className={cn("text-lg font-semibold", active ? "text-ink-navy" : "text-mist-gray")}>{title}</h3>
        <p className="text-sm text-slate-gray">{description}</p>
      </div>
    </div>
  )
}

export { FeatureItem }
