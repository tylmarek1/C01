import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  CalendarPlus,
  CornerDownLeft,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { useAuth } from "@/lib/auth-context"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { isVenueStaff, useCourts } from "@/lib/queries"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

interface CommandItem {
  id: string
  group: "pages" | "courts" | "actions"
  label: string
  hint?: string
  icon: LucideIcon | (() => React.ReactElement)
  keywords?: string
  run: () => void
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

/** ⌘K / Ctrl+K palette: every page, every court, and the global toggles. */
function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, lang, setLang } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const sportLabels = useSportLabels()
  const { data: courts } = useCourts()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  const items = useMemo<CommandItem[]>(() => {
    const go = (to: string) => () => navigate(to)
    const page = (id: string, labelKey: TranslationKey, icon: LucideIcon, to: string): CommandItem => ({
      id,
      group: "pages",
      label: t(labelKey),
      icon,
      run: go(to),
    })
    const pages: CommandItem[] = [
      page("overview", "nav.overview", LayoutDashboard, "/app"),
      page("book", "nav.book", CalendarPlus, "/app/book"),
      page("courts", "nav.courts", MapPin, "/courts"),
      page("games", "nav.games", Sparkles, "/app/games"),
      page("chat", "nav.chat", MessageCircle, "/app/chat"),
      page("teams", "nav.teams", UsersRound, "/app/teams"),
      page("community", "nav.community", Users, "/app/players"),
      page("profile", "nav.profile", UserRound, "/app/profile"),
      page("settings", "nav.settings", Settings, "/app/settings"),
      page("help", "nav.help", LifeBuoy, "/help"),
    ]
    if (isVenueStaff(user?.role)) pages.push(page("admin", "nav.admin", BarChart3, "/app/admin"))

    const courtItems: CommandItem[] = (courts ?? []).map((court) => ({
      id: `court-${court.id}`,
      group: "courts",
      label: court.name,
      hint: `${sportLabels[court.sport_type]} · ${court.indoor ? t("courts.indoor") : t("courts.outdoor")}`,
      icon: () => <SportIcon sport={court.sport_type} className="size-4" />,
      keywords: sportLabels[court.sport_type],
      run: go(`/courts/${court.id}`),
    }))

    const actions: CommandItem[] = [
      {
        id: "theme",
        group: "actions",
        label: theme === "dark" ? t("nav.theme.toggleToLight") : t("nav.theme.toggleToDark"),
        icon: theme === "dark" ? Sun : Moon,
        run: toggleTheme,
      },
      {
        id: "lang",
        group: "actions",
        label: lang === "en" ? "Přepnout do češtiny" : "Switch to English",
        icon: Languages,
        run: () => setLang(lang === "en" ? "cs" : "en"),
      },
    ]
    return [...pages, ...courtItems, ...actions]
  }, [t, user?.role, courts, sportLabels, theme, toggleTheme, lang, setLang, navigate])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) {
      // Unfiltered: every page and action, but only a handful of courts.
      return [
        ...items.filter((item) => item.group === "pages"),
        ...items.filter((item) => item.group === "courts").slice(0, 6),
        ...items.filter((item) => item.group === "actions"),
      ]
    }
    return items.filter((item) => normalize(`${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`).includes(q))
  }, [items, query])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  function run(item: CommandItem) {
    onOpenChange(false)
    setQuery("")
    item.run()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => Math.min(filtered.length - 1, index + 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(0, index - 1))
    } else if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault()
      run(filtered[activeIndex])
    }
  }

  const groupLabel: Record<CommandItem["group"], string> = {
    pages: t("command.group.pages"),
    courts: t("command.group.courts"),
    actions: t("command.group.actions"),
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setQuery("")
          setActiveIndex(0)
        }
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-97 data-closed:animate-out data-closed:fade-out-0"
          onKeyDown={onKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">{t("command.title")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t("command.description")}</DialogPrimitive.Description>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-subtle-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              placeholder={t("command.placeholder")}
              className="h-12 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-subtle-foreground"
              role="combobox"
              aria-expanded
              aria-controls="command-list"
              aria-activedescendant={filtered[activeIndex] ? `command-${filtered[activeIndex].id}` : undefined}
            />
            <Kbd>Esc</Kbd>
          </div>
          <div ref={listRef} id="command-list" role="listbox" className="flex-1 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">{t("command.empty")}</p>
            )}
            {filtered.map((item, index) => {
              const showGroup = index === 0 || filtered[index - 1].group !== item.group
              const Icon = item.icon
              return (
                <div key={item.id}>
                  {showGroup && <div className="eyebrow px-2.5 pt-2.5 pb-1.5 text-[10px]">{groupLabel[item.group]}</div>}
                  <button
                    type="button"
                    id={`command-${item.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    data-index={index}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => run(item)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[13px] outline-none",
                      index === activeIndex ? "bg-muted text-foreground" : "text-foreground/90",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{item.label}</span>
                      {item.hint && <span className="truncate text-xs text-muted-foreground">{item.hint}</span>}
                    </span>
                    {index === activeIndex && <CornerDownLeft className="size-3.5 text-subtle-foreground" />}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 border-t border-border bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> {t("command.hint.navigate")}
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> {t("command.hint.open")}
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  )
}

export { CommandMenu }
