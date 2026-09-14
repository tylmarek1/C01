import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import cs from "@/locales/cs"
import en, { type TranslationKey } from "@/locales/en"

export type { TranslationKey }

export type Lang = "en" | "cs"
const DICTIONARIES: Record<Lang, Record<TranslationKey, string>> = { en, cs }
const STORAGE_KEY = "courtly.lang"

function detectInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "en" || stored === "cs") return stored
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to browser detection.
  }
  return navigator.language.toLowerCase().startsWith("cs") ? "cs" : "en"
}

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang)

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore — language just won't persist across reloads
    }
    setLangState(next)
  }, [])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let text = DICTIONARIES[lang][key] ?? DICTIONARIES.en[key] ?? key
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(value))
        }
      }
      return text
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) throw new Error("useTranslation must be used within an I18nProvider")
  return context
}
