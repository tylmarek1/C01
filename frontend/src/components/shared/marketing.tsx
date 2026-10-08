import { Plus } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Width/padding wrapper for a marketing page section. */
function MarketingSection({ id, children, className, size = "default" }: { id?: string; children: ReactNode; className?: string; size?: "narrow" | "default" }) {
  return (
    <section id={id} className={cn("mx-auto w-full scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24", size === "narrow" ? "max-w-3xl" : "max-w-6xl", className)}>
      {children}
    </section>
  )
}

/** Native <details> accordion — keyboard/screen-reader accessible for free.
 * Set as a ruled list: numbered questions between hairlines. */
function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="border-t-2 border-foreground">
      {items.map((item, index) => (
        <details key={item.question} className="group border-b border-border">
          <summary className="flex cursor-pointer list-none items-baseline gap-4 py-5 text-[17px] font-semibold transition-colors marker:content-none hover:text-brand-ink [&::-webkit-details-marker]:hidden">
            <span className="w-8 shrink-0 font-mono text-[11px] font-medium text-subtle-foreground tabular">{String(index + 1).padStart(2, "0")}</span>
            <span className="flex-1">{item.question}</span>
            <span className="flex size-7 shrink-0 items-center justify-center self-center rounded-xs border border-foreground/25 transition-[transform,background-color,color] duration-200 group-open:rotate-45 group-open:bg-foreground group-open:text-background">
              <Plus className="size-3.5" />
            </span>
          </summary>
          <p className="animate-fade-in pb-5 pl-12 text-[15px] leading-relaxed text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  )
}

/** Closing call-to-action band — the forest programme cover, with a chalk
 * court plan running off the right edge. */
function CtaBand({ title, description, cta, to }: { title: string; description: string; cta: string; to: string }) {
  return (
    <div className="relative isolate overflow-hidden rounded-md bg-panel px-6 py-12 text-panel-foreground sm:px-12 sm:py-16">
      <svg aria-hidden viewBox="0 0 100 80" className="absolute top-1/2 -right-24 -z-10 hidden h-[140%] -translate-y-1/2 stroke-panel-foreground/15 sm:block">
        <g fill="none" strokeWidth="0.6">
          <rect x="10" y="12" width="80" height="56" />
          <rect x="10" y="18" width="80" height="44" />
          <line x1="50" y1="12" x2="50" y2="68" strokeWidth="1.2" />
          <line x1="28" y1="18" x2="28" y2="62" />
          <line x1="72" y1="18" x2="72" y2="62" />
          <line x1="28" y1="40" x2="72" y2="40" />
        </g>
      </svg>
      <h2 className="display max-w-2xl text-[48px] sm:text-[80px]">{title}</h2>
      <p className="mt-5 max-w-md text-[16px] text-panel-muted">{description}</p>
      <Button variant="brand" size="xl" className="mt-8" asChild>
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  )
}

export { CtaBand, FaqList, MarketingSection }
