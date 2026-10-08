import { useTranslation, type Lang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "cs", label: "CS" },
]

/** "EN / CS" set like a programme's edition marker. Inherits the text colour,
 * so it works on paper and on the forest panel alike. */
function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useTranslation()

  return (
    <div role="group" aria-label={t("nav.language")} className={cn("flex h-8 items-center gap-1 font-mono text-[11px] font-medium", className)}>
      {LANGUAGES.map((option, index) => (
        <span key={option.code} className="flex items-center gap-1">
          {index > 0 && (
            <span aria-hidden className="opacity-40">
              /
            </span>
          )}
          <button
            type="button"
            onClick={() => setLang(option.code)}
            className={cn(
              "rounded-xs px-1 py-0.5 tracking-[0.06em] underline-offset-[5px] transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-current/40",
              lang === option.code ? "underline decoration-2" : "opacity-55 hover:opacity-100",
            )}
            aria-pressed={lang === option.code}
          >
            {option.label}
          </button>
        </span>
      ))}
    </div>
  )
}

export { LanguageSwitcher }
