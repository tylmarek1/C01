import { useEffect, type ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import type { UserRole } from "@/types"

function ProtectedRoute({ children, requireRole }: { children: ReactNode; requireRole?: UserRole }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  const isForbidden = Boolean(user && requireRole && user.role !== requireRole)

  useEffect(() => {
    if (isForbidden) toast.error(t("protectedRoute.forbidden"))
  }, [isForbidden, t])

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (isForbidden) return <Navigate to="/app" replace />

  return children
}

/** The inverse of ProtectedRoute — for /login and /register, which a
 * signed-in user shouldn't be able to land back on and resubmit. */
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (user) return <Navigate to="/app" replace />

  return children
}

export { ProtectedRoute, RedirectIfAuthed }
