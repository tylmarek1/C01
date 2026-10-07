import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { useTranslation } from "@/lib/i18n"
import { useTheme } from "@/lib/theme"

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const label = theme === "dark" ? t("nav.theme.toggleToLight") : t("nav.theme.toggleToDark")

  return (
    <Tooltip content={label}>
      <Button variant="subtle" size="icon-sm" onClick={toggleTheme} aria-label={label}>
        <Sun className="size-4 scale-100 rotate-0 transition-transform duration-300 dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-transform duration-300 dark:scale-100 dark:rotate-0" />
      </Button>
    </Tooltip>
  )
}

export { ThemeToggle }
