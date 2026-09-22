import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Award, CalendarClock, Flame, MapPinned, MessageCircle, Trophy, UserMinus, UserPlus, Volleyball } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/avatar"
import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shared/dialog"
import { ErrorState } from "@/components/shared/error-state"
import { Skeleton } from "@/components/shared/skeleton"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { StatTile } from "@/components/shared/stat-tile"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import type { FollowerEntry } from "@/types"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function FollowListDialog({
  title,
  queryKey,
  queryFn,
  trigger,
}: {
  title: string
  queryKey: unknown[]
  queryFn: () => Promise<FollowerEntry[]>
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({ queryKey, queryFn, enabled: open })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {isLoading && <Skeleton className="h-40 w-full" />}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="py-6 text-center text-sm text-slate-gray">{t("playerProfile.followList.empty")}</p>
        )}
        {!isLoading && data && data.length > 0 && (
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {data.map((entry) => (
              <Link
                key={entry.user.id}
                to={`/app/players/${entry.user.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-pebble"
              >
                <Avatar className="size-9">
                  <AvatarImage src={assetUrl(entry.user.avatar_url)} alt={entry.user.name} loading="lazy" className="object-cover" />
                  <AvatarFallback>{initials(entry.user.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-ink-navy">{entry.user.name}</span>
              </Link>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["player-profile", id],
    queryFn: () => api.getPlayerProfile(token!, id!),
    enabled: Boolean(token && id),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["player-profile", id] })

  const followMutation = useMutation({
    mutationFn: () => api.followPlayer(token!, id!),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("playerProfile.error.followFailed")),
  })

  const unfollowMutation = useMutation({
    mutationFn: () => api.unfollowPlayer(token!, id!),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("playerProfile.error.followFailed")),
  })

  const messageMutation = useMutation({
    mutationFn: () => api.openDirectMessage(token!, id!),
    onSuccess: (conversation) => navigate(`/app/chat?conversation=${conversation.id}`),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("playerProfile.error.messageFailed")),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError || !profile || !id) {
    return <ErrorState title={t("playerProfile.error.loadFailed")} onRetry={() => refetch()} />
  }

  const stats = profile.stats

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate(-1)}>
        <ArrowLeft className="size-4" /> {t("playerProfile.back")}
      </Button>

      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-8 text-center sm:flex-row sm:items-center sm:text-left">
          <Avatar className="size-20">
            <AvatarImage src={assetUrl(profile.user.avatar_url)} alt={profile.user.name} className="object-cover" />
            <AvatarFallback className="text-lg">{initials(profile.user.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-2">
            <h1 className="text-xl font-bold text-ink-navy">{profile.user.name}</h1>
            {profile.bio && <p className="text-sm text-slate-gray">{profile.bio}</p>}
            <div className="flex items-center justify-center gap-4 sm:justify-start">
              <FollowListDialog
                title={t("playerProfile.followers.title")}
                queryKey={["followers", id]}
                queryFn={() => api.listFollowers(token!, id)}
                trigger={
                  <button type="button" className="text-sm text-ink-navy hover:underline">
                    <span className="font-semibold">{profile.followers_count}</span> {t("playerProfile.followers.label")}
                  </button>
                }
              />
              <FollowListDialog
                title={t("playerProfile.following.title")}
                queryKey={["following", id]}
                queryFn={() => api.listFollowing(token!, id)}
                trigger={
                  <button type="button" className="text-sm text-ink-navy hover:underline">
                    <span className="font-semibold">{profile.following_count}</span> {t("playerProfile.following.label")}
                  </button>
                }
              />
            </div>
          </div>
          {profile.is_self ? (
            <Button variant="outline" asChild>
              <Link to="/app/profile">{t("playerProfile.editOwn")}</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={messageMutation.isPending} onClick={() => messageMutation.mutate()}>
                <MessageCircle className="size-4" /> {t("playerProfile.message")}
              </Button>
              <Button
                variant={profile.is_following ? "outline" : "default"}
                disabled={followMutation.isPending || unfollowMutation.isPending}
                onClick={() => (profile.is_following ? unfollowMutation.mutate() : followMutation.mutate())}
              >
                {profile.is_following ? (
                  <>
                    <UserMinus className="size-4" /> {t("playerProfile.unfollow")}
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4" /> {t("playerProfile.follow")}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile icon={CalendarClock} label={t("profile.stat.completed")} value={stats.completed_reservations} />
            <StatTile icon={MapPinned} label={t("profile.stat.courtsPlayed")} value={stats.distinct_courts_played} />
            <StatTile icon={Volleyball} label={t("profile.stat.sportsPlayed")} value={stats.sports_played} />
            <StatTile icon={Flame} label={t("profile.stat.streak")} value={stats.current_streak_weeks} />
            <StatTile icon={Award} label={t("profile.stat.achievements")} value={stats.achievements.length} />
          </div>

          {stats.ratings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="size-5 text-signal-blue" /> {t("playerProfile.ratings.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {stats.ratings.map((entry) => (
                  <Badge key={entry.sport_type} variant="secondary" className="gap-1.5 py-1.5 text-sm">
                    {sportLabels[entry.sport_type]}: {entry.rating}{" "}
                    <span className="text-slate-gray">
                      {t("playerProfile.ratings.matchesPlayed", { count: entry.matches_played })}
                    </span>
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {stats.achievements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("playerProfile.achievements.title")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {stats.achievements.map((achievement) => (
                  <Badge key={achievement.key} variant="secondary" className="gap-1.5 py-1.5 text-sm">
                    <span>{achievement.icon}</span> {achievement.title}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {stats.recent_matches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="size-5 text-signal-blue" /> {t("playerProfile.recentGames.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {stats.recent_matches.map((match) => (
                  <div
                    key={match.reservation_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <SportIcon sport={match.sport_type} className="size-4 text-slate-gray" />
                      <span className="font-medium text-ink-navy">{match.court_name}</span>
                      <span className="text-xs text-mist-gray">{new Date(match.played_at).toLocaleDateString()}</span>
                    </div>
                    {match.opponent && (
                      <div className="flex items-center gap-2">
                        <Link to={`/app/players/${match.opponent.id}`} className="text-xs text-slate-gray hover:underline">
                          {t("playerProfile.recentGames.vs", { name: match.opponent.name })}
                        </Link>
                        {match.result && (
                          <Badge
                            variant={
                              match.result === "win" ? "success" : match.result === "loss" ? "destructive" : "secondary"
                            }
                            className="text-xs"
                          >
                            {t(`playerProfile.recentGames.result.${match.result}`)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-gray">{t("playerProfile.private")}</CardContent>
        </Card>
      )}
    </div>
  )
}

export { PlayerProfilePage }
