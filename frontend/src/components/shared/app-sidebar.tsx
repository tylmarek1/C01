import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  CalendarOff,
  CalendarPlus,
  ClipboardList,
  Flag,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Search,
  Settings,
  Shield,
  Sparkles,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { Logo } from "@/components/shared/logo"
import { NotificationsBell } from "@/components/shared/notifications-bell"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { UserMenu } from "@/components/shared/user-menu"
import { useAuth } from "@/lib/auth-context"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { isVenueStaff, usePendingApprovalCount, useUnreadChatCount } from "@/lib/queries"
import { cn } from "@/lib/utils"

interface NavEntry {
  to: string
  labelKey: TranslationKey
  icon: LucideIcon
  badge?: number
  /** Match on pathname only (default) or pathname + this ?tab value. */
  tab?: string
  end?: boolean
}

function useNavGroups(): { labelKey?: TranslationKey; items: NavEntry[] }[] {
  const { user } = useAuth()
  const unreadChat = useUnreadChatCount()
  const pendingApprovals = usePendingApprovalCount()
  const groups: { labelKey?: TranslationKey; items: NavEntry[] }[] = [
    {
      items: [
        { to: "/app", labelKey: "nav.overview", icon: LayoutDashboard, end: true },
        { to: "/courts", labelKey: "nav.courts", icon: MapPin },
        { to: "/app/games", labelKey: "nav.games", icon: Sparkles },
      ],
    },
    {
      labelKey: "nav.group.community",
      items: [
        { to: "/app/chat", labelKey: "nav.chat", icon: MessageCircle, badge: unreadChat },
        { to: "/app/teams", labelKey: "nav.teams", icon: UsersRound },
        { to: "/app/players", labelKey: "nav.community", icon: Users },
      ],
    },
  ]
  if (isVenueStaff(user?.role)) {
    groups.push({
      labelKey: "nav.group.venue",
      items: [
        { to: "/app/admin", tab: "overview", labelKey: "admin.tabs.overview", icon: BarChart3 },
        {
          to: "/app/admin",
          tab: "reservations",
          labelKey: "admin.tabs.reservations",
          icon: ClipboardList,
          badge: pendingApprovals,
        },
        { to: "/app/admin", tab: "courts", labelKey: "admin.tabs.courts", icon: LayoutGrid },
        { to: "/app/admin", tab: "availability", labelKey: "admin.tabs.availability", icon: CalendarOff },
        { to: "/app/admin", tab: "challenges", labelKey: "admin.tabs.challenges", icon: Flag },
        { to: "/app/admin", tab: "users", labelKey: "admin.tabs.users", icon: Shield },
      ],
    })
  }
  groups.push({
    labelKey: "nav.group.account",
    items: [
      { to: "/app/profile", labelKey: "nav.profile", icon: UserRound },
      { to: "/app/settings", labelKey: "nav.settings", icon: Settings },
    ],
  })
  return groups
}

const itemClasses =
  "group/nav relative flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"

function SidebarItem({ entry, onNavigate }: { entry: NavEntry; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const location = useLocation()
  const to = entry.tab ? `${entry.to}?tab=${entry.tab}` : entry.to

  let isActive: boolean
  if (entry.tab) {
    const currentTab = new URLSearchParams(location.search).get("tab") ?? "overview"
    isActive = location.pathname === entry.to && currentTab === entry.tab
  } else if (entry.end) {
    isActive = location.pathname === entry.to
  } else {
    isActive = location.pathname === entry.to || location.pathname.startsWith(`${entry.to}/`)
  }

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        itemClasses,
        isActive ? "bg-card text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {isActive && <span aria-hidden className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-brand" />}
      <entry.icon className={cn("size-4 shrink-0", isActive ? "text-foreground" : "text-subtle-foreground group-hover/nav:text-foreground")} />
      <span className="truncate">{t(entry.labelKey)}</span>
      {Boolean(entry.badge) && (
        <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-semibold text-brand-foreground tabular">
          {entry.badge! > 99 ? "99+" : entry.badge}
        </span>
      )}
    </NavLink>
  )
}

/** The app's primary navigation. Rendered fixed on lg+, and inside a sheet on mobile. */
function AppSidebar({ onNavigate, onOpenSearch, className }: { onNavigate?: () => void; onOpenSearch: () => void; className?: string }) {
  const { t } = useTranslation()
  const groups = useNavGroups()

  return (
    <div className={cn("flex h-full flex-col gap-4 bg-background px-3 py-4", className)}>
      <div className="flex items-center justify-between px-1.5">
        <Logo to="/app" />
        <NotificationsBell />
      </div>

      <div className="flex flex-col gap-2 px-0.5">
        <Button variant="brand" className="w-full justify-start" asChild>
          <NavLink to="/app/book" onClick={onNavigate}>
            <CalendarPlus /> {t("nav.book")}
          </NavLink>
        </Button>
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-8 w-full items-center gap-2 rounded-sm border border-border bg-card px-2.5 text-[13px] text-subtle-foreground shadow-xs transition-colors outline-none hover:border-border-strong hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">{t("command.placeholderShort")}</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      <nav aria-label={t("nav.primary")} className="-mx-1 flex flex-1 flex-col gap-5 overflow-y-auto px-1 pt-1">
        {groups.map((group, index) => (
          <div key={group.labelKey ?? index} className="flex flex-col gap-0.5 pl-3">
            {group.labelKey && <span className="eyebrow mb-1 px-2.5 text-[10px]">{t(group.labelKey)}</span>}
            {group.items.map((entry) => (
              <SidebarItem key={entry.tab ? `${entry.to}-${entry.tab}` : entry.to} entry={entry} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center justify-between px-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <UserMenu variant="sidebar" onNavigate={onNavigate} />
      </div>
    </div>
  )
}

export { AppSidebar }
