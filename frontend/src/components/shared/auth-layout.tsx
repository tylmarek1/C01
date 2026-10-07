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
    <div className="grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[1fr_1.05fr]">
      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm animate-fade-up">
          <LogoMark className="mb-8 size-10" />
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 border-t border-border pt-6 text-[13px] text-muted-foreground">{footer}</div>
        </div>
      </div>

      <div className="relative m-3 hidden overflow-hidden rounded-2xl bg-panel lg:flex lg:flex-col lg:justify-between lg:p-12 dark:bg-card dark:ring-1 dark:ring-border">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_10%,color-mix(in_oklab,var(--brand)_35%,transparent),transparent_70%)]" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,var(--panel-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--panel-foreground)_1px,transparent_1px)] [background-size:40px_40px]"
        />

        <div className="relative flex flex-col gap-4">
          <span className="font-mono text-[11px] tracking-[0.08em] text-brand uppercase">{t("authLayout.eyebrow")}</span>
          <p className="max-w-md text-[32px] leading-[1.1] font-semibold tracking-[-0.035em] text-panel-foreground">{t("authLayout.headline")}</p>
          <ul className="mt-2 flex flex-col gap-2.5">
            {points.map((point) => (
              <li key={point.label} className="flex items-center gap-2.5 text-[14px] text-panel-foreground/75">
                <point.icon className="size-4 text-brand" /> {point.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative rounded-xl border border-panel-foreground/10 bg-panel-foreground/[0.04] p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-medium text-panel-foreground">{t("authLayout.availabilityTitle")}</span>
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-wider text-brand uppercase">
              <span className="size-1.5 animate-pulse rounded-full bg-brand" /> {t("common.live")}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full opacity-20" />)}
            {courts?.map((court) => (
              <div key={court.id} className="flex items-center gap-3 rounded-lg bg-panel-foreground/[0.06] p-2.5 [&_*]:text-panel-foreground/80">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand [&_svg]:text-brand-foreground!">
                  <SportIcon sport={court.sport_type} className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-medium text-panel-foreground!">{court.name}</span>
                  <span className="text-xs">{sportLabels[court.sport_type]}</span>
                </div>
                <RatingInline court={court} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export { AuthLayout }
