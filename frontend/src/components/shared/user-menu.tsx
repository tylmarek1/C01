import { ChevronsUpDown, ExternalLink, LifeBuoy, LogOut, Settings, UserRound } from "lucide-react"
import { NavLink, useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/shared/user-avatar"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { ROLE_VARIANT, useRoleLabels } from "@/lib/user-role"

/** Signed-in account menu — a full-width row at the foot of the sidebar, or
 * an avatar button in the marketing navbar. */
function UserMenu({ variant = "avatar", onNavigate }: { variant?: "avatar" | "sidebar"; onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const roleLabels = useRoleLabels()

  if (!user) return null

  function handleLogout() {
    // Navigate off the protected route first so ProtectedRoute's own
    // redirect-to-/login-with-state effect can't race the logout and win —
    // clearing the session only after the route change has committed.
    onNavigate?.()
    navigate("/", { replace: true })
    setTimeout(logout, 0)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "sidebar" ? (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md border border-transparent p-1.5 text-left transition-colors outline-none hover:border-border hover:bg-card focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:border-border data-[state=open]:bg-card"
            aria-label={t("nav.accountMenu")}
          >
            <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium text-foreground">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{roleLabels[user.role]}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-subtle-foreground" />
          </button>
        ) : (
          <button
            type="button"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={t("nav.accountMenu")}
          >
            <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="sm" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "top" : "bottom"} className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-1 py-2">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-foreground">{user.name}</span>
            <Badge variant={ROLE_VARIANT[user.role]} className="shrink-0">
              {roleLabels[user.role]}
            </Badge>
          </span>
          <span className="truncate font-normal">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <NavLink to={`/app/players/${user.id}`} onClick={onNavigate}>
            <UserRound /> {t("nav.publicProfile")}
          </NavLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <NavLink to="/app/settings" onClick={onNavigate}>
            <Settings /> {t("nav.settings")}
          </NavLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <NavLink to="/help" onClick={onNavigate}>
            <LifeBuoy /> {t("nav.help")}
          </NavLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <NavLink to="/" onClick={onNavigate}>
            <ExternalLink /> {t("nav.homepage")}
          </NavLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
          <LogOut /> {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { UserMenu }
