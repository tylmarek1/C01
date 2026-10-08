import { useQuery } from "@tanstack/react-query"
import { CalendarCheck2, ShieldCheck, Sparkles } from "lucide-react"
import type { ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { RatingInline } from "@/components/shared/court-card"
import { LogoMark } from "@/components/shared/logo"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

/** Split auth screen: form on the left, a live glimpse of the venue on the right (lg+). */
function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const { data: courts, isLoading } = useQuery({ queryKey: ["courts-trending"], queryFn: () => api.listTrendingCourts(7, 3) })

  const points = [
    { icon: ShieldCheck, label: t("authLayout.point.noDoubleBooking") },
    { icon: CalendarCheck2, label: t("authLayout.point.liveAvailability") },
    { icon: Sparkles, label: t("authLayout.point.community") },
  ]

  return (
    <div className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-[1fr_1.05fr]">
      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <LogoMark className="mb-8 size-10" />
          <h1 className="display animate-fade-up text-[52px]">{title}</h1>
          <p className="mt-3 border-t-2 border-foreground pt-3 text-[14px] text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 border-t border-border pt-6 text-[13px] text-muted-foreground">{footer}</div>
        </div>
      </div>

      <div className="relative m-3 hidden overflow-hidden rounded-md bg-panel text-panel-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <svg aria-hidden viewBox="0 0 100 80" className="absolute -top-16 -right-28 h-[70%] stroke-panel-foreground/12">
          <g fill="none" strokeWidth="0.6">
            <rect x="12" y="14" width="76" height="52" />
            <line x1="50" y1="8" x2="50" y2="72" strokeWidth="1.2" />
            <line x1="37" y1="14" x2="37" y2="66" />
            <line x1="63" y1="14" x2="63" y2="66" />
          </g>
        </svg>

        <div className="relative flex flex-col gap-5">
          <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-panel-muted uppercase">
            <span aria-hidden className="size-2 bg-brand" /> {t("authLayout.eyebrow")}
          </span>
          <p className="display max-w-md text-[56px]">{t("authLayout.headline")}</p>
          <ul className="mt-1 flex flex-col gap-2.5 border-t border-panel-foreground/25 pt-4">
            {points.map((point) => (
              <li key={point.label} className="flex items-center gap-2.5 text-[14px] text-panel-foreground/85">
                <point.icon className="size-4 text-brand" /> {point.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="mb-2 flex items-center justify-between border-b-2 border-panel-foreground pb-2">
            <span className="font-display text-[22px] leading-none font-extrabold uppercase">{t("authLayout.availabilityTitle")}</span>
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.08em] uppercase">
              <span className="size-1.5 animate-blink bg-brand" /> {t("common.live")}
            </span>
          </div>
          <div className="flex flex-col">
            {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="my-1 h-12 w-full opacity-20" />)}
            {courts?.map((court, index) => (
              <div key={court.id} className="flex items-center gap-4 border-b border-panel-foreground/20 py-3">
                <span className="w-6 font-mono text-[11px] text-panel-muted tabular">{String(index + 1).padStart(2, "0")}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-display text-[22px] leading-none font-extrabold uppercase">{court.name}</span>
                  <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.06em] text-panel-muted uppercase">
                    <SportIcon sport={court.sport_type} className="size-3" /> {sportLabels[court.sport_type]}
                  </span>
                </span>
                <RatingInline court={court} className="[&_span]:text-panel-foreground!" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export { AuthLayout }
