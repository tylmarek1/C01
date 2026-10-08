import type { LucideIcon } from "lucide-react"
import { CalendarPlus, LayoutDashboard, MapPin, Menu, Search, Sparkles } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { Logo } from "@/components/shared/logo"
import { NotificationsBell } from "@/components/shared/notifications-bell"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { UserAvatar } from "@/components/shared/user-avatar"
import { UserMenu } from "@/components/shared/user-menu"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { isVenueStaff, usePendingApprovalCount, useUnreadChatCount } from "@/lib/queries"
import { useNow } from "@/lib/use-now"
import { useRoleLabels } from "@/lib/user-role"
import { cn } from "@/lib/utils"
import { CLOSING_HOUR, OPENING_HOUR, hourLabel, isVenueOpen } from "@/lib/venue"

interface NavEntry {
  to: string
  labelKey: TranslationKey
  badge?: number
  /** Match the exact path only (the dashboard), not its children. */
  end?: boolean
}

/** One flat list — the masthead and the mobile menu render the same entries. */
function useNavEntries(): NavEntry[] {
  const { user } = useAuth()
  const unreadChat = useUnreadChatCount()
  const pendingApprovals = usePendingApprovalCount()
  const entries: NavEntry[] = [
    { to: "/app", labelKey: "nav.overview", end: true },
    { to: "/courts", labelKey: "nav.courts" },
    { to: "/app/games", labelKey: "nav.games" },
    { to: "/app/players", labelKey: "nav.community" },
    { to: "/app/teams", labelKey: "nav.teams" },
    { to: "/app/chat", labelKey: "nav.chat", badge: unreadChat },
  ]
  if (isVenueStaff(user?.role)) {
    entries.push({ to: "/app/admin", labelKey: "nav.venueDesk", badge: pendingApprovals })
  }
  return entries
}

function useIsActive() {
  const { pathname } = useLocation()
  return (entry: { to: string; end?: boolean }) =>
    entry.end ? pathname === entry.to : pathname === entry.to || pathname.startsWith(`${entry.to}/`)
}

