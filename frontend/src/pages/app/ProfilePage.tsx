import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowUpRight,
  Award,
  CalendarClock,
  CheckCircle2,
  Flag,
  Flame,
  Heart,
  ImagePlus,
  Lock,
  MapPinned,
  MessageSquare,
  Settings,
  Star,
  Swords,
  Trash2,
  Trophy,
  X,
} from "lucide-react"
import { useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AchievementIcon } from "@/components/shared/achievement-icon"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CourtCard } from "@/components/shared/court-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { PageContainer } from "@/components/shared/page-header"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { StarRating } from "@/components/shared/star-rating"
import { StatTile } from "@/components/shared/stat-tile"
import { SubsectionHeading } from "@/components/shared/subsection-heading"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { compressImageFile } from "@/lib/image"
import { useCourts } from "@/lib/queries"
import { ROLE_VARIANT, useRoleLabels } from "@/lib/user-role"
import { cn } from "@/lib/utils"
import { useNow } from "@/lib/use-now"
import type { Court, Review } from "@/types"

// Mirrors the backend's MAX_REVIEW_IMAGES — server is the real enforcement.
const MAX_REVIEW_IMAGES = 4
type Tab = "overview" | "achievements" | "challenges" | "favorites" | "reviews"
const TABS: Tab[] = ["overview", "achievements", "challenges", "favorites", "reviews"]

