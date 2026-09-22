export type UserRole = "PLAYER" | "VENUE_MANAGER" | "ADMIN"
export type SportType = "TENNIS" | "VOLLEYBALL" | "BADMINTON"
export type ReservationStatus =
  | "PENDING"
  | "PENDING_APPROVAL"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
  | "REJECTED"
  | "NO_SHOW"
export type WaitlistStatus = "WAITING" | "OFFERED" | "ACCEPTED" | "EXPIRED" | "CANCELLED"
export type JoinRequestStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"
export type Amenity =
  | "LIGHTING"
  | "PARKING"
  | "SHOWERS"
  | "LOCKERS"
  | "EQUIPMENT_RENTAL"
  | "SEATING"
  | "WHEELCHAIR_ACCESSIBLE"
  | "CAFE"
export type NotificationType =
  | "RESERVATION_CREATED"
  | "RESERVATION_CONFIRMED"
  | "RESERVATION_CANCELLED"
  | "RESERVATION_CHANGED"
  | "RESERVATION_REMINDER"
  | "RESERVATION_EXPIRED"
  | "RESERVATION_REJECTED"
  | "APPROVAL_REQUESTED"
  | "FACILITY_UNAVAILABLE"
  | "WAITLIST_JOINED"
  | "WAITLIST_SLOT_OFFERED"
  | "ACHIEVEMENT_UNLOCKED"
  | "JOIN_REQUEST_RECEIVED"
  | "JOIN_REQUEST_ACCEPTED"
  | "JOIN_REQUEST_DECLINED"
export type ReservationEventType =
  | "CREATED"
  | "SUBMITTED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
  | "REJECTED"
  | "NO_SHOW"
  | "TIME_CHANGED"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar_url: string | null
}

export interface UserAdmin extends User {
  created_at: string
  active_reservation_count: number
  no_show_count: number
}

export interface CourtImage {
  id: string
  url: string
  position: number
}

export interface Court {
  id: string
  name: string
  sport_type: SportType
  indoor: boolean
  active: boolean
  requires_approval: boolean
  description: string | null
  image_url: string | null
  amenities: Amenity[]
  price_per_hour: number | null
  average_rating: number | null
  review_count: number
  images: CourtImage[]
}

export interface Reservation {
  id: string
  court: Court
  start_time: string
  end_time: string
  status: ReservationStatus
  hold_expires_at: string | null
  approval_expires_at: string | null
  series_id: string | null
  open_to_join: boolean
  open_note: string | null
  created_at: string
}

export interface ReservationAdmin extends Reservation {
  user: User
}

export interface ReservationEvent {
  id: string
  event_type: ReservationEventType
  actor_id: string | null
  note: string | null
  created_at: string
}

export interface ReservationSeriesResult {
  series_id: string
  requested_occurrences: number
  booked: Reservation[]
  failed_weeks: number[]
}

export interface BusySlot {
  start_time: string
  end_time: string
  status: ReservationStatus
}

export interface CourtAvailability {
  court_id: string
  date: string
  opens_at: string
  closes_at: string
  busy: BusySlot[]
}

export interface WaitlistEntry {
  id: string
  court: Court
  start_time: string
  end_time: string
  status: WaitlistStatus
  offer_expires_at: string | null
  created_at: string
}

export interface FacilityBlock {
  id: string
  court: Court
  start_time: string
  end_time: string
  reason: string
  created_at: string
}

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  read_at: string | null
  created_at: string
}

export interface Review {
  id: string
  court_id: string
  reservation_id: string
  rating: number
  comment: string | null
  created_at: string
  user: User
  manager_reply: string | null
  manager_reply_at: string | null
  helpful_count: number
  voted_helpful_by_me: boolean
}

export interface ReservationGuest {
  id: string
  user: User
  created_at: string
}

export interface CourtPopularity {
  court: Court
  reservation_count: number
}

export interface HourlyDemand {
  hour: number
  count: number
}

export interface AdminStats {
  total_reservations: number
  status_breakdown: Record<string, number>
  no_show_rate: number
  reservations_in_window: number
  window_days: number
  total_users: number
  total_courts: number
  top_courts: CourtPopularity[]
  busiest_hours: HourlyDemand[]
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface Achievement {
  key: string
  title: string
  description: string
  icon: string
  earned_at: string | null
  unlocked: boolean
}

export interface PlayerStats {
  completed_reservations: number
  hours_played: number
  distinct_courts_played: number
  sports_played: number
  current_streak_weeks: number
  achievements_unlocked: number
  achievements_total: number
}

export interface LeaderboardEntry {
  user: User
  completed_reservations: number
  hours_played: number
  rank: number
}

export interface JoinRequest {
  id: string
  user: User
  status: JoinRequestStatus
  note: string | null
  created_at: string
}

export interface JoinRequestWithReservation extends JoinRequest {
  reservation_id: string
}

export interface OpenGame extends Reservation {
  user: User
  spots_left: number
}

export interface Teammate {
  user: User
  games_together: number
}

export interface ReservationSplitParticipant {
  user: User
  share: number
}

export interface ReservationSplit {
  total_cost: number | null
  currency_note: string
  duration_hours: number
  participant_count: number
  per_person: number | null
  participants: ReservationSplitParticipant[]
}

export interface CalendarToken {
  calendar_token: string
}

export interface CourtUtilizationCell {
  day_of_week: number
  hour: number
  booked_count: number
  possible_count: number
  occupancy: number
}

export interface CourtUtilization {
  court_id: string
  days_analyzed: number
  cells: CourtUtilizationCell[]
}
