import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarCheck2,
  CalendarSync,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coins,
  MessageCircle,
  Repeat,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CourtCard } from "@/components/shared/court-card"
import { CtaBand, FaqList, MarketingSection } from "@/components/shared/marketing"
import { SectionHeader } from "@/components/shared/section-header"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { addDays, useFormatters } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { useCourts } from "@/lib/queries"
import { cn } from "@/lib/utils"
import type { SportType } from "@/types"

const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]
// Purely illustrative availability pattern for the hero mock — not data.
const MOCK_SLOTS: ("free" | "taken" | "selected")[] = ["taken", "free", "free", "taken", "selected", "free", "taken", "taken", "free", "free", "free", "taken"]

/** Product preview composed from real UI primitives; decorative, so hidden from AT. */
function HeroPreview({ courtName, sport }: { courtName: string; sport: SportType }) {
  const { t } = useTranslation()
  const fmt = useFormatters()
  const today = new Date()
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none lg:mx-0">
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_40%,transparent),transparent)] opacity-70 blur-2xl dark:opacity-30" />
      <div className="animate-fade-up rounded-2xl border border-border bg-card p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <SportIcon sport={sport} className="size-5" />
          </span>
          <div className="flex flex-col">
            <span className="text-[14px] font-semibold">{courtName}</span>
            <span className="text-xs text-muted-foreground">{t("landing.preview.subtitle")}</span>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-brand-ink uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-brand-ink" /> {t("common.live")}
          </span>
        </div>
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => {
            const day = addDays(today, i)
            return (
              <span
                key={i}
                className={cn(
                  "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-md border text-center",
                  i === 1 ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                <span className="font-mono text-[9px] uppercase opacity-70">{fmt.weekday(day)}</span>
                <span className="text-[14px] font-semibold tabular">{day.getDate()}</span>
              </span>
            )
          })}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {MOCK_SLOTS.map((state, i) => (
            <span
              key={i}
              className={cn(
                "flex h-8 items-center justify-center rounded-sm border font-mono text-[11.5px] tabular",
                state === "free" && "border-border",
                state === "taken" && "border-transparent bg-muted text-subtle-foreground line-through",
                state === "selected" && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {String(16 + Math.floor(i / 2)).padStart(2, "0")}:{i % 2 ? "30" : "00"}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">{t("landing.preview.summary")}</span>
          <span className="font-mono text-[13px] font-semibold tabular">18:00–19:00</span>
        </div>
        <span className="mt-3 flex h-10 items-center justify-center rounded-md bg-brand text-[14px] font-medium text-brand-foreground">{t("book.submit")}</span>
      </div>

      <div className="absolute -bottom-8 -left-4 flex animate-fade-up items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-lg [animation-delay:250ms] sm:-left-10">
        <span className="flex size-8 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-4" />
        </span>
        <span className="flex flex-col">
          <span className="text-[13px] font-semibold">{t("landing.preview.confirmed")}</span>
          <span className="text-[11px] text-muted-foreground">{t("landing.preview.confirmedHint")}</span>
        </span>
      </div>
      <div className="absolute -top-6 -right-3 hidden animate-fade-up items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-lg [animation-delay:400ms] sm:flex sm:-right-8">
        <span className="flex -space-x-2">
          {["AV", "MT", "JG"].map((initials) => (
            <span key={initials} className="flex size-7 items-center justify-center rounded-full bg-wash-strong text-[10px] font-semibold ring-2 ring-card">
              {initials}
            </span>
          ))}
        </span>
        <span className="flex flex-col">
          <span className="text-[13px] font-semibold">{t("landing.preview.openGame")}</span>
          <span className="text-[11px] text-muted-foreground">{t("landing.preview.openGameHint")}</span>
        </span>
      </div>
    </div>
  )
}

function LandingPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const { data: courts, isLoading } = useCourts()
  const { data: trendingCourts } = useQuery({ queryKey: ["courts-trending", 4], queryFn: () => api.listTrendingCourts(7, 4) })
  const showcase = trendingCourts && trendingCourts.length >= 3 ? trendingCourts.slice(0, 3) : (courts ?? []).slice(0, 3)
  const heroCourt = showcase[0]
  const primaryCta = user ? "/app/book" : "/register"

  const sportCounts = SPORTS.map((sport) => ({ sport, count: (courts ?? []).filter((c) => c.sport_type === sport).length }))

  const steps: { icon: LucideIcon; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
    { icon: Clock3, titleKey: "howItWorks.step1.title", descriptionKey: "howItWorks.step1.description" },
    { icon: ShieldCheck, titleKey: "howItWorks.step2.title", descriptionKey: "howItWorks.step2.description" },
    { icon: CalendarCheck2, titleKey: "howItWorks.step3.title", descriptionKey: "howItWorks.step3.description" },
  ]

  const features: { icon: LucideIcon; titleKey: TranslationKey; descriptionKey: TranslationKey; wide?: boolean }[] = [
    { icon: Users, titleKey: "landing.why.openGames.title", descriptionKey: "landing.why.openGames.description", wide: true },
    { icon: Bell, titleKey: "landing.why.waitlist.title", descriptionKey: "landing.why.waitlist.description" },
    { icon: Coins, titleKey: "landing.why.split.title", descriptionKey: "landing.why.split.description" },
    { icon: CalendarSync, titleKey: "landing.why.calendarSync.title", descriptionKey: "landing.why.calendarSync.description" },
    { icon: Repeat, titleKey: "landing.why.recurring.title", descriptionKey: "landing.why.recurring.description" },
    { icon: Trophy, titleKey: "landing.why.achievements.title", descriptionKey: "landing.why.achievements.description" },
    { icon: UserPlus, titleKey: "landing.why.teams.title", descriptionKey: "landing.why.teams.description" },
    { icon: MessageCircle, titleKey: "landing.why.chat.title", descriptionKey: "landing.why.chat.description", wide: true },
    { icon: Star, titleKey: "landing.why.rating.title", descriptionKey: "landing.why.rating.description", wide: true },
  ]

  const managerPoints: { icon: LucideIcon; key: TranslationKey }[] = [
    { icon: ClipboardCheck, key: "landing.venue.point.approvals" },
    { icon: BarChart3, key: "landing.venue.point.analytics" },
    { icon: CalendarSync, key: "landing.venue.point.blocks" },
    { icon: Sparkles, key: "landing.venue.point.challenges" },
  ]

  const faq: { questionKey: TranslationKey; answerKey: TranslationKey }[] = [
    { questionKey: "landing.faq.hold.question", answerKey: "landing.faq.hold.answer" },
    { questionKey: "landing.faq.approval.question", answerKey: "landing.faq.approval.answer" },
    { questionKey: "landing.faq.cancel.question", answerKey: "landing.faq.cancel.answer" },
    { questionKey: "landing.faq.limit.question", answerKey: "landing.faq.limit.answer" },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10 bg-court-grid opacity-60 [mask-image:radial-gradient(60%_60%_at_70%_30%,black,transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-14 pb-24 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
          <div className="flex animate-fade-up flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium shadow-xs">
              <span className="flex -space-x-1">
                {SPORTS.map((sport) => (
                  <span key={sport} className="flex size-5 items-center justify-center rounded-full bg-muted ring-2 ring-card">
                    <SportIcon sport={sport} className="size-3" />
                  </span>
                ))}
              </span>
              {t("hero.badge")}
            </span>
            <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-[72px]">{t("hero.title")}</h1>
            <p className="max-w-lg text-[17px] leading-relaxed text-pretty text-muted-foreground">{t("hero.description")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="brand" size="xl" asChild>
                <Link to={primaryCta}>
                  {user ? t("hero.cta.authed") : t("hero.cta.signup")} <ArrowRight />
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <Link to="/courts">{t("hero.cta.browse")}</Link>
              </Button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
              {(["landing.trust.noDoubleBooking", "landing.trust.hold", "landing.trust.free"] as TranslationKey[]).map((key) => (
                <li key={key} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-brand-ink" /> {t(key)}
                </li>
              ))}
            </ul>
          </div>
          {heroCourt ? <HeroPreview courtName={heroCourt.name} sport={heroCourt.sport_type} /> : <Skeleton className="mx-auto h-[420px] w-full max-w-md rounded-2xl" />}
        </div>
      </section>

      {/* Sports strip */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl divide-y divide-border px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          {sportCounts.map(({ sport, count }) => (
            <Link key={sport} to={`/courts?sport=${sport}`} className="group flex items-center gap-4 px-2 py-6 transition-colors hover:bg-muted/40 sm:px-6">
              <span className="flex size-11 items-center justify-center rounded-lg border border-border bg-background">
                <SportIcon sport={sport} className="size-5" />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-[15px] font-semibold">{sportLabels[sport]}</span>
                <span className="text-xs text-muted-foreground">
                  {isLoading ? "…" : t("landing.sports.courtCount", { count })}
                </span>
              </span>
              <ArrowUpRight className="size-4 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <MarketingSection id="how">
        <SectionHeader eyebrow={t("howItWorks.eyebrow")} title={t("howItWorks.title")} description={t("howItWorks.description")} className="mb-14" />
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.titleKey} className="relative flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-xs">
              <span className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                  <step.icon className="size-5" />
                </span>
                <span className="font-mono text-[44px] leading-none font-semibold text-border-strong tabular">0{index + 1}</span>
              </span>
              <h3 className="text-[17px] font-semibold tracking-[-0.015em]">{t(step.titleKey)}</h3>
              <p className="text-[14px] leading-relaxed text-muted-foreground">{t(step.descriptionKey)}</p>
            </li>
          ))}
        </ol>
      </MarketingSection>

      {/* Features bento */}
      <MarketingSection className="pt-0 sm:pt-0">
        <SectionHeader eyebrow={t("landing.why.eyebrow")} title={t("landing.why.title")} description={t("landing.why.description")} className="mb-14" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.titleKey}
              className={cn(
                "group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs surface-interactive",
                feature.wide && "lg:col-span-2",
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-md border border-border bg-background transition-colors group-hover:border-transparent group-hover:bg-brand group-hover:text-brand-foreground">
                <feature.icon className="size-4" />
              </span>
              <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{t(feature.titleKey)}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{t(feature.descriptionKey)}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      {/* Courts showcase */}
      <MarketingSection className="pt-0 sm:pt-0">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader align="left" eyebrow={t("landing.courts.eyebrow")} title={t("landing.courts.title")} />
          <Button variant="outline" asChild>
            <Link to="/courts">
              {t("howItWorks.viewAll")} <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-80 rounded-xl" />)}
          {showcase.map((court) => (
            <CourtCard key={court.id} court={court} href={`/courts/${court.id}`} />
          ))}
        </div>
      </MarketingSection>

      {/* Venue managers */}
      <MarketingSection id="venue" className="pt-0 sm:pt-0">
        <div className="grid items-center gap-10 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-10 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <span className="eyebrow">{t("landing.venueManager.eyebrow")}</span>
            <h2 className="text-3xl leading-[1.1] font-semibold tracking-[-0.035em]">{t("landing.venueManager.title")}</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{t("landing.venueManager.description")}</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {managerPoints.map((point) => (
                <li key={point.key} className="flex items-start gap-2.5 text-[14px]">
                  <point.icon className="mt-0.5 size-4 shrink-0 text-brand-ink" /> {t(point.key)}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-fit" asChild>
              <Link to="/help#venue-managers">
                {t("landing.venueManager.cta")} <ArrowRight />
              </Link>
            </Button>
          </div>
          <div aria-hidden className="relative rounded-xl border border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold">{t("admin.overview.busiestHoursTitle")}</span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase">7–21h</span>
            </div>
            <div className="flex h-32 items-end gap-[3px]">
              {[2, 3, 2, 4, 3, 2, 3, 5, 6, 8, 9, 7, 6, 4, 3].map((v, i) => (
                <span key={i} className={cn("flex-1 rounded-t-[4px]", v === 9 ? "bg-brand" : "bg-foreground/80")} style={{ height: `${(v / 9) * 100}%` }} />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: t("status.PENDING_APPROVAL"), value: "3" },
                { label: t("admin.overview.noShowRate"), value: "4%" },
                { label: t("admin.overview.courts"), value: String(courts?.length ?? 6) },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="truncate text-[10.5px] text-muted-foreground">{kpi.label}</div>
                  <div className="text-lg font-semibold tabular">{kpi.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Pricing */}
      <MarketingSection id="pricing" size="narrow" className="pt-0 text-center sm:pt-0">
        <SectionHeader eyebrow={t("pricing.eyebrow")} title={t("pricing.title")} description={t("pricing.description")} className="mb-10" />
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 shadow-md">
          <span className="text-[56px] leading-none font-semibold tracking-[-0.05em] tabular">0 Kč</span>
          <p className="text-[14px] text-muted-foreground">{t("pricing.unlimited")}</p>
          <ul className="flex w-full flex-col gap-2 border-y border-border py-4 text-left text-[13px]">
            {(["landing.pricing.f1", "landing.pricing.f2", "landing.pricing.f3"] as TranslationKey[]).map((key) => (
              <li key={key} className="flex items-center gap-2">
                <Check className="size-4 text-brand-ink" /> {t(key)}
              </li>
            ))}
          </ul>
          <Button variant="brand" size="lg" className="w-full" asChild>
            <Link to={primaryCta}>{user ? t("pricing.cta.authed") : t("pricing.cta")}</Link>
          </Button>
        </div>
      </MarketingSection>

      {/* FAQ */}
      <MarketingSection id="faq" size="narrow" className="pt-0 sm:pt-0">
        <SectionHeader eyebrow={t("landing.faq.eyebrow")} title={t("landing.faq.title")} className="mb-10" />
        <FaqList items={faq.map((item) => ({ question: t(item.questionKey), answer: t(item.answerKey) }))} />
        <div className="mt-6 text-center">
          <Button variant="link" asChild>
            <Link to="/help#faq">{t("landing.faq.viewAll")}</Link>
          </Button>
        </div>
      </MarketingSection>

      <MarketingSection className="pt-0 sm:pt-0">
        <CtaBand title={t("cta.title")} description={t("cta.description")} cta={user ? t("cta.button.authed") : t("cta.button")} to={primaryCta} />
      </MarketingSection>
    </div>
  )
}

export { LandingPage }
