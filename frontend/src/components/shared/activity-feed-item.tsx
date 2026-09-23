import { Award, Sparkles, Trophy, UserPlus, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { AchievementIcon } from "@/components/shared/achievement-icon"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/avatar"
import { assetUrl } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import type { ActivityEvent } from "@/types"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const ICON_BY_TYPE: Record<ActivityEvent["type"], typeof Trophy> = {
  FOLLOWED_PLAYER: UserPlus,
  JOINED_TEAM: Users,
  MATCH_RESULT: Trophy,
  CHALLENGE_COMPLETED: Award,
  ACHIEVEMENT_UNLOCKED: Award,
  OPENED_GAME: Sparkles,
}

function ActivityFeedItem({ event }: { event: ActivityEvent }) {
  const { t } = useTranslation()
  const Icon = ICON_BY_TYPE[event.type]

  function describe(): string {
    const p = event.payload
    switch (event.type) {
      case "FOLLOWED_PLAYER":
        return t("activity.followedPlayer", { followee: p.followee_name })
      case "JOINED_TEAM":
        return t("activity.joinedTeam", { team: p.team_name })
      case "MATCH_RESULT":
        if (p.result === "win") return t("activity.matchResult.win", { opponent: p.opponent_name, court: p.court_name })
        if (p.result === "loss") return t("activity.matchResult.loss", { opponent: p.opponent_name, court: p.court_name })
        return t("activity.matchResult.draw", { opponent: p.opponent_name, court: p.court_name })
      case "CHALLENGE_COMPLETED":
        return t("activity.challengeCompleted", { challenge: p.challenge_title })
      case "ACHIEVEMENT_UNLOCKED":
        return t("activity.achievementUnlocked", { achievement: p.achievement_title })
      case "OPENED_GAME":
        return t("activity.openedGame", { court: p.court_name })
      default:
        return ""
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-card p-4 shadow-card">
      <Link to={`/app/players/${event.user.id}`}>
        <Avatar className="size-10 shrink-0">
          <AvatarImage src={assetUrl(event.user.avatar_url)} alt={event.user.name} loading="lazy" className="object-cover" />
          <AvatarFallback>{initials(event.user.name)}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm text-ink-navy">
          <Link to={`/app/players/${event.user.id}`} className="font-semibold hover:underline">
            {event.user.name}
          </Link>{" "}
          {describe()}
        </span>
        <span className="text-xs text-mist-gray">{new Date(event.created_at).toLocaleString()}</span>
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pebble text-signal-blue">
        {event.type === "ACHIEVEMENT_UNLOCKED" && event.payload.achievement_key ? (
          <AchievementIcon achievementKey={event.payload.achievement_key} className="size-4" />
        ) : (
          <Icon className="size-4" />
        )}
      </span>
    </div>
  )
}

export { ActivityFeedItem }
