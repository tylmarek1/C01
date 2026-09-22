import type {
  Achievement,
  AdminStats,
  Amenity,
  AuthResponse,
  CalendarToken,
  Court,
  CourtAvailability,
  CourtUtilization,
  FacilityBlock,
  JoinRequest,
  JoinRequestWithReservation,
  LeaderboardEntry,
  Notification,
  NotificationType,
  OpenGame,
  PlayerStats,
  Reservation,
  ReservationAdmin,
  ReservationEvent,
  ReservationGuest,
  ReservationSeriesResult,
  ReservationSplit,
  ReservationStatus,
  Review,
  SportType,
  Teammate,
  User,
  UserAdmin,
  UserRole,
  WaitlistEntry,
} from "@/types"

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000"

export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  return path.startsWith("http") ? path : `${API_URL}${path}`
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const detail = (body as { detail?: unknown }).detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string }
    return first.msg ?? null
  }
  return null
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, extractErrorMessage(body) ?? response.statusText)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Downloads a file from an authenticated endpoint (the browser can't send
 * an Authorization header via a plain <a href>) by fetching it as a blob and
 * triggering a save through a synthetic anchor click. */
async function downloadAuthedFile(path: string, token: string, filename: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, extractErrorMessage(body) ?? response.statusText)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: (token: string) => request<User>("/auth/me", {}, token),

  updateProfile: (token: string, name: string) =>
    request<User>("/auth/me", { method: "PATCH", body: JSON.stringify({ name }) }, token),

  uploadAvatar: (token: string, file: File | Blob) => {
    const formData = new FormData()
    formData.append("file", file, "avatar.jpg")
    return request<User>("/auth/me/avatar", { method: "POST", body: formData }, token)
  },

  listCourts: (
    options: { sport?: SportType; includeInactive?: boolean; q?: string; amenity?: Amenity } = {},
    token?: string | null,
  ) =>
    request<Court[]>(
      `/courts${buildQuery({
        sport: options.sport,
        include_inactive: options.includeInactive,
        q: options.q,
        amenity: options.amenity,
      })}`,
      {},
      token,
    ),

  getCourt: (id: string) => request<Court>(`/courts/${id}`),

  getCourtAvailability: (id: string, date: string) =>
    request<CourtAvailability>(`/courts/${id}/availability${buildQuery({ date })}`),

  createCourt: (
    token: string,
    payload: {
      name: string
      sport_type: SportType
      indoor: boolean
      requires_approval?: boolean
      description?: string
      image_url?: string
      amenities?: Amenity[]
      price_per_hour?: number
    },
  ) => request<Court>("/courts", { method: "POST", body: JSON.stringify(payload) }, token),

  updateCourt: (token: string, id: string, payload: Partial<Court>) =>
    request<Court>(`/courts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  uploadCourtImage: (token: string, id: string, file: File | Blob) => {
    const formData = new FormData()
    formData.append("file", file, "court.jpg")
    return request<Court>(`/courts/${id}/image`, { method: "POST", body: formData }, token)
  },

  addCourtGalleryImage: (token: string, id: string, file: File | Blob) => {
    const formData = new FormData()
    formData.append("file", file, "court.jpg")
    return request<Court>(`/courts/${id}/images`, { method: "POST", body: formData }, token)
  },

  deleteCourtGalleryImage: (token: string, id: string, imageId: string) =>
    request<Court>(`/courts/${id}/images/${imageId}`, { method: "DELETE" }, token),

  deleteCourt: (token: string, id: string) => request<void>(`/courts/${id}`, { method: "DELETE" }, token),

  listReservations: (token: string) => request<Reservation[]>("/reservations", {}, token),

  listAllReservations: (token: string, status?: ReservationStatus) =>
    request<ReservationAdmin[]>(`/reservations/admin${buildQuery({ status })}`, {}, token),

  createReservation: (token: string, courtId: string, startTime: string, endTime: string) =>
    request<Reservation>(
      "/reservations",
      { method: "POST", body: JSON.stringify({ court_id: courtId, start_time: startTime, end_time: endTime }) },
      token,
    ),

  createReservationSeries: (
    token: string,
    payload: { court_id: string; start_time: string; end_time: string; weeks: number },
  ) => request<ReservationSeriesResult>("/reservations/series", { method: "POST", body: JSON.stringify(payload) }, token),

  confirmReservation: (token: string, id: string) =>
    request<Reservation>(`/reservations/${id}/confirm`, { method: "POST" }, token),

  cancelReservation: (token: string, id: string) =>
    request<Reservation>(`/reservations/${id}/cancel`, { method: "POST" }, token),

  approveReservation: (token: string, id: string) =>
    request<Reservation>(`/reservations/${id}/approve`, { method: "POST" }, token),

  rejectReservation: (token: string, id: string) =>
    request<Reservation>(`/reservations/${id}/reject`, { method: "POST" }, token),

  checkInReservation: (token: string, id: string) =>
    request<Reservation>(`/reservations/${id}/check-in`, { method: "POST" }, token),

  rescheduleReservation: (token: string, id: string, startTime: string, endTime: string) =>
    request<Reservation>(
      `/reservations/${id}/reschedule`,
      { method: "PATCH", body: JSON.stringify({ start_time: startTime, end_time: endTime }) },
      token,
    ),

  getReservationHistory: (token: string, id: string) =>
    request<ReservationEvent[]>(`/reservations/${id}/history`, {}, token),

  joinWaitlist: (token: string, courtId: string, startTime: string, endTime: string) =>
    request<WaitlistEntry>(
      "/waitlist",
      { method: "POST", body: JSON.stringify({ court_id: courtId, start_time: startTime, end_time: endTime }) },
      token,
    ),

  listMyWaitlist: (token: string) => request<WaitlistEntry[]>("/waitlist/mine", {}, token),

  acceptWaitlistOffer: (token: string, id: string) =>
    request<Reservation>(`/waitlist/${id}/accept`, { method: "POST" }, token),

  cancelWaitlistEntry: (token: string, id: string) =>
    request<WaitlistEntry>(`/waitlist/${id}/cancel`, { method: "POST" }, token),

  listNotifications: (token: string) => request<Notification[]>("/notifications", {}, token),

  unreadNotificationCount: (token: string) => request<{ count: number }>("/notifications/unread-count", {}, token),

  markNotificationRead: (token: string, id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: "POST" }, token),

  markAllNotificationsRead: (token: string) =>
    request<{ updated: number }>("/notifications/read-all", { method: "POST" }, token),

  getNotificationPreferences: (token: string) =>
    request<{ muted_types: NotificationType[] }>("/notifications/preferences", {}, token),

  updateNotificationPreferences: (token: string, mutedTypes: NotificationType[]) =>
    request<{ muted_types: NotificationType[] }>(
      "/notifications/preferences",
      { method: "PUT", body: JSON.stringify({ muted_types: mutedTypes }) },
      token,
    ),

  listFacilityBlocks: (courtId?: string) => request<FacilityBlock[]>(`/facility-blocks${buildQuery({ court_id: courtId })}`),

  createFacilityBlock: (
    token: string,
    payload: { court_id: string; start_time: string; end_time: string; reason: string; weeks?: number },
  ) => request<FacilityBlock>("/facility-blocks", { method: "POST", body: JSON.stringify(payload) }, token),

  deleteFacilityBlock: (token: string, id: string) =>
    request<void>(`/facility-blocks/${id}`, { method: "DELETE" }, token),

  deleteFacilityBlockSeries: (token: string, seriesId: string) =>
    request<void>(`/facility-blocks/series/${seriesId}`, { method: "DELETE" }, token),

  // Reviews
  createReview: (token: string, reservationId: string, rating: number, comment?: string) =>
    request<Review>(
      "/reviews",
      { method: "POST", body: JSON.stringify({ reservation_id: reservationId, rating, comment }) },
      token,
    ),

  listCourtReviews: (courtId: string) => request<Review[]>(`/courts/${courtId}/reviews`),

  listMyReviews: (token: string) => request<Review[]>("/reviews/mine", {}, token),

  deleteReview: (token: string, id: string) => request<void>(`/reviews/${id}`, { method: "DELETE" }, token),

  replyToReview: (token: string, id: string, reply: string) =>
    request<Review>(`/reviews/${id}/reply`, { method: "PUT", body: JSON.stringify({ reply }) }, token),

  deleteReviewReply: (token: string, id: string) =>
    request<Review>(`/reviews/${id}/reply`, { method: "DELETE" }, token),

  // Favorites
  listMyFavorites: (token: string) => request<Court[]>("/favorites/mine", {}, token),

  addFavorite: (token: string, courtId: string) =>
    request<void>(`/favorites/${courtId}`, { method: "POST" }, token),

  removeFavorite: (token: string, courtId: string) =>
    request<void>(`/favorites/${courtId}`, { method: "DELETE" }, token),

  // Group reservations
  listGuests: (token: string, reservationId: string) =>
    request<ReservationGuest[]>(`/reservations/${reservationId}/guests`, {}, token),

  inviteGuest: (token: string, reservationId: string, email: string) =>
    request<ReservationGuest>(
      `/reservations/${reservationId}/guests`,
      { method: "POST", body: JSON.stringify({ email }) },
      token,
    ),

  removeGuest: (token: string, reservationId: string, userId: string) =>
    request<void>(`/reservations/${reservationId}/guests/${userId}`, { method: "DELETE" }, token),

  listSharedWithMe: (token: string) => request<Reservation[]>("/reservations/shared-with-me", {}, token),

  // Admin analytics + user management
  getAdminStats: (token: string, days?: number) =>
    request<AdminStats>(`/admin/stats${buildQuery({ days })}`, {}, token),

  listAdminUsers: (token: string) => request<UserAdmin[]>("/admin/users", {}, token),

  updateUserRole: (token: string, userId: string, role: UserRole) =>
    request<UserAdmin>(`/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }, token),

  exportReservationsCsv: (token: string, status?: ReservationStatus) =>
    downloadAuthedFile(`/admin/reservations/export.csv${buildQuery({ status })}`, token, "reservations.csv"),

  getCourtUtilization: (token: string, courtId: string, days?: number) =>
    request<CourtUtilization>(`/admin/courts/${courtId}/utilization${buildQuery({ days })}`, {}, token),

  // Achievements + player stats
  listAchievements: () => request<Achievement[]>("/achievements"),

  listMyAchievements: (token: string) => request<Achievement[]>("/achievements/mine", {}, token),

  getMyStats: (token: string) => request<PlayerStats>("/stats/me", {}, token),

  getLeaderboard: (token: string, limit?: number) =>
    request<LeaderboardEntry[]>(`/stats/leaderboard${buildQuery({ limit })}`, {}, token),

  // Court discovery
  listTrendingCourts: (days?: number, limit?: number) => request<Court[]>(`/courts/trending${buildQuery({ days, limit })}`),

  listRecommendedCourts: (token: string, limit?: number) =>
    request<Court[]>(`/courts/recommended${buildQuery({ limit })}`, {}, token),

  // "Find a partner" — open games and join requests
  listOpenGames: (token: string) => request<OpenGame[]>("/reservations/open", {}, token),

  setReservationOpen: (token: string, reservationId: string, payload: { open_to_join: boolean; open_note?: string }) =>
    request<Reservation>(`/reservations/${reservationId}/open`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  listJoinRequests: (token: string, reservationId: string) =>
    request<JoinRequest[]>(`/reservations/${reservationId}/join-requests`, {}, token),

  requestToJoin: (token: string, reservationId: string, note?: string) =>
    request<JoinRequest>(
      `/reservations/${reservationId}/join-requests`,
      { method: "POST", body: JSON.stringify({ note }) },
      token,
    ),

  acceptJoinRequest: (token: string, reservationId: string, requestId: string) =>
    request<ReservationGuest>(`/reservations/${reservationId}/join-requests/${requestId}/accept`, { method: "POST" }, token),

  declineJoinRequest: (token: string, reservationId: string, requestId: string) =>
    request<JoinRequest>(`/reservations/${reservationId}/join-requests/${requestId}/decline`, { method: "POST" }, token),

  listMyJoinRequests: (token: string) => request<JoinRequestWithReservation[]>("/reservations/join-requests/mine", {}, token),

  listFrequentTeammates: (token: string, limit?: number) =>
    request<Teammate[]>(`/reservations/frequent-teammates${buildQuery({ limit })}`, {}, token),

  // Calendar export
  downloadReservationIcs: (token: string, reservationId: string, filename: string) =>
    downloadAuthedFile(`/reservations/${reservationId}/ics`, token, filename),

  issueCalendarToken: (token: string) => request<CalendarToken>("/auth/me/calendar-token", { method: "POST" }, token),

  getCalendarFeedUrl: (calendarToken: string) => `${API_URL}/reservations/calendar.ics?token=${calendarToken}`,

  // Cost split
  splitReservationCost: (token: string, reservationId: string) =>
    request<ReservationSplit>(`/reservations/${reservationId}/split`, {}, token),

  // Review helpfulness
  toggleReviewHelpful: (token: string, reviewId: string) =>
    request<Review>(`/reviews/${reviewId}/helpful`, { method: "POST" }, token),
}
