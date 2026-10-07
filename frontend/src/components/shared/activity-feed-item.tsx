import { Award, Sparkles, Trophy, UserPlus, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { AchievementIcon } from "@/components/shared/achievement-icon"
import { UserAvatar } from "@/components/shared/user-avatar"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { ActivityEvent } from "@/types"

const ICON_BY_TYPE: Record<ActivityEvent["type"], typeof Trophy> = {
  FOLLOWED_PLAYER: UserPlus,
  JOINED_TEAM: Users,
  MATCH_RESULT: Trophy,
  CHALLENGE_COMPLETED: Award,
  ACHIEVEMENT_UNLOCKED: Award,
  OPENED_GAME: Sparkles,
}

/** One line of the community feed. `dense` drops the card chrome (sidebar previews). */
function ActivityFeedItem({ event, dense = false }: { event: ActivityEvent; dense?: boolean }) {
  const { t } = useTranslation()
  const fmt = useFormatters()
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
    <div className={cn("flex items-start gap-3", !dense && "rounded-lg border border-border bg-card p-3.5 shadow-xs")}>
      <Link to={`/app/players/${event.user.id}`} className="relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        <UserAvatar name={event.user.name} avatarUrl={event.user.avatar_url} size={dense ? "sm" : "md"} />
        <span className="absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full bg-card text-foreground shadow-xs ring-1 ring-border">
          {event.type === "ACHIEVEMENT_UNLOCKED" && event.payload.achievement_key ? (
            <AchievementIcon achievementKey={event.payload.achievement_key} className="size-2.5" />
          ) : (
            <Icon className="size-2.5" />
          )}
        </span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[13px] leading-snug text-muted-foreground">
          <Link to={`/app/players/${event.user.id}`} className="font-semibold text-foreground hover:underline">
            {event.user.name}
          </Link>{" "}
          {describe()}
        </p>
        <time dateTime={event.created_at} className="font-mono text-[11px] text-subtle-foreground">
          {fmt.relativeTime(event.created_at)}
        </time>
      </div>
    </div>
  )
}

export { ActivityFeedItem }
