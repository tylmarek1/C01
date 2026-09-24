import { useState, type ReactNode } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { CalendarPlus, LayoutDashboard, LogOut, MessageCircle, Menu, Search, ShieldCheck, Users, UserRound, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChatNavButton } from "@/components/shared/chat-nav-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { Logo } from "@/components/shared/logo"
import { NotificationsBell } from "@/components/shared/notifications-bell"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { ROLE_VARIANT, useRoleLabels } from "@/lib/user-role"
import { cn } from "@/lib/utils"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function NavItem({ to, children, onClick }: { to: string; children: ReactNode; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "text-sm font-medium text-slate-gray transition-colors hover:text-ink-navy",
          isActive && "text-ink-navy",
        )
      }
    >
      {children}
    </NavLink>
  )
}

function Navbar() {
  const { user, logout, isLoading } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const roleLabels = useRoleLabels()
  const [mobileOpen, setMobileOpen] = useState(false)
  const canAccessAdmin = user?.role === "VENUE_MANAGER" || user?.role === "ADMIN"

  function handleLogout() {
    // Navigate off the protected route first so ProtectedRoute's own
    // redirect-to-/login-with-state effect can't race the logout and win —
    // clearing the session only after the route change has committed.
    setMobileOpen(false)
    navigate("/", { replace: true })
    setTimeout(logout, 0)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-cloud/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {/* Three logical groups, left to right: browse (everyone) → my
              courts (signed-in player flow) → venue management (manager/
              admin only) — separated visually so they don't read as one
              undifferentiated list mixing marketing pages with app actions. */}
          <NavItem to="/courts">{t("nav.courts")}</NavItem>
          <NavItem to="/help">{t("nav.help")}</NavItem>
          {user && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <NavItem to="/app">{t("nav.dashboard")}</NavItem>
              <NavItem to="/app/book">{t("nav.book")}</NavItem>
              <NavItem to="/app/teams">{t("nav.teams")}</NavItem>
              {canAccessAdmin && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <NavItem to="/app/admin">{t("nav.admin")}</NavItem>
                </>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="hidden items-center gap-1.5 sm:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          {user && <ChatNavButton />}
          {user && <NotificationsBell />}
          {isLoading ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-signal-blue/40"
                  aria-label={t("nav.accountMenu")}
                >
                  <Avatar className="size-9">
                    <AvatarImage src={assetUrl(user.avatar_url)} alt={user.name} className="object-cover" />
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-ink-navy">{user.name}</span>
                    <Badge variant={ROLE_VARIANT[user.role]} className="shrink-0">
                      {roleLabels[user.role]}
                    </Badge>
                  </div>
                  <span className="block truncate text-xs font-normal text-slate-gray">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <NavLink to="/app">
                    <LayoutDashboard /> {t("nav.dashboard")}
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to="/app/book">
                    <CalendarPlus /> {t("nav.book")}
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to="/app/teams">
                    <Users /> {t("nav.teams")}
                  </NavLink>
                </DropdownMenuItem>
                {canAccessAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <NavLink to="/app/admin">
                        <ShieldCheck /> {t("nav.admin")}
                      </NavLink>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <NavLink to="/app/chat">
                    <MessageCircle /> {t("nav.chat")}
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to="/app/players">
                    <Search /> {t("playersDirectory.nav")}
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to="/app/profile">
                    <UserRound /> {t("nav.profile")}
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                  <LogOut /> {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-3 sm:flex">
              <Button variant="link" size="sm" asChild>
                <NavLink to="/login">{t("nav.login")}</NavLink>
              </Button>
              <Button size="sm" asChild>
                <NavLink to="/register">{t("nav.signup")}</NavLink>
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-lg text-ink-navy hover:bg-pebble md:hidden"
            aria-label={mobileOpen ? t("nav.menu.close") : t("nav.menu.open")}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-hairline bg-cloud px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            <NavItem to="/courts" onClick={() => setMobileOpen(false)}>
              {t("nav.courts")}
            </NavItem>
            <NavItem to="/help" onClick={() => setMobileOpen(false)}>
              {t("nav.help")}
            </NavItem>
            {user && (
              <>
                <div className="border-t border-hairline" />
                <NavItem to="/app" onClick={() => setMobileOpen(false)}>
                  {t("nav.dashboard")}
                </NavItem>
                <NavItem to="/app/book" onClick={() => setMobileOpen(false)}>
                  {t("nav.book")}
                </NavItem>
                <NavItem to="/app/teams" onClick={() => setMobileOpen(false)}>
                  {t("nav.teams")}
                </NavItem>
                {canAccessAdmin && (
                  <>
                    <div className="border-t border-hairline" />
                    <NavItem to="/app/admin" onClick={() => setMobileOpen(false)}>
                      {t("nav.admin")}
                    </NavItem>
                  </>
                )}
                <div className="border-t border-hairline" />
                <NavItem to="/app/chat" onClick={() => setMobileOpen(false)}>
                  {t("nav.chat")}
                </NavItem>
                <NavItem to="/app/players" onClick={() => setMobileOpen(false)}>
                  {t("playersDirectory.nav")}
                </NavItem>
                <NavItem to="/app/profile" onClick={() => setMobileOpen(false)}>
                  {t("nav.profile")}
                </NavItem>
              </>
            )}
            <div className="flex items-center justify-between border-t border-hairline pt-4">
              <div className="flex items-center gap-1.5">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              {!user && (
                <div className="flex items-center gap-3">
                  <Button variant="link" size="sm" asChild>
                    <NavLink to="/login" onClick={() => setMobileOpen(false)}>
                      {t("nav.login")}
                    </NavLink>
                  </Button>
                  <Button size="sm" asChild>
                    <NavLink to="/register" onClick={() => setMobileOpen(false)}>
                      {t("nav.signup")}
                    </NavLink>
                  </Button>
                </div>
              )}
              {user && (
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="size-4" /> {t("nav.logout")}
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

export { Navbar }
