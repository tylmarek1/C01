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

import { useEffect, useState } from "react"

import { FeatureItem } from "@/components/shared/feature-item"
import { CtaBand, FaqList } from "@/components/shared/marketing"
import { SectionHeader } from "@/components/shared/section-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { useAuth } from "@/lib/auth-context"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"
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

/** Highlights the section currently in view in the table of contents. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-20% 0px -70% 0px" },
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [ids])
  return active
}

function FeatureGrid({ items }: { items: { icon: typeof Users; titleKey: TranslationKey; descriptionKey: TranslationKey }[] }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.titleKey} className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <FeatureItem icon={item.icon} title={t(item.titleKey)} description={t(item.descriptionKey)} />
        </div>
      ))}
    </div>
  )
}

function HelpSection({ id, eyebrow, title, description, children }: { id: string; eyebrow: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-8 border-t border-border pt-12 first:border-t-0 first:pt-0">
      <SectionHeader align="left" eyebrow={eyebrow} title={title} description={description} className="[&_h2]:text-[28px] sm:[&_h2]:text-[32px]" />
      {children}
    </section>
  )
}

const SECTION_IDS = QUICK_NAV.map((item) => item.id)

function HelpPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const active = useActiveSection(SECTION_IDS)

  return (
    <div>
      <section className="relative isolate overflow-hidden border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <SectionHeader eyebrow={t("help.hero.eyebrow")} title={t("help.hero.title")} description={t("help.hero.description")} />
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-16">
        <nav aria-label={t("help.nav.aria")} className="lg:sticky lg:top-20 lg:self-start">
          <span className="eyebrow mb-3 hidden lg:block">{t("help.nav.title")}</span>
          <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-none lg:flex-col lg:overflow-visible">
            {QUICK_NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={active === item.id ? "true" : undefined}
                  className={cn(
                    "block shrink-0 rounded-sm border-l-2 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                    active === item.id
                      ? "border-brand bg-card text-foreground lg:shadow-xs"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(item.labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-12">
          <HelpSection id="getting-started" eyebrow={t("help.gettingStarted.eyebrow")} title={t("help.gettingStarted.title")} description={t("help.gettingStarted.description")}>
            <ol className="grid gap-3 sm:grid-cols-2">
              {GETTING_STARTED.map((step, index) => (
                <li key={step.titleKey} className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
                  <span className="font-mono text-[13px] font-semibold text-subtle-foreground tabular">0{index + 1}</span>
                  <FeatureItem icon={step.icon} title={t(step.titleKey)} description={t(step.descriptionKey)} />
                </li>
              ))}
            </ol>
          </HelpSection>

          <HelpSection id="booking" eyebrow={t("help.booking.eyebrow")} title={t("help.booking.title")} description={t("help.booking.description")}>
            <FeatureGrid items={BOOKING_RULES} />
          </HelpSection>

          <HelpSection id="states" eyebrow={t("help.states.eyebrow")} title={t("help.states.title")} description={t("help.states.description")}>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {RESERVATION_STATES.map((status) => (
                <li key={status} className="grid gap-2 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-5">
                  <StatusBadge status={status} />
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{t(STATE_DESCRIPTION_KEYS[status])}</p>
                </li>
              ))}
            </ul>
          </HelpSection>

          <HelpSection id="social" eyebrow={t("help.social.eyebrow")} title={t("help.social.title")} description={t("help.social.description")}>
            <FeatureGrid items={SOCIAL_FEATURES} />
          </HelpSection>

          <HelpSection id="manage" eyebrow={t("help.manage.eyebrow")} title={t("help.manage.title")} description={t("help.manage.description")}>
            <FeatureGrid items={MANAGE_FEATURES} />
          </HelpSection>

          <HelpSection id="venue-managers" eyebrow={t("help.venueManagers.eyebrow")} title={t("help.venueManagers.title")} description={t("help.venueManagers.description")}>
            <FeatureGrid items={VENUE_MANAGER_FEATURES} />
          </HelpSection>

          <HelpSection id="faq" eyebrow={t("help.faq.eyebrow")} title={t("help.faq.title")}>
            <FaqList items={FAQ_ITEMS.map((item) => ({ question: t(item.questionKey), answer: t(item.answerKey) }))} />
          </HelpSection>

          <CtaBand
            title={t("help.cta.title")}
            description={t("help.cta.description")}
            cta={user ? t("help.cta.button.authed") : t("help.cta.button")}
            to={user ? "/app/book" : "/register"}
          />
        </div>
      </div>
    </div>
  )
}

export { HelpPage }
