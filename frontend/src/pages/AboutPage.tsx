import { CalendarCheck2, ExternalLink, ShieldCheck, Users } from "lucide-react"

import { DecorativeBlob } from "@/components/shared/decorative-blob"
import { FeatureItem } from "@/components/shared/feature-item"
import { SectionHeader } from "@/components/shared/section-header"
import { useTranslation, type TranslationKey } from "@/lib/i18n"

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
      <section className="relative mx-auto max-w-4xl overflow-hidden px-6 pt-16 pb-8 text-center sm:pt-24">
        <DecorativeBlob color="cyan" className="-top-10 right-10 size-64" />
        <DecorativeBlob color="magenta" className="bottom-0 left-0 size-56" />
        <SectionHeader eyebrow={t("about.eyebrow")} title={t("about.title")} description={t("about.description")} />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {values.map((value) => (
            <div key={value.titleKey} className="rounded-2xl border border-hairline bg-card p-6 shadow-card">
              <FeatureItem icon={value.icon} title={t(value.titleKey)} description={t(value.descriptionKey)} />
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="rounded-3xl border border-hairline bg-cloud p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-ink-navy">{t("about.team.title")}</h2>
          <p className="mt-2 text-slate-gray">{t("about.team.description")}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {TEAM.map((member) => (
              <li key={member} className="flex items-center gap-3 rounded-xl border border-hairline bg-paper p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-navy text-sm font-semibold text-paper">
                  {member
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <span className="font-medium text-ink-navy">{member}</span>
              </li>
            ))}
          </ul>
          <a
            href="https://github.com/tylmarek1/C01"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-navy hover:underline"
          >
            <ExternalLink className="size-4" /> {t("about.team.viewSource")}
          </a>
        </div>
      </section>
    </div>
  )
}

export { AboutPage }
