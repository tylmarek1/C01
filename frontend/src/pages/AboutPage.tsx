import { CalendarCheck2, FolderGit2, ShieldCheck, Users } from "lucide-react"

import { FeatureItem } from "@/components/shared/feature-item"
import { MarketingSection } from "@/components/shared/marketing"
import { SectionHeader } from "@/components/shared/section-header"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { initials } from "@/lib/utils"

const TEAM = ["Adam Vrána", "Marek Tyl", "Josef Glogar", "Adam Mikoláš"]

function AboutPage() {
  const { t } = useTranslation()

  const values: { icon: typeof ShieldCheck; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
    { icon: ShieldCheck, titleKey: "about.values.noDoubleBooking.title", descriptionKey: "about.values.noDoubleBooking.description" },
    { icon: CalendarCheck2, titleKey: "about.values.oneSchedule.title", descriptionKey: "about.values.oneSchedule.description" },
    { icon: Users, titleKey: "about.values.builtForVenues.title", descriptionKey: "about.values.builtForVenues.description" },
  ]

  return (
    <div>
      <section className="relative isolate overflow-hidden border-b border-border">
        <div aria-hidden className="absolute inset-0 -z-10 bg-court-grid opacity-50 [mask-image:radial-gradient(50%_80%_at_50%_0%,black,transparent)]" />
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeader eyebrow={t("about.eyebrow")} title={t("about.title")} description={t("about.description")} />
        </div>
      </section>

      <MarketingSection>
        <div className="grid gap-3 sm:grid-cols-3">
          {values.map((value) => (
            <div key={value.titleKey} className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <FeatureItem icon={value.icon} title={t(value.titleKey)} description={t(value.descriptionKey)} />
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection size="narrow" className="pt-0 sm:pt-0">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-10">
          <span className="eyebrow">{t("about.team.eyebrow")}</span>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">{t("about.team.title")}</h2>
          <p className="mt-2 text-[14px] text-muted-foreground">{t("about.team.description")}</p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {TEAM.map((member) => (
              <li key={member} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-brand-foreground">
                  {initials(member)}
                </span>
                <span className="text-[14px] font-medium">{member}</span>
              </li>
            ))}
          </ul>
          <a
            href="https://github.com/tylmarek1/C01"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
          >
            <FolderGit2 className="size-4" /> {t("about.team.viewSource")}
          </a>
        </div>
      </MarketingSection>
    </div>
  )
}

export { AboutPage }
