import { ArrowLeft, Search } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { LogoMark } from "@/components/shared/logo"
import { useTranslation } from "@/lib/i18n"

function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="relative isolate mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <LogoMark className="size-12 animate-fade-up" />
      <span className="font-mono text-[13px] tracking-widest text-muted-foreground">404 · {t("notFound.outOfBounds")}</span>
      <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.035em] text-balance">{t("notFound.title")}</h1>
      <p className="max-w-sm text-[15px] text-muted-foreground">{t("notFound.description")}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/">
            <ArrowLeft /> {t("notFound.cta")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/courts">
            <Search /> {t("courtDetail.notFound.browse")}
          </Link>
        </Button>
      </div>
    </div>
  )
}

export { NotFoundPage }
