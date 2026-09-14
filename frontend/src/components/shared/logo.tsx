import { Link } from "react-router-dom"
import { CircleDot } from "lucide-react"

import { cn } from "@/lib/utils"

function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2 text-ink-navy", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-ink-navy text-paper">
        <CircleDot className="size-4.5" strokeWidth={2.25} />
      </span>
      <span className="text-lg font-bold tracking-tight">Courtly</span>
    </Link>
  )
}

export { Logo }
