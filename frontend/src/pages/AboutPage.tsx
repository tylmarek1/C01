import { CalendarCheck2, ExternalLink, ShieldCheck, Users } from "lucide-react"

import { DecorativeBlob } from "@/components/shared/decorative-blob"
import { FeatureItem } from "@/components/shared/feature-item"
import { SectionHeader } from "@/components/shared/section-header"

const TEAM = ["Adam Vrána", "Marek Tyl", "Josef Glogar", "Adam Mikoláš"]

const VALUES = [
  {
    icon: ShieldCheck,
    title: "No double bookings, ever",
    description: "The database itself enforces it with an exclusion constraint — not just application logic.",
  },
  {
    icon: CalendarCheck2,
    title: "One accurate schedule",
    description: "Players and the venue see the exact same state — no spreadsheets, no phone calls.",
  },
  {
    icon: Users,
    title: "Built for real venues",
    description: "Multiple sports, indoor and outdoor courts, and a venue-manager role to run the place.",
  },
]

function AboutPage() {
  return (
    <div>
      <section className="relative mx-auto max-w-4xl overflow-hidden px-6 pt-16 pb-8 text-center sm:pt-24">
        <DecorativeBlob color="cyan" className="-top-10 right-10 size-64" />
        <DecorativeBlob color="magenta" className="bottom-0 left-0 size-56" />
        <SectionHeader
          eyebrow="About Courtly"
          title="A fair, always-accurate way to book a court"
          description="Courtly started as an engineering spike for course SWI (project C01) — a real reservation system built to explore how far a small team can take a domain model in a few focused iterations."
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {VALUES.map((value) => (
            <div key={value.title} className="rounded-2xl border border-hairline bg-card p-6 shadow-card">
              <FeatureItem icon={value.icon} title={value.title} description={value.description} />
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="rounded-3xl border border-hairline bg-cloud p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-ink-navy">Team VTG Courts</h2>
          <p className="mt-2 text-slate-gray">The students behind this project.</p>
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
            <ExternalLink className="size-4" /> View the source on GitHub
          </a>
        </div>
      </section>
    </div>
  )
}

export { AboutPage }
