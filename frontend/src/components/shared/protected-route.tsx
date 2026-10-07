import { useEffect, type ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { toast } from "sonner"

import { RouteLoadingFallback } from "@/components/shared/app-layout"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import type { UserRole } from "@/types"

/** Shown while the initial auth check is in flight — avoids a blank-page
 * flash on every hard refresh of an authenticated route. */
const AuthCheckFallback = RouteLoadingFallback

function ProtectedRoute({
  children,
  requireRole,
}: {
  children: ReactNode
  requireRole?: UserRole | UserRole[]
}) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  const allowedRoles = requireRole ? (Array.isArray(requireRole) ? requireRole : [requireRole]) : null
  const isForbidden = Boolean(user && allowedRoles && !allowedRoles.includes(user.role))

  useEffect(() => {
    if (isForbidden) toast.error(t("protectedRoute.forbidden"))
  }, [isForbidden, t])

  if (isLoading) return <AuthCheckFallback />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (isForbidden) return <Navigate to="/app" replace />

  return children
}

/** The inverse of ProtectedRoute — for /login and /register, which a
 * signed-in user shouldn't be able to land back on and resubmit. */
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <AuthCheckFallback />
  if (user) return <Navigate to="/app" replace />

  return children
}

export { ProtectedRoute, RedirectIfAuthed }
