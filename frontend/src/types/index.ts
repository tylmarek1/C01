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
export type ConversationKind = "DM" | "RESERVATION" | "TEAM"
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
  | "NEW_FOLLOWER"
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
  series_id: string | null
}

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  read_at: string | null
  created_at: string
}

export interface ReviewImage {
  id: string
  url: string
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
  images: ReviewImage[]
  comment_count: number
}

export interface ReviewComment {
  id: string
  user: User
  body: string
  created_at: string
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

export interface RecentMatch {
  reservation_id: string
  court_name: string
  sport_type: SportType
  played_at: string
  opponent: PlayerSearchResult | null
  result: "win" | "loss" | "draw" | null
}

export interface PlayerProfileStats {
  completed_reservations: number
  distinct_courts_played: number
  sports_played: number
  current_streak_weeks: number
  achievements: Achievement[]
  ratings: SkillRatingEntry[]
  recent_matches: RecentMatch[]
}

export interface PlayerProfile {
  user: User
  bio: string | null
  profile_public: boolean
  is_self: boolean
  is_following: boolean
  followers_count: number
  following_count: number
  stats: PlayerProfileStats | null
}

export interface FollowerEntry {
  user: User
  followed_at: string
}

export interface PlayerSearchResult {
  id: string
  name: string
  avatar_url: string | null
}

export interface Message {
  id: string
  conversation_id: string
  sender: User
  body: string
  created_at: string
}

export interface Conversation {
  id: string
  kind: ConversationKind
  participants: User[]
  last_message: Message | null
  unread_count: number
  created_at: string
}

export type TeamRole = "OWNER" | "MEMBER"

export interface TeamMemberEntry {
  user: User
  role: TeamRole
  joined_at: string
}

export interface Team {
  id: string
  name: string
  sport_type: SportType | null
  description: string | null
  created_by: string
  created_at: string
  members: TeamMemberEntry[]
  my_role: TeamRole
}

export type ChallengeMetric = "RESERVATIONS_COMPLETED" | "COURTS_PLAYED" | "GUESTS_INVITED" | "REVIEWS_WRITTEN"

export interface Challenge {
  id: string
  title: string
  description: string
  sport_type: SportType | null
  metric: ChallengeMetric
  target: number
  starts_at: string
  ends_at: string
  created_by: string
}

export interface ChallengeProgress extends Challenge {
  progress: number
  completed: boolean
  completed_at: string | null
}

export type ActivityEventType =
  | "FOLLOWED_PLAYER"
  | "JOINED_TEAM"
  | "MATCH_RESULT"
  | "CHALLENGE_COMPLETED"
  | "ACHIEVEMENT_UNLOCKED"
  | "OPENED_GAME"

export interface ActivityEvent {
  id: string
  user: User
  type: ActivityEventType
  payload: Record<string, string>
  created_at: string
}

export interface MatchResult {
  id: string
  reservation_id: string
  reported_by: string
  winner_user_id: string | null
  created_at: string
}

export interface SkillRatingEntry {
  sport_type: SportType
  rating: number
  matches_played: number
}

export interface RatingLeaderboardEntry {
  user: User
  sport_type: SportType
  rating: number
  matches_played: number
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
