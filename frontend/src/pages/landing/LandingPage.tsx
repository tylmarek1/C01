import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarCheck2,
  CalendarSync,
  Check,
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
import { CourtArt } from "@/components/shared/court-art"
import { CourtCard } from "@/components/shared/court-card"
import { CtaBand, FaqList, MarketingSection } from "@/components/shared/marketing"
import { SectionHeader } from "@/components/shared/section-header"
import { useSportLabels } from "@/components/shared/sport-icon"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { useCourts } from "@/lib/queries"
import { cn } from "@/lib/utils"
import type { SportType } from "@/types"

const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]
const BOARD_HOURS = [16, 17, 18, 19, 20, 21]
// Purely illustrative availability pattern for the hero board — not data.
const BOARD_PATTERN: ("free" | "taken" | "yours")[][] = [
  ["taken", "free", "taken", "taken", "free", "free"],
  ["free", "free", "yours", "taken", "taken", "free"],
  ["taken", "taken", "free", "free", "taken", "free"],
]

/** The hero's "today's board": a ruled timetable of courts × hours, set like
 * the schedule pinned up in a clubhouse. Decorative, so hidden from AT. */
function HeroBoard({ courtNames }: { courtNames: string[] }) {
  const { t } = useTranslation()
  const fmt = useFormatters()
  return (
    <div aria-hidden className="relative w-full select-none">
      <div className="animate-fade-up rounded-md border border-foreground bg-card">
        <div className="flex items-center justify-between border-b border-foreground px-4 py-3">
          <span className="display text-[24px]">{t("landing.board.title")}</span>
          <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.08em] uppercase">
            <span className="size-1.5 animate-blink bg-brand" /> {t("common.live")} · {fmt.dayMonth(new Date())}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,6.5rem)_repeat(6,minmax(0,1fr))] sm:grid-cols-[minmax(0,8rem)_repeat(6,minmax(0,1fr))] text-center">
          <span className="border-b border-border" />
          {BOARD_HOURS.map((hour) => (
            <span key={hour} className="border-b border-l border-border py-2 font-mono text-[10.5px] text-muted-foreground tabular">
              {hour}
              <span className="hidden sm:inline">:00</span>
            </span>
          ))}
          {BOARD_PATTERN.map((row, rowIndex) => (
            <div key={rowIndex} className="contents">
              <span className="flex items-center border-b border-border px-3 text-left font-display text-[16px] leading-[0.95] font-extrabold uppercase">
                <span className="line-clamp-2">{courtNames[rowIndex] ?? "—"}</span>
              </span>
              {row.map((cell, cellIndex) => (
                <span
                  key={cellIndex}
                  className={cn(
                    "flex h-16 items-center justify-center border-b border-l border-border",
                    cell === "taken" && "bg-hatch bg-muted",
                    cell === "yours" && "animate-pop bg-brand font-mono text-[10px] font-semibold tracking-[0.08em] text-brand-foreground uppercase [animation-delay:600ms]",
                  )}
                >
                  {cell === "yours" && t("landing.board.yours")}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 pr-32 font-mono text-[10.5px] tracking-[0.04em] text-muted-foreground uppercase">{t("landing.board.caption")}</div>
      </div>

      {/* The sticker slapped on the board. */}
      <span
        className="absolute -right-3 -bottom-16 flex size-28 animate-stamp sm:size-32 items-center justify-center rounded-full bg-brand p-4 text-center font-display text-[19px] leading-[0.95] font-black text-brand-foreground uppercase [animation-delay:350ms] sm:-right-8"
        style={{ "--stamp-rotate": "-10deg" } as React.CSSProperties}
      >
        <span className="absolute inset-1.5 rounded-full border border-dashed border-brand-foreground/60" />
        {t("landing.sticker")}
      </span>
    </div>
  )
}

/** A forest band with the sports and promises scrolling past, like a stadium ticker. */
function Ticker({ items }: { items: string[] }) {
  const row = [...items, ...items]
  return (
    <div aria-hidden className="overflow-hidden border-y border-foreground bg-panel py-3 text-panel-foreground">
      <div className="flex w-max animate-ticker gap-8 whitespace-nowrap motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-8">
            {row.map((item, index) => (
              <span key={`${copy}-${index}`} className="flex items-center gap-8 font-display text-[28px] leading-none font-extrabold uppercase">
                {item}
                <span className="size-2.5 rounded-full bg-brand" />
              </span>
            ))}
          </div>
        ))}
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

  const tickerItems = [...SPORTS.map((sport) => sportLabels[sport]), t("landing.trust.noDoubleBooking"), t("landing.trust.hold"), t("landing.trust.free")]

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-12 pb-20 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div className="flex flex-col gap-7">
            <span className="eyebrow flex items-center gap-2 text-foreground">
              <span aria-hidden className="size-2 bg-brand" />
              {t("hero.badge")}
            </span>
            <h1 className="display animate-fade-up text-[64px] text-balance sm:text-[96px] lg:text-[112px]">{t("hero.title")}</h1>
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
            <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t border-foreground pt-4 font-mono text-[11px] tracking-[0.06em] uppercase">
              {(["landing.trust.noDoubleBooking", "landing.trust.hold", "landing.trust.free"] as TranslationKey[]).map((key) => (
                <li key={key} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-brand-ink" /> {t(key)}
                </li>
              ))}
            </ul>
          </div>
          {courts ? (
            <HeroBoard courtNames={showcase.length ? showcase.map((court) => court.name) : courts.slice(0, 3).map((court) => court.name)} />
          ) : (
            <Skeleton className="h-[300px] w-full rounded-md" />
          )}
        </div>
      </section>

      <Ticker items={tickerItems} />

      {/* Sports — painted courts */}
      <MarketingSection className="pb-0 sm:pb-0">
        <span className="eyebrow mb-5 flex items-center gap-2">
          <span aria-hidden className="size-2 bg-brand" /> {t("landing.sports.eyebrow")}
        </span>
        <div className="grid gap-4 sm:grid-cols-3">
          {sportCounts.map(({ sport, count }, index) => (
            <Link key={sport} to={`/courts?sport=${sport}`} className="group flex flex-col gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
              <CourtArt sport={sport} hideMeta className="rounded-md" />
              <span className="flex items-baseline justify-between gap-3 border-b-2 border-foreground pb-2">
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] text-subtle-foreground tabular">0{index + 1}</span>
                  <span className="display text-[36px] decoration-2 underline-offset-4 group-hover:underline">{sportLabels[sport]}</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground uppercase">
                  {isLoading ? "…" : t("landing.sports.courtCount", { count })}
                  <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </MarketingSection>

      {/* How it works */}
      <MarketingSection id="how">
        <SectionHeader align="left" eyebrow={t("howItWorks.eyebrow")} title={t("howItWorks.title")} description={t("howItWorks.description")} className="mb-12" />
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step, index) => (
            <li key={step.titleKey} className="flex flex-col gap-4 border-t-2 border-foreground pt-4">
              <span className="flex items-start justify-between">
                <span className="display text-[88px] text-brand">0{index + 1}</span>
                <step.icon className="mt-2 size-6 text-subtle-foreground" />
              </span>
              <h3 className="font-display text-[26px] leading-none font-extrabold uppercase">{t(step.titleKey)}</h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{t(step.descriptionKey)}</p>
            </li>
          ))}
        </ol>
      </MarketingSection>

      {/* Features — set as the programme's contents page */}
      <MarketingSection className="pt-0 sm:pt-0">
        <SectionHeader align="left" eyebrow={t("landing.why.eyebrow")} title={t("landing.why.title")} description={t("landing.why.description")} className="mb-12" />
        <ul className="grid border-t-2 border-foreground md:grid-cols-2 md:gap-x-12">
          {features.map((feature, index) => (
            <li key={feature.titleKey} className="group flex gap-4 border-b border-border py-5">
              <span className="w-7 shrink-0 pt-1 font-mono text-[11px] text-subtle-foreground tabular">{String(index + 1).padStart(2, "0")}</span>
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="flex items-center gap-2.5">
                  <feature.icon className="size-4 shrink-0 text-brand-ink transition-transform duration-300 group-hover:-rotate-12" />
                  <h3 className="text-[17px] font-bold">{t(feature.titleKey)}</h3>
                </span>
                <p className="text-[14px] leading-relaxed text-muted-foreground">{t(feature.descriptionKey)}</p>
              </span>
            </li>
          ))}
        </ul>
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
          {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-80 rounded-md" />)}
          {showcase.map((court) => (
            <CourtCard key={court.id} court={court} href={`/courts/${court.id}`} />
          ))}
        </div>
      </MarketingSection>

      {/* Venue managers — on the forest cover */}
      <MarketingSection id="venue" className="pt-0 sm:pt-0">
        <div className="grid items-center gap-10 overflow-hidden rounded-md bg-panel p-6 text-panel-foreground sm:p-10 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-panel-muted uppercase">
              <span aria-hidden className="size-2 bg-brand" /> {t("landing.venueManager.eyebrow")}
            </span>
            <h2 className="display text-[44px] sm:text-[60px]">{t("landing.venueManager.title")}</h2>
            <p className="text-[15px] leading-relaxed text-panel-muted">{t("landing.venueManager.description")}</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {managerPoints.map((point) => (
                <li key={point.key} className="flex items-start gap-2.5 text-[14px]">
                  <point.icon className="mt-0.5 size-4 shrink-0 text-brand" /> {t(point.key)}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="w-fit border-panel-foreground/30 text-panel-foreground hover:border-panel-foreground hover:bg-panel-foreground/10"
              asChild
            >
              <Link to="/help#venue-managers">
                {t("landing.venueManager.cta")} <ArrowRight />
              </Link>
            </Button>
          </div>
          <div aria-hidden className="relative border border-panel-foreground/20 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-[20px] leading-none font-extrabold uppercase">{t("admin.overview.busiestHoursTitle")}</span>
              <span className="font-mono text-[10px] text-panel-muted uppercase">7–21h</span>
            </div>
            <div className="flex h-36 items-end gap-[3px] border-b border-panel-foreground/30">
              {[2, 3, 2, 4, 3, 2, 3, 5, 6, 8, 9, 7, 6, 4, 3].map((v, i) => (
                <span
                  key={i}
                  className={cn("flex-1 origin-bottom animate-[grow-y_700ms_var(--ease-out)_both]", v === 9 ? "bg-brand" : "bg-panel-foreground/75")}
                  style={{ height: `${(v / 9) * 100}%`, animationDelay: `${i * 30}ms` }}
                />
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-4">
              {[
                { label: t("status.PENDING_APPROVAL"), value: "3" },
                { label: t("admin.overview.noShowRate"), value: "4%" },
                { label: t("admin.overview.courts"), value: String(courts?.length ?? 6) },
              ].map((kpi) => (
                <div key={kpi.label} className="border-t border-panel-foreground/30 pt-2">
                  <div className="truncate font-mono text-[10px] tracking-[0.06em] text-panel-muted uppercase">{kpi.label}</div>
                  <div className="display mt-1 text-[34px]">{kpi.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Pricing — a season pass */}
      <MarketingSection id="pricing" className="pt-0 sm:pt-0">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SectionHeader align="left" eyebrow={t("pricing.eyebrow")} title={t("pricing.title")} description={t("pricing.description")} />
          <div
            className="ticket grid grid-cols-[6.5rem_minmax(0,1fr)] overflow-hidden rounded-md border border-foreground bg-card"
            style={{ "--perf": "6.5rem" } as React.CSSProperties}
          >
            <div className="flex flex-col items-center justify-center gap-2 border-r-2 border-dashed border-foreground/30 bg-brand px-2 py-6 text-brand-foreground">
              <span className="display text-[44px] [writing-mode:vertical-rl] rotate-180">{t("landing.pricing.pass")}</span>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-3 font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground uppercase">
                <span>{t("landing.pricing.admits")}</span>
                <span>{t("landing.pricing.valid")}</span>
              </div>
              <span className="display text-[88px] normal-case!">0 Kč</span>
              <p className="text-[14px] text-muted-foreground">{t("pricing.unlimited")}</p>
              <ul className="flex flex-col gap-2 border-y border-dashed border-foreground/25 py-4 text-[14px]">
                {(["landing.pricing.f1", "landing.pricing.f2", "landing.pricing.f3"] as TranslationKey[]).map((key) => (
                  <li key={key} className="flex items-center gap-2">
                    <Check className="size-4 text-brand-ink" /> {t(key)}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="w-full" asChild>
                <Link to={primaryCta}>{user ? t("pricing.cta.authed") : t("pricing.cta")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* FAQ */}
      <MarketingSection id="faq" size="narrow" className="pt-0 sm:pt-0">
        <SectionHeader align="left" eyebrow={t("landing.faq.eyebrow")} title={t("landing.faq.title")} className="mb-10" />
        <FaqList items={faq.map((item) => ({ question: t(item.questionKey), answer: t(item.answerKey) }))} />
        <div className="mt-6">
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
