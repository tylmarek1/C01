import { ExternalLink, LifeBuoy, MessageCircle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/card"
import { SectionHeader } from "@/components/shared/section-header"

const CHANNELS = [
  {
    icon: ExternalLink,
    title: "Report a bug or request a feature",
    description: "This project is open on GitHub — open an issue and the team will pick it up.",
    href: "https://github.com/tylmarek1/C01/issues",
    label: "Open an issue",
  },
  {
    icon: MessageCircle,
    title: "Talk to the team",
    description: "Courtly is a student project for course SWI, engineering spike C01 — reach the team via the repository.",
    href: "https://github.com/tylmarek1/C01",
    label: "View the repository",
  },
]

function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      <SectionHeader
        eyebrow="Contact"
        title="We'd like to hear from you"
        description="Courtly doesn't run a support inbox yet — the fastest way to reach the team is through the project repository."
      />

      <div className="mt-12 flex flex-col gap-4">
        {CHANNELS.map((channel) => (
          <Card key={channel.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <channel.icon className="size-5 text-signal-blue" />
                {channel.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-slate-gray">{channel.description}</p>
              <a
                href={channel.href}
                target="_blank"
                rel="noreferrer"
                className="w-fit text-sm font-semibold text-ink-navy hover:underline"
              >
                {channel.label} →
              </a>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <LifeBuoy className="size-5 text-signal-blue" />
              Need help with a reservation?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-gray">
              Log in and head to your dashboard — you can confirm or cancel any of your reservations there at any
              time.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export { ContactPage }
