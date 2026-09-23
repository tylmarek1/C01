import { useQuery } from "@tanstack/react-query"
import { Bell, CalendarCheck2, CalendarSync, Clock3, Coins, MessageCircle, ShieldCheck, Star, Trophy, UserPlus, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CourtCard } from "@/components/shared/court-card"
import { DecorativeBlob } from "@/components/shared/decorative-blob"
import { FeatureItem } from "@/components/shared/feature-item"
import { SectionHeader } from "@/components/shared/section-header"
import { SportIcon } from "@/components/shared/sport-icon"
import { Skeleton } from "@/components/ui/skeleton"
import { StatTile } from "@/components/shared/stat-tile"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation, type TranslationKey } from "@/lib/i18n"

function LandingPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { data: courts, isLoading } = useQuery({ queryKey: ["courts"], queryFn: () => api.listCourts() })
  const { data: trendingCourts, isLoading: isLoadingTrending } = useQuery({
    queryKey: ["courts-trending"],
    queryFn: () => api.listTrendingCourts(7, 3),
  })
  const heroCourts = trendingCourts && trendingCourts.length > 0 ? trendingCourts : (courts ?? []).slice(0, 3)

  const steps: { icon: typeof Clock3; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
    { icon: Clock3, titleKey: "howItWorks.step1.title", descriptionKey: "howItWorks.step1.description" },
    { icon: ShieldCheck, titleKey: "howItWorks.step2.title", descriptionKey: "howItWorks.step2.description" },
    { icon: CalendarCheck2, titleKey: "howItWorks.step3.title", descriptionKey: "howItWorks.step3.description" },
  ]

  const differentiators: { icon: typeof Users; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
    { icon: Users, titleKey: "landing.why.openGames.title", descriptionKey: "landing.why.openGames.description" },
    { icon: Bell, titleKey: "landing.why.waitlist.title", descriptionKey: "landing.why.waitlist.description" },
    { icon: Coins, titleKey: "landing.why.split.title", descriptionKey: "landing.why.split.description" },
    { icon: CalendarSync, titleKey: "landing.why.calendarSync.title", descriptionKey: "landing.why.calendarSync.description" },
    { icon: Clock3, titleKey: "landing.why.recurring.title", descriptionKey: "landing.why.recurring.description" },
    { icon: Trophy, titleKey: "landing.why.achievements.title", descriptionKey: "landing.why.achievements.description" },
    { icon: UserPlus, titleKey: "landing.why.teams.title", descriptionKey: "landing.why.teams.description" },
    { icon: MessageCircle, titleKey: "landing.why.chat.title", descriptionKey: "landing.why.chat.description" },
    { icon: Star, titleKey: "landing.why.rating.title", descriptionKey: "landing.why.rating.description" },
  ]

  const faqTeaser: { questionKey: TranslationKey; answerKey: TranslationKey }[] = [
    { questionKey: "landing.faq.hold.question", answerKey: "landing.faq.hold.answer" },
    { questionKey: "landing.faq.approval.question", answerKey: "landing.faq.approval.answer" },
    { questionKey: "landing.faq.cancel.question", answerKey: "landing.faq.cancel.answer" },
    { questionKey: "landing.faq.limit.question", answerKey: "landing.faq.limit.answer" },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20 sm:pt-24">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Badge className="w-fit">{t("hero.badge")}</Badge>
            <h1 className="text-5xl leading-[1.1] font-bold text-balance text-ink-navy sm:text-6xl lg:text-[4.5rem]">
              {t("hero.title")}
            </h1>
            <p className="max-w-md text-lg text-slate-gray">{t("hero.description")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to={user ? "/app/book" : "/register"}>{user ? t("hero.cta.authed") : t("hero.cta.signup")}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/courts">{t("hero.cta.browse")}</Link>
              </Button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <DecorativeBlob color="cyan" className="-top-12 -right-8 size-72" />
            <DecorativeBlob color="magenta" className="-bottom-12 -left-8 size-64" />
            <Card className="relative w-full max-w-sm gap-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-navy">{t("hero.card.title")}</span>
                <Badge>{t("hero.card.live")}</Badge>
              </div>
              <div className="flex flex-col gap-3">
                {(isLoading || isLoadingTrending) &&
                  Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
                {heroCourts.map((court) => (
                  <Link
                    key={court.id}
                    to={`/courts/${court.id}`}
                    className="flex items-center gap-3 rounded-xl border border-hairline p-3 transition-colors hover:border-signal-blue/40 hover:bg-highlight-blue"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pebble text-ink-navy">
                      <SportIcon sport={court.sport_type} className="size-4" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-ink-navy">{court.name}</span>
                      <span className="text-xs text-slate-gray">{court.indoor ? t("courts.indoor") : t("courts.outdoor")}</span>
                    </div>
                    <span className="ml-auto text-xs font-medium text-signal-blue">
                      {court.review_count > 0 ? `★ ${court.average_rating?.toFixed(1)}` : t("courts.viewCourt")}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile icon={CalendarCheck2} label={t("stats.courts")} value={courts?.length ?? "–"} />
          <StatTile icon={ShieldCheck} label={t("stats.sports")} value="3" />
          <StatTile icon={Clock3} label={t("stats.hours")} value="07:00–22:00" />
        </div>
      </section>

      {/* How it works + court list */}
      <section id="courts" className="mx-auto max-w-6xl px-6 pb-24">
        <SectionHeader
          eyebrow={t("howItWorks.eyebrow")}
          title={t("howItWorks.title")}
          description={t("howItWorks.description")}
          className="mb-14"
        />
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="flex flex-col">
            {steps.map((step) => (
              <FeatureItem key={step.titleKey} icon={step.icon} title={t(step.titleKey)} description={t(step.descriptionKey)} />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}
            {courts?.slice(0, 4).map((court) => (
              <CourtCard key={court.id} court={court} href={`/courts/${court.id}`} compact />
            ))}
            <Button variant="link" asChild className="mt-1 w-fit">
              <Link to="/courts">{t("howItWorks.viewAll")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why Courtly — real differentiators, not generic marketing */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <SectionHeader
          eyebrow={t("landing.why.eyebrow")}
          title={t("landing.why.title")}
          description={t("landing.why.description")}
          className="mb-14"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {differentiators.map((item) => (
            <div key={item.titleKey} className="rounded-2xl border border-hairline bg-card p-6 shadow-card">
              <FeatureItem icon={item.icon} title={t(item.titleKey)} description={t(item.descriptionKey)} />
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <SectionHeader
          eyebrow={t("pricing.eyebrow")}
          title={t("pricing.title")}
          description={t("pricing.description")}
          className="mb-10"
        />
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-3xl border border-hairline bg-card p-10 shadow-card">
          <span className="text-5xl font-bold text-ink-navy">$0</span>
          <p className="text-slate-gray">{t("pricing.unlimited")}</p>
          <Button size="lg" className="mt-2 w-full" asChild>
            <Link to={user ? "/app/book" : "/register"}>{user ? t("pricing.cta.authed") : t("pricing.cta")}</Link>
          </Button>
        </div>
      </section>

      {/* FAQ teaser */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-24">
        <SectionHeader eyebrow={t("landing.faq.eyebrow")} title={t("landing.faq.title")} className="mb-10" />
        <div className="flex flex-col gap-3">
          {faqTeaser.map((item) => (
            <details
              key={item.questionKey}
              className="group rounded-2xl border border-hairline bg-card p-5 shadow-card open:pb-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink-navy marker:content-none">
                {t(item.questionKey)}
                <span className="shrink-0 text-lg text-slate-gray transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-slate-gray">{t(item.answerKey)}</p>
            </details>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button variant="link" asChild>
            <Link to="/help#faq">{t("landing.faq.viewAll")} →</Link>
          </Button>
        </div>
      </section>

      {/* Venue manager callout — the second real actor in the domain, currently invisible to a player-focused hero */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-hairline bg-cloud px-8 py-14 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col gap-2">
            <span className="w-fit rounded-full bg-tint-blue px-2.5 py-1 text-xs font-medium text-deep-cobalt sm:mx-0">
              {t("landing.venueManager.eyebrow")}
            </span>
            <h2 className="text-2xl font-bold text-ink-navy sm:text-3xl">{t("landing.venueManager.title")}</h2>
            <p className="max-w-md text-slate-gray">{t("landing.venueManager.description")}</p>
          </div>
          <Button size="lg" variant="dark" className="w-full shrink-0 sm:w-auto" asChild>
            <Link to="/help#venue-managers">{t("landing.venueManager.cta")}</Link>
          </Button>
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-center gap-6 rounded-3xl bg-ink-navy px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-paper sm:text-4xl">{t("cta.title")}</h2>
          <p className="max-w-md text-mist-gray">{t("cta.description")}</p>
          <Button size="lg" asChild>
            <Link to={user ? "/app/book" : "/register"}>{user ? t("cta.button.authed") : t("cta.button")}</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

export { LandingPage }
