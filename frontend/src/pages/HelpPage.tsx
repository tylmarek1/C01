import {
  Ban,
  BarChart3,
  Bell,
  CalendarClock,
  CalendarPlus,
  CalendarSync,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coins,
  Crown,
  Handshake,
  Heart,
  Hourglass,
  LayoutGrid,
  ListChecks,
  Mail,
  MessageCircle,
  Repeat,
  Rss,
  Search,
  ShieldCheck,
  Target,
  Trophy,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { DecorativeBlob } from "@/components/shared/decorative-blob"
import { FeatureItem } from "@/components/shared/feature-item"
import { SectionHeader } from "@/components/shared/section-header"
import { useAuth } from "@/lib/auth-context"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { STATUS_VARIANT, useStatusLabels } from "@/lib/reservation-status"
import type { ReservationStatus } from "@/types"

const QUICK_NAV: { id: string; labelKey: TranslationKey }[] = [
  { id: "getting-started", labelKey: "help.nav.gettingStarted" },
  { id: "booking", labelKey: "help.nav.booking" },
  { id: "states", labelKey: "help.nav.states" },
  { id: "social", labelKey: "help.nav.social" },
  { id: "manage", labelKey: "help.nav.manage" },
  { id: "venue-managers", labelKey: "help.nav.venueManagers" },
  { id: "faq", labelKey: "help.nav.faq" },
]

const GETTING_STARTED: { icon: typeof UserPlus; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  { icon: UserPlus, titleKey: "help.gettingStarted.step1.title", descriptionKey: "help.gettingStarted.step1.description" },
  { icon: Search, titleKey: "help.gettingStarted.step2.title", descriptionKey: "help.gettingStarted.step2.description" },
  { icon: CalendarPlus, titleKey: "help.gettingStarted.step3.title", descriptionKey: "help.gettingStarted.step3.description" },
  { icon: CheckCircle2, titleKey: "help.gettingStarted.step4.title", descriptionKey: "help.gettingStarted.step4.description" },
]

const BOOKING_RULES: { icon: typeof Clock3; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  { icon: Clock3, titleKey: "help.booking.rule1.title", descriptionKey: "help.booking.rule1.description" },
  { icon: Hourglass, titleKey: "help.booking.rule2.title", descriptionKey: "help.booking.rule2.description" },
  { icon: ShieldCheck, titleKey: "help.booking.rule3.title", descriptionKey: "help.booking.rule3.description" },
  { icon: ListChecks, titleKey: "help.booking.rule4.title", descriptionKey: "help.booking.rule4.description" },
]

const RESERVATION_STATES: ReservationStatus[] = [
  "PENDING",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "REJECTED",
  "NO_SHOW",
]

const STATE_DESCRIPTION_KEYS: Record<ReservationStatus, TranslationKey> = {
  PENDING: "help.states.desc.PENDING",
  PENDING_APPROVAL: "help.states.desc.PENDING_APPROVAL",
  CONFIRMED: "help.states.desc.CONFIRMED",
  CHECKED_IN: "help.states.desc.CHECKED_IN",
  COMPLETED: "help.states.desc.COMPLETED",
  CANCELLED: "help.states.desc.CANCELLED",
  EXPIRED: "help.states.desc.EXPIRED",
  REJECTED: "help.states.desc.REJECTED",
  NO_SHOW: "help.states.desc.NO_SHOW",
}

const SOCIAL_FEATURES: { icon: typeof Users; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  { icon: Users, titleKey: "help.social.openGames.title", descriptionKey: "help.social.openGames.description" },
  { icon: Mail, titleKey: "help.social.guests.title", descriptionKey: "help.social.guests.description" },
  { icon: Coins, titleKey: "help.social.split.title", descriptionKey: "help.social.split.description" },
  { icon: Handshake, titleKey: "help.social.teammates.title", descriptionKey: "help.social.teammates.description" },
  { icon: Heart, titleKey: "help.social.profiles.title", descriptionKey: "help.social.profiles.description" },
  { icon: MessageCircle, titleKey: "help.social.chat.title", descriptionKey: "help.social.chat.description" },
  { icon: UsersRound, titleKey: "help.social.teams.title", descriptionKey: "help.social.teams.description" },
  { icon: Trophy, titleKey: "help.social.rating.title", descriptionKey: "help.social.rating.description" },
  { icon: Target, titleKey: "help.social.challenges.title", descriptionKey: "help.social.challenges.description" },
  { icon: Rss, titleKey: "help.social.activityFeed.title", descriptionKey: "help.social.activityFeed.description" },
  { icon: Camera, titleKey: "help.social.reviewPhotos.title", descriptionKey: "help.social.reviewPhotos.description" },
]

const MANAGE_FEATURES: { icon: typeof Bell; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  { icon: Bell, titleKey: "help.manage.waitlist.title", descriptionKey: "help.manage.waitlist.description" },
  { icon: CalendarSync, titleKey: "help.manage.calendar.title", descriptionKey: "help.manage.calendar.description" },
  { icon: Repeat, titleKey: "help.manage.recurring.title", descriptionKey: "help.manage.recurring.description" },
  { icon: CalendarClock, titleKey: "help.manage.reschedule.title", descriptionKey: "help.manage.reschedule.description" },
  { icon: Heart, titleKey: "help.manage.favorites.title", descriptionKey: "help.manage.favorites.description" },
]

const VENUE_MANAGER_FEATURES: { icon: typeof LayoutGrid; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  { icon: LayoutGrid, titleKey: "help.venueManagers.item1.title", descriptionKey: "help.venueManagers.item1.description" },
  { icon: ClipboardCheck, titleKey: "help.venueManagers.item2.title", descriptionKey: "help.venueManagers.item2.description" },
  { icon: Ban, titleKey: "help.venueManagers.item3.title", descriptionKey: "help.venueManagers.item3.description" },
  { icon: BarChart3, titleKey: "help.venueManagers.item4.title", descriptionKey: "help.venueManagers.item4.description" },
  { icon: UserCog, titleKey: "help.venueManagers.item5.title", descriptionKey: "help.venueManagers.item5.description" },
  { icon: Crown, titleKey: "help.venueManagers.item6.title", descriptionKey: "help.venueManagers.item6.description" },
]

const FAQ_ITEMS: { questionKey: TranslationKey; answerKey: TranslationKey }[] = [
  { questionKey: "landing.faq.hold.question", answerKey: "landing.faq.hold.answer" },
  { questionKey: "landing.faq.approval.question", answerKey: "landing.faq.approval.answer" },
  { questionKey: "landing.faq.cancel.question", answerKey: "landing.faq.cancel.answer" },
  { questionKey: "landing.faq.limit.question", answerKey: "landing.faq.limit.answer" },
  { questionKey: "help.faq.duration.question", answerKey: "help.faq.duration.answer" },
  { questionKey: "help.faq.guests.question", answerKey: "help.faq.guests.answer" },
  { questionKey: "help.faq.split.question", answerKey: "help.faq.split.answer" },
  { questionKey: "help.faq.openGames.question", answerKey: "help.faq.openGames.answer" },
  { questionKey: "help.faq.waitlist.question", answerKey: "help.faq.waitlist.answer" },
  { questionKey: "help.faq.calendar.question", answerKey: "help.faq.calendar.answer" },
  { questionKey: "help.faq.noShow.question", answerKey: "help.faq.noShow.answer" },
  { questionKey: "help.faq.language.question", answerKey: "help.faq.language.answer" },
  { questionKey: "help.faq.free.question", answerKey: "help.faq.free.answer" },
  { questionKey: "help.faq.becomeManager.question", answerKey: "help.faq.becomeManager.answer" },
  { questionKey: "help.faq.becomeAdmin.question", answerKey: "help.faq.becomeAdmin.answer" },
  { questionKey: "help.faq.profileVisibility.question", answerKey: "help.faq.profileVisibility.answer" },
  { questionKey: "help.faq.matchResult.question", answerKey: "help.faq.matchResult.answer" },
  { questionKey: "help.faq.teamMembers.question", answerKey: "help.faq.teamMembers.answer" },
]

function QuickNav() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t("help.nav.aria")} className="flex flex-wrap justify-center gap-2">
      {QUICK_NAV.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-full border border-hairline bg-card px-3.5 py-1.5 text-sm font-medium text-slate-gray shadow-sm transition-colors hover:border-signal-blue/40 hover:text-ink-navy"
        >
          {t(item.labelKey)}
        </a>
      ))}
    </nav>
  )
}

