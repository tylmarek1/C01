export type UserRole = "PLAYER" | "VENUE_MANAGER"
export type SportType = "TENNIS" | "VOLLEYBALL" | "BADMINTON"
export type ReservationStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "NO_SHOW"
export type WaitlistStatus = "WAITING" | "OFFERED" | "ACCEPTED" | "EXPIRED" | "CANCELLED"
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
  | "FACILITY_UNAVAILABLE"
  | "WAITLIST_JOINED"
  | "WAITLIST_SLOT_OFFERED"
export type ReservationEventType =
  | "CREATED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
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

export interface Court {
  id: string
  name: string
  sport_type: SportType
  indoor: boolean
  active: boolean
  description: string | null
  image_url: string | null
  amenities: Amenity[]
  average_rating: number | null
  review_count: number
}

export interface Reservation {
  id: string
  court: Court
  start_time: string
  end_time: string
  status: ReservationStatus
  hold_expires_at: string | null
  series_id: string | null
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
  reservations_last_30_days: number
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
