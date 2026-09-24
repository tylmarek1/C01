import { Moon, Sun } from "lucide-react"

import { useTranslation } from "@/lib/i18n"
import { useTheme } from "@/lib/theme"

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex size-9 items-center justify-center rounded-full text-slate-gray transition-colors hover:bg-pebble hover:text-ink-navy"
      aria-label={theme === "dark" ? t("nav.theme.toggleToLight") : t("nav.theme.toggleToDark")}
    >
      {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}

export { ThemeToggle }
