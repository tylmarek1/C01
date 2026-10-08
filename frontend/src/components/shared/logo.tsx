import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

/** The Courtly mark — a court plan (outline + net) with a clay ball, on a
 * forest tile. Mirrors public/favicon.svg. */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="64" height="64" rx="6" className="fill-panel" />
      <rect x="12" y="12" width="40" height="40" fill="none" strokeWidth="3" className="stroke-panel-foreground" />
      <path d="M12 32h40" strokeWidth="3" className="stroke-panel-foreground" />
      <circle cx="41" cy="22" r="6" className="fill-brand" />
    </svg>
  )
}

function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      <LogoMark />
      <span className="display text-[24px] leading-none font-black tracking-[0.01em]">Courtly</span>
    </Link>
  )
}

export { Logo, LogoMark }
