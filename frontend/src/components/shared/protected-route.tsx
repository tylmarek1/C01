import { useEffect, type ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import type { UserRole } from "@/types"

function ProtectedRoute({ children, requireRole }: { children: ReactNode; requireRole?: UserRole }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  const isForbidden = Boolean(user && requireRole && user.role !== requireRole)

  useEffect(() => {
    if (isForbidden) toast.error("You don't have access to that page")
  }, [isForbidden])

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (isForbidden) return <Navigate to="/app" replace />

  return children
}

export { ProtectedRoute }
