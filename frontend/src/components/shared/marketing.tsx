import { Plus } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Width/padding wrapper for a marketing page section. */
function MarketingSection({ id, children, className, size = "default" }: { id?: string; children: ReactNode; className?: string; size?: "narrow" | "default" }) {
  return (
    <section id={id} className={cn("mx-auto w-full scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24", size === "narrow" ? "max-w-3xl" : "max-w-6xl", className)}>
      {children}
    </section>
  )
}

/** Native <details> accordion — keyboard/screen-reader accessible for free. */
function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium transition-colors marker:content-none hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
            {item.question}
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform duration-200 group-open:rotate-45 group-open:border-foreground group-open:text-foreground">
              <Plus className="size-3.5" />
            </span>
          </summary>
          <p className="animate-fade-in px-5 pb-5 text-[14px] leading-relaxed text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  )
}

/** Closing call-to-action band on the always-dark ink panel. */
function CtaBand({ title, description, cta, to }: { title: string; description: string; cta: string; to: string }) {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl bg-panel px-6 py-14 text-center sm:px-12 sm:py-20">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklab,var(--brand)_32%,transparent),transparent_70%)]" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(to_right,var(--panel-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--panel-foreground)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(70%_70%_at_50%_30%,black,transparent)]"
      />
      <h2 className="mx-auto max-w-xl text-3xl leading-[1.1] font-semibold tracking-[-0.035em] text-panel-foreground sm:text-[44px]">{title}</h2>
      <p className="mx-auto mt-4 max-w-md text-[15px] text-panel-foreground/65">{description}</p>
      <Button variant="brand" size="xl" className="mt-8" asChild>
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  )
}

export { CtaBand, FaqList, MarketingSection }