function CountBadge({ count, className }: { count?: number; className?: string }) {
  if (!count) return null
  return (
    <span
      className={cn(
        "flex h-4 min-w-4 items-center justify-center bg-brand px-1 font-mono text-[10px] leading-none font-semibold text-brand-foreground tabular",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

/** Thin forest strip above the masthead: today's date and whether the venue
 * is open right now (venue-local time), plus language + theme. */
function VenueStrip() {
  const { t } = useTranslation()
  const fmt = useFormatters()
  const now = useNow(30_000)
  const open = isVenueOpen(now)

  return (
    <div className="hidden bg-panel text-panel-foreground lg:block">
      <div className="mx-auto flex h-8 max-w-7xl items-center gap-5 px-8 font-mono text-[11px] tracking-[0.06em] uppercase">
        <span className="text-panel-muted">{fmt.dateLong(new Date(now))}</span>
        <span className="flex items-center gap-2">
          <span aria-hidden className={cn("size-1.5", open ? "animate-blink bg-brand" : "bg-panel-muted")} />
          {open
            ? t("venue.openNow", { time: hourLabel(CLOSING_HOUR) })
            : t("venue.closedNow", { time: hourLabel(OPENING_HOUR) })}
        </span>
        <span className="hidden text-panel-muted xl:inline">
          {t("venue.hours", { open: hourLabel(OPENING_HOUR), close: hourLabel(CLOSING_HOUR) })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle className="size-7 text-panel-foreground hover:bg-panel-foreground/10 hover:text-panel-foreground" />
        </div>
      </div>
    </div>
  )
}

/** Desktop (lg+) masthead: logo, a single row of section links with an ink
 * underline on the active one, then search / notifications / book / account. */
function AppMasthead({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { t } = useTranslation()
  const entries = useNavEntries()
  const isActive = useIsActive()

  return (
    <>
      <VenueStrip />
      <header className="sticky top-0 z-30 hidden border-b border-foreground bg-background lg:block">
        <div className="mx-auto flex h-16 max-w-7xl items-stretch gap-6 px-8">
          <Logo to="/app" className="self-center" />
          <nav aria-label={t("nav.primary")} className="flex items-stretch">
            {entries.map((entry) => {
              const active = isActive(entry)
              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.end}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-1.5 px-2.5 text-[14px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:bg-muted xl:px-3",
                    "after:absolute after:inset-x-2.5 after:-bottom-px after:h-[3px] after:origin-left after:bg-foreground after:transition-transform after:duration-300 after:ease-out xl:after:inset-x-3",
                    active ? "text-foreground after:scale-x-100" : "text-muted-foreground after:scale-x-0 hover:text-foreground",
                  )}
                >
                  {t(entry.labelKey)}
                  <CountBadge count={entry.badge} />
                </NavLink>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label={t("command.placeholderShort")}
              className="flex h-9 items-center gap-2 rounded-sm border border-foreground/20 px-2.5 text-[13px] text-muted-foreground transition-colors outline-none hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <Search className="size-4" />
              <span className="hidden pr-6 xl:inline">{t("command.placeholderShort")}</span>
              <Kbd className="hidden xl:inline-flex">⌘K</Kbd>
            </button>
            <NotificationsBell />
            <Button variant="brand" asChild>
              <NavLink to="/app/book">
                <CalendarPlus /> {t("nav.book")}
              </NavLink>
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>
    </>
  )
}

/** Mobile (< lg) top bar — logo, search, notifications, account. */
function MobileTopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { t } = useTranslation()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-foreground bg-background px-3 lg:hidden">
      <Logo to="/app" className="mr-auto" />
      <Button variant="ghost" size="icon-sm" onClick={onOpenSearch} aria-label={t("command.placeholderShort")}>
        <Search className="size-[18px]" />
      </Button>
      <NotificationsBell />
      <UserMenu />
    </header>
  )
}

const TAB_ITEMS: { to: string; labelKey: TranslationKey; icon: LucideIcon; end?: boolean }[] = [
  { to: "/app", labelKey: "nav.overview", icon: LayoutDashboard, end: true },
  { to: "/courts", labelKey: "nav.courts", icon: MapPin },
  { to: "/app/book", labelKey: "nav.bookShort", icon: CalendarPlus },
  { to: "/app/games", labelKey: "nav.gamesShort", icon: Sparkles },
]

/** Mobile (< lg) bottom tab bar — thumb-reach for the four things people do
 * most, with "Book" as a clay tile, and "More" opening the full menu. */
function MobileTabBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t } = useTranslation()
  const isActive = useIsActive()
  const unreadChat = useUnreadChatCount()
  const pendingApprovals = usePendingApprovalCount()
  const moreBadge = unreadChat + pendingApprovals

  const itemClass =
    "relative flex flex-1 flex-col items-center justify-center gap-1 font-mono text-[10px] font-medium tracking-[0.06em] uppercase outline-none focus-visible:bg-muted"

  return (
    <nav
      aria-label={t("nav.primary")}
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-foreground bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TAB_ITEMS.map((item) => {
        const active = isActive(item)
        const isBook = item.to === "/app/book"
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-current={active ? "page" : undefined}
            className={cn(itemClass, active ? "text-foreground" : "text-muted-foreground")}
          >
            {isBook ? (
              <span className={cn("flex size-9 items-center justify-center rounded-sm bg-brand text-brand-foreground transition-transform", active && "animate-pop")}>
                <item.icon className="size-[18px]" />
              </span>
            ) : (
              <>
                {active && <span aria-hidden className="absolute inset-x-4 top-0 h-[3px] bg-foreground" />}
                <item.icon className="size-5" />
              </>
            )}
            {t(item.labelKey)}
          </NavLink>
        )
      })}
      <button type="button" onClick={onOpenMenu} className={cn(itemClass, "text-muted-foreground")} aria-label={t("nav.menu.open")}>
        <span className="relative">
          <Menu className="size-5" />
          <CountBadge count={moreBadge} className="absolute -top-1.5 -right-2.5" />
        </span>
        {t("nav.more")}
      </button>
    </nav>
  )
}

/** The full menu inside the mobile sheet — set as a programme's contents page:
 * numbered, big condensed links. */
function MobileNavMenu({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const roleLabels = useRoleLabels()
  const entries = useNavEntries()
  const isActive = useIsActive()
  const accountEntries: NavEntry[] = [
    { to: "/app/profile", labelKey: "nav.profile" },
    { to: "/app/settings", labelKey: "nav.settings" },
    { to: "/help", labelKey: "nav.help" },
  ]

  return (
    <div className="flex min-h-full flex-col gap-6 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <Logo to="/app" />
      <nav aria-label={t("nav.primary")} className="flex flex-col border-t-2 border-foreground">
        {entries.map((entry, index) => {
          const active = isActive(entry)
          return (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.end}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className="group flex items-baseline gap-3 border-b border-border py-2.5 outline-none focus-visible:bg-muted"
            >
              <span className="w-6 font-mono text-[11px] text-subtle-foreground tabular">{String(index + 1).padStart(2, "0")}</span>
              <span className={cn("display text-[32px]", active ? "text-brand" : "text-foreground group-hover:text-brand")}>
                {t(entry.labelKey)}
              </span>
              <CountBadge count={entry.badge} className="self-center" />
            </NavLink>
          )
        })}
      </nav>
      <nav aria-label={t("nav.group.account")} className="flex flex-col gap-1">
        <span className="eyebrow mb-1">{t("nav.group.account")}</span>
        {accountEntries.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            onClick={onNavigate}
            className={cn(
              "w-fit text-[15px] font-semibold underline-offset-4 hover:underline",
              isActive(entry) ? "text-foreground underline decoration-2" : "text-muted-foreground",
            )}
          >
            {t(entry.labelKey)}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-4 border-t border-foreground pt-4">
        <div className="flex items-center justify-between">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <UserAvatar name={user.name} avatarUrl={user.avatar_url} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] font-semibold">{user.name}</span>
              <span className="eyebrow">{roleLabels[user.role]}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export { AppMasthead, MobileNavMenu, MobileTabBar, MobileTopBar }
