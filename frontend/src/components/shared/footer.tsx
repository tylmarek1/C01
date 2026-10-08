import { Link } from "react-router-dom"

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

  const linkClass = "text-[14px] text-panel-foreground/80 underline-offset-4 transition-colors hover:text-panel-foreground hover:underline"

  return (
    <footer className="bg-panel text-panel-foreground">
      <div className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <p className="max-w-64 text-[14px] leading-relaxed text-panel-muted">{t("footer.tagline")}</p>
          {columns.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3 border-t border-panel-foreground/25 pt-3">
              <h3 className="font-mono text-[11px] tracking-[0.08em] text-panel-muted uppercase">{column.heading}</h3>
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
        {/* The sign-off: the wordmark set as big as the page allows. */}
        <div aria-hidden className="mt-14 overflow-hidden">
          <span className="display block translate-y-[0.12em] text-[27vw] leading-[0.8] tracking-[-0.01em] text-panel-foreground/95 md:text-[17.5rem]">
            Courtly
          </span>
        </div>
      </div>
      <div className="border-t border-panel-foreground/20">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 font-mono text-[11px] tracking-[0.04em] text-panel-muted uppercase sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            &copy; {new Date().getFullYear()} Courtly. {t("footer.copyright")}
          </span>
          <span>{t("footer.venueHours")}</span>
        </div>
      </div>
    </footer>
  )
}

export { Footer }
