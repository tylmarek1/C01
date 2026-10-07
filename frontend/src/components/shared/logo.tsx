import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

/** The Courtly mark — an optic ball with its seam, on an ink tile. Mirrors public/favicon.svg. */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect x="1" y="1" width="62" height="62" rx="15" strokeWidth="2" className="fill-panel stroke-transparent dark:stroke-border-strong" />
      <circle cx="32" cy="32" r="17" className="fill-brand" />
      <path
        d="M20.5 19.5c6.5 4.2 6.5 20.8 0 25M43.5 19.5c-6.5 4.2-6.5 20.8 0 25"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-brand-foreground"
      />
    </svg>
  )
}

function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.03em]">Courtly</span>
    </Link>
  )
}

export { Logo, LogoMark }
