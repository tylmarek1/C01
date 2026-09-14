import { Languages } from "lucide-react"

import { useTranslation, type Lang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "cs", label: "CS" },
]

function LanguageSwitcher() {
  const { lang, setLang } = useTranslation()

  return (
    <div className="flex items-center gap-1 rounded-full bg-pebble p-1 text-xs font-semibold">
      <Languages className="ml-1.5 size-3.5 text-slate-gray" />
      {LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLang(option.code)}
          className={cn(
            "rounded-full px-2 py-1 transition-colors",
            lang === option.code ? "bg-paper text-ink-navy shadow-sm" : "text-slate-gray hover:text-ink-navy",
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
