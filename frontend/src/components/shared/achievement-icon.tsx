import {
  Award,
  BadgeCheck,
  CalendarCheck,
  Compass,
  Flag,
  Flame,
  Handshake,
  Moon,
  PenLine,
  Sparkles,
  Sunrise,
  Trophy,
  Users,
} from "lucide-react"

// Keyed by Achievement.key (backend/src/reservations/achievements.py) — every
// entry there should have a match here so the icon stays a deliberate choice
// instead of falling back to the generic Award glyph.
const ACHIEVEMENT_ICONS: Record<string, typeof Award> = {
  FIRST_SERVE: Flag,
  REGULAR: CalendarCheck,
  COURT_VETERAN: Trophy,
  EXPLORER: Compass,
  ALL_ROUNDER: Sparkles,
  EARLY_BIRD: Sunrise,
  NIGHT_OWL: Moon,
  SOCIAL_BUTTERFLY: Users,
  TEAM_PLAYER: Handshake,
  ON_A_ROLL: Flame,
  PERFECT_ATTENDANCE: BadgeCheck,
  CRITIC: PenLine,
}

function AchievementIcon({ achievementKey, className }: { achievementKey: string; className?: string }) {
  const Icon = ACHIEVEMENT_ICONS[achievementKey] ?? Award
  return <Icon className={className} />
}

export { AchievementIcon }