function OverviewTab() {
  const { user, token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const sportLabels = useSportLabels()

  const { data: stats } = useQuery({ queryKey: ["stats-me"], queryFn: () => api.getMyStats(token!), enabled: Boolean(token) })
  const { data: profile, isLoading } = useQuery({
    queryKey: ["player-profile", user?.id],
    queryFn: () => api.getPlayerProfile(token!, user!.id),
    enabled: Boolean(token && user),
  })
  const { data: challenges } = useQuery({
    queryKey: ["challenges-mine"],
    queryFn: () => api.listMyChallengeProgress(token!),
    enabled: Boolean(token),
  })
  const now = useNow(60_000)
  const activeChallenges = (challenges ?? []).filter((c) => !c.completed && new Date(c.ends_at).getTime() > now).slice(0, 3)
  const ratings = profile?.stats?.ratings ?? []
  const matches = profile?.stats?.recent_matches ?? []

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={CheckCircle2} label={t("profile.stat.completed")} value={stats?.completed_reservations ?? "–"} />
        <StatTile icon={CalendarClock} label={t("profile.stat.hoursPlayed")} value={stats ? fmt.number(stats.hours_played) : "–"} />
        <StatTile icon={MapPinned} label={t("profile.stat.courtsPlayed")} value={stats?.distinct_courts_played ?? "–"} />
        <StatTile icon={Trophy} label={t("profile.stat.sportsPlayed")} value={stats?.sports_played ?? "–"} />
        <StatTile icon={Flame} label={t("profile.stat.streak")} value={stats?.current_streak_weeks ?? "–"} hint={t("profile.stat.streakHint")} />
        <StatTile
          icon={Award}
          label={t("profile.stat.achievements")}
          value={stats ? `${stats.achievements_unlocked}/${stats.achievements_total}` : "–"}
          to="/app/profile?tab=achievements"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <SubsectionHeading
            title={t("playerProfile.ratings.title")}
            action={
              <Button size="xs" variant="ghost" asChild>
                <Link to="/app/players?tab=leaderboards">
                  {t("profile.leaderboardsLink")} <ArrowUpRight />
                </Link>
              </Button>
            }
          />
          {isLoading ? (
            <Skeleton className="h-28" />
          ) : ratings.length === 0 ? (
            <EmptyState size="compact" icon={Swords} title={t("profile.ratings.empty.title")} description={t("profile.ratings.empty.description")} />
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {ratings.map((entry) => (
                <div key={entry.sport_type} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <SportIcon sport={entry.sport_type} className="size-3.5" /> {sportLabels[entry.sport_type]}
                  </span>
                  <span className="text-2xl font-semibold tracking-tight tabular">{Math.round(entry.rating)}</span>
                  <span className="text-xs text-muted-foreground">{t("playerProfile.ratings.matchesPlayed", { count: entry.matches_played })}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SubsectionHeading
            title={t("profile.activeChallenges")}
            action={
              <Button size="xs" variant="ghost" asChild>
                <Link to="/app/profile?tab=challenges">
                  {t("common.viewAll")} <ArrowUpRight />
                </Link>
              </Button>
            }
          />
          {!challenges ? (
            <Skeleton className="h-28" />
          ) : activeChallenges.length === 0 ? (
            <EmptyState size="compact" icon={Flag} title={t("challenges.empty.title")} description={t("challenges.empty.description")} />
          ) : (
            <div className="flex flex-col gap-2">
              {activeChallenges.map((challenge) => (
                <div key={challenge.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{challenge.title}</span>
                    <span className="font-mono text-xs text-muted-foreground tabular">
                      {challenge.progress}/{challenge.target}
                    </span>
                  </div>
                  <Progress tone="brand" value={(challenge.progress / challenge.target) * 100} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <SubsectionHeading title={t("playerProfile.recentGames.title")} />
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : matches.length === 0 ? (
          <EmptyState size="compact" icon={CalendarClock} title={t("profile.matches.empty.title")} description={t("profile.matches.empty.description")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {matches.map((match) => (
              <li key={match.reservation_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <SportIcon sport={match.sport_type} className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-medium">{match.court_name}</span>
                  <span className="text-xs text-muted-foreground">{fmt.dateMedium(match.played_at)}</span>
                </div>
                {match.opponent && (
                  <Link to={`/app/players/${match.opponent.id}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
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
  )
}

function FavoritesTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: favorites, isLoading, isError, refetch } = useQuery({
    queryKey: ["favorites-mine"],
    queryFn: () => api.listMyFavorites(token!),
    enabled: Boolean(token),
  })
  const removeMutation = useMutation({
    mutationFn: (court: Court) => api.removeFavorite(token!, court.id),
    onSuccess: (_v, court) => {
      queryClient.invalidateQueries({ queryKey: ["favorites-mine"] })
      toast.success(t("courts.favorite.removedToast", { court: court.name }))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.favoritesFailed")),
  })

  if (isLoading)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-72 rounded-xl" />
        ))}
      </div>
    )
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (favorites?.length === 0)
    return (
      <EmptyState
        icon={Heart}
        title={t("profile.favorites.empty.title")}
        description={t("profile.favorites.empty.description")}
        action={
          <Button asChild size="sm">
            <Link to="/courts">{t("profile.favorites.browse")}</Link>
          </Button>
        }
      />
    )
  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {favorites?.map((court, index) => (
        <div key={court.id} style={{ "--i": index } as React.CSSProperties}>
          <CourtCard court={court} href={`/courts/${court.id}`} isFavorite onToggleFavorite={(c) => removeMutation.mutate(c)} />
        </div>
      ))}
    </div>
  )
}

function ReviewsTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const queryClient = useQueryClient()
  const { data: reviews, isLoading, isError, refetch } = useQuery({
    queryKey: ["reviews-mine"],
    queryFn: () => api.listMyReviews(token!),
    enabled: Boolean(token),
  })
  const { data: courts } = useCourts()
  const courtById = new Map(courts?.map((c) => [c.id, c]) ?? [])
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteReview(token!, id),
    onSuccess: () => {
      toast.success(t("profile.toast.reviewDeleted"))
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ["reviews-mine"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.reviewDeleteFailed")),
  })
  const addPhotoMutation = useMutation({
    mutationFn: async ({ reviewId, file }: { reviewId: string; file: File }) =>
      api.addReviewImage(token!, reviewId, await compressImageFile(file, 1200, 0.85)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews-mine"] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.reviewPhotoFailed")),
  })
  const removePhotoMutation = useMutation({
    mutationFn: ({ reviewId, imageId }: { reviewId: string; imageId: string }) => api.deleteReviewImage(token!, reviewId, imageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews-mine"] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.reviewPhotoFailed")),
  })

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (reviews?.length === 0)
    return <EmptyState icon={Star} title={t("profile.reviews.empty.title")} description={t("profile.reviews.empty.description")} />

  return (
    <div className="flex flex-col gap-3">
      {reviews?.map((review) => {
        const court = courtById.get(review.court_id)
        return (
          <article key={review.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Link to={`/courts/${review.court_id}`} className="truncate text-[14px] font-semibold hover:underline">
                  {court?.name ?? t("profile.reviews.unknownCourt")}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StarRating value={review.rating} />
                  <span>{fmt.dateMedium(review.created_at)}</span>
                  {review.helpful_count > 0 && <span>· {t("courtDetail.reviews.helpfulCount", { count: review.helpful_count })}</span>}
                  {review.comment_count > 0 && (
                    <span className="inline-flex items-center gap-1">
                      · <MessageSquare className="size-3" /> {review.comment_count}
                    </span>
                  )}
                </div>
              </div>
              <Button size="icon-sm" variant="destructive-ghost" onClick={() => setDeleteTarget(review)} aria-label={t("common.delete")}>
                <Trash2 />
              </Button>
            </div>
            {review.comment && <p className="text-[13px] leading-relaxed text-foreground/90">{review.comment}</p>}
            {review.manager_reply && (
              <div className="rounded-lg border-l-2 border-brand bg-muted/60 px-3 py-2">
                <span className="eyebrow text-[10px]">{t("courtDetail.reviews.venueReply")}</span>
                <p className="mt-1 text-[13px] text-foreground/90">{review.manager_reply}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {review.images.map((image) => (
                <div key={image.id} className="group relative size-16 shrink-0 overflow-hidden rounded-md border border-border">
                  <img src={assetUrl(image.url)} alt="" loading="lazy" className="size-full object-cover" />
                  <button
                    type="button"
                    disabled={removePhotoMutation.isPending}
                    onClick={() => removePhotoMutation.mutate({ reviewId: review.id, imageId: image.id })}
                    aria-label={t("profile.reviews.removePhoto")}
                    className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary/80 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {review.images.length < MAX_REVIEW_IMAGES && (
                <button
                  type="button"
                  disabled={addPhotoMutation.isPending}
                  onClick={() => {
                    setUploadTargetId(review.id)
                    photoInputRef.current?.click()
                  }}
                  aria-label={t("profile.reviews.addPhoto")}
                  className="flex size-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  <ImagePlus className="size-4" />
                </button>
              )}
            </div>
          </article>
        )
      })}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file && uploadTargetId) addPhotoMutation.mutate({ reviewId: uploadTargetId, file })
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("confirmDialog.deleteReview.title")}
        description={t("confirmDialog.deleteReview.description")}
        confirmLabel={t("common.delete")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  )
}

function AchievementsTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const { data: achievements, isLoading, isError, refetch } = useQuery({
    queryKey: ["achievements-mine"],
    queryFn: () => api.listMyAchievements(token!),
    enabled: Boolean(token),
  })

  if (isLoading)
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  if (isError) return <ErrorState onRetry={() => refetch()} />

  const unlocked = achievements?.filter((a) => a.unlocked) ?? []
  const sorted = [...(achievements ?? [])].sort((a, b) => Number(b.unlocked) - Number(a.unlocked))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium">{t("achievements.progress")}</span>
          <span className="font-mono text-muted-foreground tabular">
            {unlocked.length}/{achievements?.length ?? 0}
          </span>
        </div>
        <Progress tone="brand" value={achievements?.length ? (unlocked.length / achievements.length) * 100 : 0} />
      </div>
      <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((achievement, index) => (
          <div
            key={achievement.key}
            style={{ "--i": index } as React.CSSProperties}
            className={cn(
              "flex items-start gap-3.5 rounded-xl border p-4",
              achievement.unlocked ? "border-border bg-card shadow-xs" : "border-dashed border-border-strong bg-transparent",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                achievement.unlocked ? "bg-brand text-brand-foreground" : "bg-muted text-subtle-foreground",
              )}
            >
              {achievement.unlocked ? <AchievementIcon achievementKey={achievement.key} className="size-5" /> : <Lock className="size-4" />}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={cn("text-[14px] font-semibold", !achievement.unlocked && "text-muted-foreground")}>{achievement.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{achievement.description}</span>
              <span className="mt-1 font-mono text-[11px] text-subtle-foreground">
                {achievement.unlocked && achievement.earned_at
                  ? t("achievements.earnedOn", { date: fmt.dateMedium(achievement.earned_at) })
                  : t("achievements.locked")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChallengesTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const sportLabels = useSportLabels()
  const { data: challenges, isLoading, isError, refetch } = useQuery({
    queryKey: ["challenges-mine"],
    queryFn: () => api.listMyChallengeProgress(token!),
    enabled: Boolean(token),
  })
  const now = useNow(60_000)

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (challenges?.length === 0) return <EmptyState icon={Flag} title={t("challenges.empty.title")} description={t("challenges.empty.description")} />

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {challenges?.map((challenge) => {
        const startsAt = new Date(challenge.starts_at).getTime()
        const endsAt = new Date(challenge.ends_at).getTime()
        const state = challenge.completed ? "completed" : now < startsAt ? "upcoming" : now > endsAt ? "ended" : "active"
        const percent = Math.min(100, Math.round((challenge.progress / challenge.target) * 100))
        return (
          <article key={challenge.id} className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs", state === "completed" ? "border-success/40" : "border-border")}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-semibold">{challenge.title}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {fmt.dayMonth(challenge.starts_at)} – {fmt.dayMonth(challenge.ends_at)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {challenge.sport_type && <Badge variant="secondary">{sportLabels[challenge.sport_type]}</Badge>}
                {state === "completed" && <Badge variant="success">{t("challenges.completed")}</Badge>}
                {state === "ended" && <Badge variant="outline">{t("challenges.ended")}</Badge>}
                {state === "upcoming" && <Badge variant="info">{t("challenges.upcoming")}</Badge>}
                {state === "active" && <Badge variant="brand" dot>{t("challenges.active")}</Badge>}
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{challenge.description}</p>
            <div className="mt-auto flex flex-col gap-1.5">
              <Progress tone={state === "completed" ? "success" : "brand"} value={percent} />
              <span className="flex justify-between text-xs text-muted-foreground">
                <span>{t("challenges.progress", { progress: challenge.progress, target: challenge.target })}</span>
                <span className="font-mono tabular">{percent}%</span>
              </span>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function ProfilePage() {
  const { user, token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const roleLabels = useRoleLabels()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("tab") as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "overview"
  const { data: profile } = useQuery({
    queryKey: ["player-profile", user?.id],
    queryFn: () => api.getPlayerProfile(token!, user!.id),
    enabled: Boolean(token && user),
  })

  if (!user) return null

  return (
    <PageContainer size="wide">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="xl" className="ring-4 ring-card shadow-sm" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">{user.name}</h1>
              <Badge variant={ROLE_VARIANT[user.role]}>{roleLabels[user.role]}</Badge>
              {profile && !profile.profile_public && (
                <Badge variant="outline">
                  <Lock /> {t("profile.private")}
                </Badge>
              )}
            </div>
            {profile?.bio ? (
              <p className="max-w-xl text-[13px] text-muted-foreground">{profile.bio}</p>
            ) : (
              <Link to="/app/settings#public-profile" className="text-[13px] text-muted-foreground underline decoration-dashed underline-offset-4 hover:text-foreground">
                {t("profile.addBio")}
              </Link>
            )}
            {profile && (
              <p className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground tabular">{fmt.number(profile.followers_count)}</span> {t("playerProfile.followers.label")}
                </span>
                <span>
                  <span className="font-semibold text-foreground tabular">{fmt.number(profile.following_count)}</span> {t("playerProfile.following.label")}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/app/players/${user.id}`}>
              {t("playerProfile.visibility.viewPublic")} <ArrowUpRight />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/settings">
              <Settings /> {t("nav.settings")}
            </Link>
          </Button>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              if (value === "overview") next.delete("tab")
              else next.set("tab", value)
              return next
            },
            { replace: true },
          )
        }
      >
        <TabsList variant="line">
          <TabsTrigger value="overview">{t("profile.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="achievements">{t("profile.tabs.achievements")}</TabsTrigger>
          <TabsTrigger value="challenges">{t("profile.tabs.challenges")}</TabsTrigger>
          <TabsTrigger value="favorites">{t("profile.tabs.favorites")}</TabsTrigger>
          <TabsTrigger value="reviews">{t("profile.tabs.reviews")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="achievements">
          <AchievementsTab />
        </TabsContent>
        <TabsContent value="challenges">
          <ChallengesTab />
        </TabsContent>
        <TabsContent value="favorites">
          <FavoritesTab />
        </TabsContent>
        <TabsContent value="reviews">
          <ReviewsTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

export { ProfilePage }
