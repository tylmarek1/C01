import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react"

export type Theme = "light" | "dark"
const STORAGE_KEY = "courtly.theme"

function detectInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark") return stored
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to system detection.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(detectInitialTheme)

  // Layout effect (not a regular effect) so the `.dark` class lands before
  // the browser paints — an ordinary effect would flash the light theme for
  // one frame whenever the resolved theme is dark.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore — theme just won't persist across reloads
    }
  }, [theme])

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"))

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
