import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Award, CalendarClock, Flame, Lock, MapPinned, MessageCircle, Pencil, Swords, Trophy, UserCheck, UserPlus, UserRoundX } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { AchievementIcon } from "@/components/shared/achievement-icon"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { PageContainer } from "@/components/shared/page-header"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { StatTile } from "@/components/shared/stat-tile"
import { SubsectionHeading } from "@/components/shared/subsection-heading"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import type { FollowerEntry } from "@/types"

function FollowListDialog({
  title,
  queryKey,
  queryFn,
  trigger,
}: {
  title: string
  queryKey: unknown[]
  queryFn: () => Promise<FollowerEntry[]>
  trigger: (open: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const fmt = useFormatters()
  const { data, isLoading, isError } = useQuery({ queryKey, queryFn, enabled: open })

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
          {isLoading && <Skeleton className="h-40 w-full" />}
          {!isLoading && isError && <EmptyState size="compact" icon={Lock} title={t("playerProfile.followList.private")} />}
          {!isLoading && !isError && (data?.length ?? 0) === 0 && <EmptyState size="compact" title={t("playerProfile.followList.empty")} />}
          {!isLoading && !isError && data && data.length > 0 && (
            <div className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
              {data.map((entry) => (
                <Link
                  key={entry.user.id}
                  to={`/app/players/${entry.user.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted"
                >
                  <UserAvatar name={entry.user.name} avatarUrl={entry.user.avatar_url} size="sm" />
                  <span className="flex-1 truncate text-[13px] font-medium">{entry.user.name}</span>
                  <span className="font-mono text-[11px] text-subtle-foreground">{fmt.dateMedium(entry.followed_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const sportLabels = useSportLabels()

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["player-profile", id],
    queryFn: () => api.getPlayerProfile(token!, id!),
    enabled: Boolean(token && id),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["player-profile", id] })
  const followMutation = useMutation({
    mutationFn: () => api.followPlayer(token!, id!),
    onSuccess: () => {
      invalidate()
      toast.success(t("playerProfile.toast.followed", { name: profile?.user.name ?? "" }))
    },
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
      <PageContainer>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </PageContainer>
    )
  }

  if (isError || !profile || !id) {
    return (
      <PageContainer size="narrow">
        <ErrorState title={t("playerProfile.error.loadFailed")} onRetry={() => refetch()} />
      </PageContainer>
    )
  }

  const stats = profile.stats
  const wins = stats?.recent_matches.filter((m) => m.result === "win").length ?? 0
  const decided = stats?.recent_matches.filter((m) => m.result).length ?? 0

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft /> {t("playerProfile.back")}
      </Button>

      <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div aria-hidden className="h-24 bg-panel bg-[radial-gradient(80%_120%_at_90%_0%,color-mix(in_oklab,var(--brand)_45%,transparent),transparent_70%)] sm:h-28" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="-mt-12 flex flex-col gap-3 sm:flex-row sm:items-end">
            <UserAvatar name={profile.user.name} avatarUrl={profile.user.avatar_url} size="2xl" className="ring-4 ring-card" />
            <div className="flex flex-col gap-1.5 sm:pb-1">
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.025em]">
                {profile.user.name}
                {!profile.profile_public && (
                  <Badge variant="outline">
                    <Lock /> {t("profile.private")}
                  </Badge>
                )}
              </h1>
              {profile.bio && <p className="max-w-lg text-[13px] text-muted-foreground">{profile.bio}</p>}
              <div className="flex items-center gap-4 text-[13px]">
                <FollowListDialog
                  title={t("playerProfile.followers.title")}
                  queryKey={["followers", id]}
                  queryFn={() => api.listFollowers(token!, id)}
                  trigger={(open) => (
                    <button type="button" onClick={open} className="text-muted-foreground hover:text-foreground">
                      <span className="font-semibold text-foreground tabular">{fmt.number(profile.followers_count)}</span> {t("playerProfile.followers.label")}
                    </button>
                  )}
                />
                <FollowListDialog
                  title={t("playerProfile.following.title")}
                  queryKey={["following", id]}
                  queryFn={() => api.listFollowing(token!, id)}
                  trigger={(open) => (
                    <button type="button" onClick={open} className="text-muted-foreground hover:text-foreground">
                      <span className="font-semibold text-foreground tabular">{fmt.number(profile.following_count)}</span> {t("playerProfile.following.label")}
                    </button>
                  )}
                />
              </div>
            </div>
          </div>
          {profile.is_self ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/settings#public-profile">
                <Pencil /> {t("playerProfile.editOwn")}
              </Link>
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" isLoading={messageMutation.isPending} onClick={() => messageMutation.mutate()}>
                {!messageMutation.isPending && <MessageCircle />} {t("playerProfile.message")}
              </Button>
              {profile.is_following ? (
                <Button size="sm" variant="secondary" isLoading={unfollowMutation.isPending} onClick={() => unfollowMutation.mutate()} className="group/follow">
                  {!unfollowMutation.isPending && (
                    <>
                      <UserCheck className="group-hover/follow:hidden" />
                      <UserRoundX className="hidden group-hover/follow:block" />
                    </>
                  )}
                  <span className="group-hover/follow:hidden">{t("playerProfile.following.state")}</span>
                  <span className="hidden group-hover/follow:inline">{t("playerProfile.unfollow")}</span>
                </Button>
              ) : (
                <Button size="sm" isLoading={followMutation.isPending} onClick={() => followMutation.mutate()}>
                  {!followMutation.isPending && <UserPlus />} {t("playerProfile.follow")}
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {!stats ? (
        <EmptyState className="mt-6" icon={Lock} title={t("playerProfile.privateTitle")} description={t("playerProfile.private")} />
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatTile icon={CalendarClock} label={t("profile.stat.completed")} value={stats.completed_reservations} />
            <StatTile icon={MapPinned} label={t("profile.stat.courtsPlayed")} value={stats.distinct_courts_played} />
            <StatTile icon={Trophy} label={t("profile.stat.sportsPlayed")} value={stats.sports_played} />
            <StatTile icon={Flame} label={t("profile.stat.streak")} value={stats.current_streak_weeks} />
            <StatTile
              icon={Swords}
              label={t("playerProfile.winRate")}
              value={decided > 0 ? fmt.percent(wins / decided) : "–"}
              hint={decided > 0 ? t("playerProfile.winRateHint", { wins, games: decided }) : t("playerProfile.winRateNone")}
            />
          </div>

          {stats.ratings.length > 0 && (
            <section className="flex flex-col gap-3">
              <SubsectionHeading title={t("playerProfile.ratings.title")} />
              <div className="grid gap-3 sm:grid-cols-3">
                {stats.ratings.map((entry) => (
                  <div key={entry.sport_type} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <SportIcon sport={entry.sport_type} className="size-5" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">{sportLabels[entry.sport_type]}</span>
                      <span className="text-xl font-semibold tracking-tight tabular">{Math.round(entry.rating)}</span>
                      <span className="text-[11px] text-muted-foreground">{t("playerProfile.ratings.matchesPlayed", { count: entry.matches_played })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <SubsectionHeading title={t("playerProfile.achievements.title")} count={stats.achievements.length} />
              {stats.achievements.length === 0 ? (
                <EmptyState size="compact" icon={Award} title={t("playerProfile.achievements.empty")} />
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {stats.achievements.map((achievement) => (
                    <div key={achievement.key} className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 shadow-xs" title={achievement.description}>
                      <span className="flex size-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
                        <AchievementIcon achievementKey={achievement.key} className="size-4" />
                      </span>
                      <span className="text-[13px] leading-tight font-medium">{achievement.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SubsectionHeading title={t("playerProfile.recentGames.title")} />
              {stats.recent_matches.length === 0 ? (
                <EmptyState size="compact" icon={CalendarClock} title={t("profile.matches.empty.title")} />
              ) : (
                <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                  {stats.recent_matches.map((match) => (
                    <li key={match.reservation_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <SportIcon sport={match.sport_type} className="size-4 text-muted-foreground" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-medium">{match.court_name}</span>
                        <span className="text-xs text-muted-foreground">{fmt.dateMedium(match.played_at)}</span>
                      </div>
                      {match.opponent && (
                        <Link to={`/app/players/${match.opponent.id}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <UserAvatar name={match.opponent.name} avatarUrl={match.opponent.avatar_url} size="xs" />
                          {t("playerProfile.recentGames.vs", { name: match.opponent.name })}
                        </Link>
                      )}
                      {match.result && (
                        <Badge variant={match.result === "win" ? "success" : match.result === "loss" ? "destructive" : "secondary"}>
                          {t(`playerProfile.recentGames.result.${match.result}` as TranslationKey)}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

export { PlayerProfilePage }
