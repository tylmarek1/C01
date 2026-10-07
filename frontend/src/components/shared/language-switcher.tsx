import { useTranslation, type Lang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "cs", label: "CS" },
]

function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useTranslation()

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className={cn("flex h-8 items-center gap-0.5 rounded-md border border-border bg-muted p-0.5 font-mono text-[11px] font-medium", className)}
    >
      {LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLang(option.code)}
          className={cn(
            "h-full rounded-sm px-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            lang === option.code ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={lang === option.code}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export { LanguageSwitcher }
