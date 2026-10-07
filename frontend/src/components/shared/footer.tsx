import { Link } from "react-router-dom"

import { Logo } from "@/components/shared/logo"
import { useSportLabels } from "@/components/shared/sport-icon"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"

interface FooterLink {
  label: string
  to: string
}

function Footer() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()

  const columns: { heading: string; links: FooterLink[] }[] = [
    {
      heading: t("footer.product"),
      links: [
        { label: t("footer.book"), to: user ? "/app/book" : "/register" },
        { label: t("footer.availability"), to: "/courts" },
        { label: t("footer.pricing"), to: "/#pricing" },
      ],
    },
    {
      heading: t("footer.sports"),
      links: [
        { label: sportLabels.TENNIS, to: "/courts?sport=TENNIS" },
        { label: sportLabels.VOLLEYBALL, to: "/courts?sport=VOLLEYBALL" },
        { label: sportLabels.BADMINTON, to: "/courts?sport=BADMINTON" },
      ],
    },
    {
      heading: t("footer.company"),
      links: [
        { label: t("footer.about"), to: "/about" },
        { label: t("footer.help"), to: "/help" },
        { label: t("footer.courseProject"), to: "https://github.com/tylmarek1/C01" },
        { label: t("footer.contact"), to: "/contact" },
      ],
    },
  ]

  const linkClass = "text-[13px] text-muted-foreground transition-colors hover:text-foreground"

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-60 text-[13px] text-muted-foreground">{t("footer.tagline")}</p>
          </div>
          {columns.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3">
              <h3 className="eyebrow">{column.heading}</h3>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to.startsWith("http") ? (
                      <a href={link.to} target="_blank" rel="noreferrer" className={linkClass}>
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.to} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            &copy; {new Date().getFullYear()} Courtly. {t("footer.copyright")}
          </span>
          <span className="font-mono">{t("footer.venueHours")}</span>
        </div>
      </div>
    </footer>
  )
}

export { Footer }
