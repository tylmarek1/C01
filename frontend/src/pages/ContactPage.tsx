import { ExternalLink, LifeBuoy, MessageCircle } from "lucide-react"
import { Link } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/card"
import { SectionHeader } from "@/components/shared/section-header"
import { useTranslation, type TranslationKey } from "@/lib/i18n"

function ContactPage() {
  const { t } = useTranslation()

  const channels: {
    icon: typeof ExternalLink
    titleKey: TranslationKey
    descriptionKey: TranslationKey
    href: string
    labelKey: TranslationKey
  }[] = [
    {
      icon: ExternalLink,
      titleKey: "contact.channels.bug.title",
      descriptionKey: "contact.channels.bug.description",
      href: "https://github.com/tylmarek1/C01/issues",
      labelKey: "contact.channels.bug.label",
    },
    {
      icon: MessageCircle,
      titleKey: "contact.channels.team.title",
      descriptionKey: "contact.channels.team.description",
      href: "https://github.com/tylmarek1/C01",
      labelKey: "contact.channels.team.label",
    },
  ]

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      <SectionHeader eyebrow={t("contact.eyebrow")} title={t("contact.title")} description={t("contact.description")} />

      <div className="mt-12 flex flex-col gap-4">
        {channels.map((channel) => (
          <Card key={channel.titleKey}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <channel.icon className="size-5 text-signal-blue" />
                {t(channel.titleKey)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-slate-gray">{t(channel.descriptionKey)}</p>
              <a
                href={channel.href}
                target="_blank"
                rel="noreferrer"
                className="w-fit text-sm font-semibold text-ink-navy hover:underline"
              >
                {t(channel.labelKey)} →
              </a>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <LifeBuoy className="size-5 text-signal-blue" />
              {t("contact.help.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-slate-gray">{t("contact.help.description")}</p>
            <Link to="/help" className="w-fit text-sm font-semibold text-ink-navy hover:underline">
              {t("contact.help.link")} →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export { ContactPage }
