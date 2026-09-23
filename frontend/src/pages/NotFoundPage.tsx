import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"

function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-sm font-semibold text-signal-blue">404</span>
      <h1 className="text-3xl font-bold text-ink-navy">{t("notFound.title")}</h1>
      <p className="text-slate-gray">{t("notFound.description")}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link to="/">{t("notFound.cta")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/courts">{t("courtDetail.notFound.browse")}</Link>
        </Button>
      </div>
    </div>
  )
}

export { NotFoundPage }
