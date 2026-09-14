import type { ReactNode } from "react"

import { Card } from "@/components/shared/card"
import { DecorativeBlob } from "@/components/shared/decorative-blob"
import { Logo } from "@/components/shared/logo"
import { SPORT_LABELS, SportIcon } from "@/components/shared/sport-icon"
import type { SportType } from "@/types"

const PREVIEW_SLOTS: { sport: SportType; label: string; time: string }[] = [
  { sport: "TENNIS", label: "Tennis Court 1", time: "18:00 – 19:00" },
  { sport: "VOLLEYBALL", label: "Volleyball Court", time: "19:30 – 21:00" },
  { sport: "BADMINTON", label: "Badminton Court 1", time: "07:30 – 08:30" },
]

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-bold text-ink-navy">{title}</h1>
          <p className="mt-2 text-base text-slate-gray">{description}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-slate-gray">{footer}</div>
        </div>
      </div>

      <div className="relative hidden items-center justify-center overflow-hidden bg-pebble/60 px-16 lg:flex">
        <DecorativeBlob color="cyan" className="-top-16 -right-10 size-72" />
        <DecorativeBlob color="magenta" className="-bottom-20 -left-16 size-72" />
        <Card className="relative w-full max-w-sm gap-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-navy">Today's availability</span>
            <span className="rounded-full bg-[#e6f0ff] px-2.5 py-1 text-xs font-medium text-deep-cobalt">Live</span>
          </div>
          <div className="flex flex-col gap-3">
            {PREVIEW_SLOTS.map((slot) => (
              <div key={slot.label} className="flex items-center gap-3 rounded-xl border border-hairline p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pebble text-ink-navy">
                  <SportIcon sport={slot.sport} className="size-4" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink-navy">{slot.label}</span>
                  <span className="text-xs text-slate-gray">{SPORT_LABELS[slot.sport]}</span>
                </div>
                <span className="ml-auto text-xs font-medium text-signal-blue">{slot.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

export { AuthLayout }
