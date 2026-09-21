import { Link } from "react-router-dom"

import { Logo } from "@/components/shared/logo"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"

interface FooterLink {
  label: string
  to: string
}

function Footer() {
  const { user } = useAuth()
  const { t } = useTranslation()

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
        { label: "Tennis", to: "/courts?sport=TENNIS" },
        { label: "Volleyball", to: "/courts?sport=VOLLEYBALL" },
        { label: "Badminton", to: "/courts?sport=BADMINTON" },
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

  return (
    <footer className="border-t border-hairline bg-cloud">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-56 text-sm text-slate-gray">{t("footer.tagline")}</p>
          </div>
          {columns.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold tracking-wide text-slate-gray uppercase">{column.heading}</h3>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) =>
                  link.to.startsWith("http") ? (
                    <li key={link.label}>
                      <a
                        href={link.to}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-ink-navy transition-colors hover:text-signal-blue"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        className="text-sm font-medium text-ink-navy transition-colors hover:text-signal-blue"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-hairline pt-6 text-sm text-slate-gray sm:flex-row sm:items-center sm:justify-between">
          <span>
            &copy; {new Date().getFullYear()} Courtly. {t("footer.copyright")}
          </span>
        </div>
      </div>
    </footer>
  )
}

export { Footer }