function FeatureGrid({ items }: { items: { icon: typeof Users; titleKey: TranslationKey; descriptionKey: TranslationKey }[] }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.titleKey} className="rounded-2xl border border-hairline bg-card p-6 shadow-card">
          <FeatureItem icon={item.icon} title={t(item.titleKey)} description={t(item.descriptionKey)} />
        </div>
      ))}
    </div>
  )
}

function HelpPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const statusLabels = useStatusLabels()

  return (
    <div>
      <section className="relative mx-auto max-w-4xl overflow-hidden px-6 pt-16 pb-10 text-center sm:pt-24">
        <DecorativeBlob color="cyan" className="-top-10 right-10 size-64" />
        <DecorativeBlob color="magenta" className="bottom-0 left-0 size-56" />
        <SectionHeader eyebrow={t("help.hero.eyebrow")} title={t("help.hero.title")} description={t("help.hero.description")} />
        <div className="relative mt-10">
          <QuickNav />
        </div>
      </section>

      <section id="getting-started" className="mx-auto max-w-5xl px-6 pb-20">
        <SectionHeader
          align="left"
          eyebrow={t("help.gettingStarted.eyebrow")}
          title={t("help.gettingStarted.title")}
          description={t("help.gettingStarted.description")}
          className="mb-10"
        />
        <div className="flex flex-col rounded-2xl border border-hairline bg-card px-6 shadow-card">
          {GETTING_STARTED.map((step) => (
            <FeatureItem key={step.titleKey} icon={step.icon} title={t(step.titleKey)} description={t(step.descriptionKey)} />
          ))}
        </div>
      </section>

      <section id="booking" className="mx-auto max-w-5xl px-6 pb-20">
        <SectionHeader
          align="left"
          eyebrow={t("help.booking.eyebrow")}
          title={t("help.booking.title")}
          description={t("help.booking.description")}
          className="mb-10"
        />
        <FeatureGrid items={BOOKING_RULES} />
      </section>

      <section id="states" className="mx-auto max-w-5xl px-6 pb-20">
        <SectionHeader
          align="left"
          eyebrow={t("help.states.eyebrow")}
          title={t("help.states.title")}
          description={t("help.states.description")}
          className="mb-10"
        />
        <div className="flex flex-col gap-3">
          {RESERVATION_STATES.map((status) => (
            <div
              key={status}
              className="flex flex-col gap-2 rounded-2xl border border-hairline bg-card p-5 shadow-card sm:flex-row sm:items-center sm:gap-5"
            >
              <Badge variant={STATUS_VARIANT[status]} className="w-fit shrink-0 sm:w-28 sm:justify-center">
                {statusLabels[status]}
              </Badge>
              <p className="text-sm text-slate-gray">{t(STATE_DESCRIPTION_KEYS[status])}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="social" className="mx-auto max-w-5xl px-6 pb-20">
        <SectionHeader
          align="left"
          eyebrow={t("help.social.eyebrow")}
          title={t("help.social.title")}
          description={t("help.social.description")}
          className="mb-10"
        />
        <FeatureGrid items={SOCIAL_FEATURES} />
      </section>

      <section id="manage" className="mx-auto max-w-5xl px-6 pb-20">
        <SectionHeader
          align="left"
          eyebrow={t("help.manage.eyebrow")}
          title={t("help.manage.title")}
          description={t("help.manage.description")}
          className="mb-10"
        />
        <FeatureGrid items={MANAGE_FEATURES} />
      </section>

      <section id="venue-managers" className="mx-auto max-w-5xl px-6 pb-20">
        <SectionHeader
          align="left"
          eyebrow={t("help.venueManagers.eyebrow")}
          title={t("help.venueManagers.title")}
          description={t("help.venueManagers.description")}
          className="mb-10"
        />
        <div className="flex flex-col rounded-2xl border border-hairline bg-card px-6 shadow-card">
          {VENUE_MANAGER_FEATURES.map((item) => (
            <FeatureItem key={item.titleKey} icon={item.icon} title={t(item.titleKey)} description={t(item.descriptionKey)} />
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-6 pb-20">
        <SectionHeader align="left" eyebrow={t("help.faq.eyebrow")} title={t("help.faq.title")} className="mb-10" />
        <div className="flex flex-col gap-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item.questionKey} className="group rounded-2xl border border-hairline bg-card p-5 shadow-card open:pb-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink-navy marker:content-none">
                {t(item.questionKey)}
                <span className="shrink-0 text-lg text-slate-gray transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-slate-gray">{t(item.answerKey)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-center gap-6 rounded-3xl bg-ink-navy px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-paper sm:text-4xl">{t("help.cta.title")}</h2>
          <p className="max-w-md text-mist-gray">{t("help.cta.description")}</p>
          <Button size="lg" asChild>
            <Link to={user ? "/app/book" : "/register"}>{user ? t("help.cta.button.authed") : t("help.cta.button")}</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

export { HelpPage }
