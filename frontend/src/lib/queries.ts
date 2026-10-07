import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { onChatEvent } from "@/lib/chat-socket"

/** Shared query hooks for resources read from more than one place (shell
 * badges + a page). Keeping the key + fetcher in one spot means every caller
 * shares one cache entry instead of each inventing its own key. */

export function isVenueStaff(role: string | undefined | null): boolean {
  return role === "VENUE_MANAGER" || role === "ADMIN"
}

export function useConversations() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.listConversations(token!),
    enabled: Boolean(token),
    refetchInterval: 30_000,
  })
  useEffect(() => onChatEvent(() => queryClient.invalidateQueries({ queryKey: ["conversations"] })), [queryClient])
  return query
}

export function useUnreadChatCount(): number {
  const { data } = useConversations()
  return data?.reduce((total, conversation) => total + conversation.unread_count, 0) ?? 0
}

/** Venue-wide stats. `days` only changes the "created in window" figure —
 * the status breakdown (and so the approval queue size) is all-time. */
export function useAdminStats(days = 30) {
  const { token, user } = useAuth()
  return useQuery({
    queryKey: ["admin-stats", days],
    queryFn: () => api.getAdminStats(token!, days),
    enabled: Boolean(token) && isVenueStaff(user?.role),
    refetchInterval: 60_000,
  })
}

export function usePendingApprovalCount(): number {
  const { data } = useAdminStats(30)
  return data?.status_breakdown["PENDING_APPROVAL"] ?? 0
}

export function useMyReservations() {
  const { token } = useAuth()
  return useQuery({
    queryKey: ["reservations"],
    queryFn: () => api.listReservations(token!),
    enabled: Boolean(token),
  })
}

export function useCourts() {
  return useQuery({ queryKey: ["courts"], queryFn: () => api.listCourts() })
}

export function useFavorites() {
  const { token } = useAuth()
  return useQuery({
    queryKey: ["favorites-mine"],
    queryFn: () => api.listMyFavorites(token!),
    enabled: Boolean(token),
  })
}
