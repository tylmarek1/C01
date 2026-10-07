import { ArrowUpRight, Bug, FolderGit2, LifeBuoy } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { MarketingSection } from "@/components/shared/marketing"
import { SectionHeader } from "@/components/shared/section-header"
import { useTranslation, type TranslationKey } from "@/lib/i18n"

function ContactPage() {
  const { t } = useTranslation()

  const channels: { icon: LucideIcon; titleKey: TranslationKey; descriptionKey: TranslationKey; href: string; labelKey: TranslationKey; external: boolean }[] = [
    {
      icon: LifeBuoy,
      titleKey: "contact.help.title",
      descriptionKey: "contact.help.description",
      href: "/help",
      labelKey: "contact.help.link",
      external: false,
    },
    {
      icon: Bug,
      titleKey: "contact.channels.bug.title",
      descriptionKey: "contact.channels.bug.description",
      href: "https://github.com/tylmarek1/C01/issues",
      labelKey: "contact.channels.bug.label",
      external: true,
    },
    {
      icon: FolderGit2,
      titleKey: "contact.channels.team.title",
      descriptionKey: "contact.channels.team.description",
      href: "https://github.com/tylmarek1/C01",
      labelKey: "contact.channels.team.label",
      external: true,
    },
  ]

  return (
    <MarketingSection size="narrow">
      <SectionHeader eyebrow={t("contact.eyebrow")} title={t("contact.title")} description={t("contact.description")} />
      <div className="mt-12 grid gap-3">
        {channels.map((channel) => {
          const body = (
            <>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                <channel.icon className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] font-semibold">{t(channel.titleKey)}</span>
                <span className="text-[13px] leading-relaxed text-muted-foreground">{t(channel.descriptionKey)}</span>
                <span className="mt-1 text-[13px] font-medium underline decoration-border-strong underline-offset-4 group-hover:decoration-foreground">
                  {t(channel.labelKey)}
                </span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
            </>
          )
          const classes = "group flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-xs surface-interactive"
          return channel.external ? (
            <a key={channel.titleKey} href={channel.href} target="_blank" rel="noreferrer" className={classes}>
              {body}
            </a>
          ) : (
            <Link key={channel.titleKey} to={channel.href} className={classes}>
              {body}
            </Link>
          )
        })}
      </div>
    </MarketingSection>
  )
}

export { ContactPage }
