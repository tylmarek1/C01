import { ExternalLink, LifeBuoy, LogOut, Settings, UserRound } from "lucide-react"
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

/** Signed-in account menu — an avatar button in the masthead / navbar. */
function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
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
        <button
          type="button"
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={t("nav.accountMenu")}
        >
          <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="sm" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
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
