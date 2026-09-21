import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Award,
  Camera,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Copy,
  Flame,
  MapPinned,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
  Volleyball,
} from "lucide-react"
import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/avatar"
import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/card"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CourtCard } from "@/components/shared/court-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { Input } from "@/components/shared/input"
import { Label } from "@/components/shared/label"
import { SectionHeader } from "@/components/shared/section-header"
import { Skeleton } from "@/components/shared/skeleton"
import { StarRating } from "@/components/shared/star-rating"
import { StatTile } from "@/components/shared/stat-tile"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/tabs"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { compressImageFile } from "@/lib/image"
import { ROLE_VARIANT, useRoleLabels } from "@/lib/user-role"
import { cn } from "@/lib/utils"
import type { Court, Review } from "@/types"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatKb(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function OverviewTab() {
  const { user, token, updateUser } = useAuth()
  const { t } = useTranslation()
  const roleLabels = useRoleLabels()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user?.name ?? "")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: stats } = useQuery({
    queryKey: ["stats-me"],
    queryFn: () => api.getMyStats(token!),
    enabled: Boolean(token),
  })

  const calendarTokenMutation = useMutation({
    mutationFn: () => api.issueCalendarToken(token!),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.calendar.error")),
  })

  const feedUrl = calendarTokenMutation.data ? api.getCalendarFeedUrl(calendarTokenMutation.data.calendar_token) : null

  function copyFeedUrl() {
    if (!feedUrl) return
    navigator.clipboard.writeText(feedUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const saveNameMutation = useMutation({
    mutationFn: (nextName: string) => api.updateProfile(token!, nextName),
    onSuccess: (updated) => {
      updateUser(updated)
      toast.success(t("profile.toast.updated"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.updateFailed")),
  })

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const originalKb = formatKb(file.size)
      const compressed = await compressImageFile(file)
      const updated = await api.uploadAvatar(token!, compressed)
      return { updated, originalKb, compressedKb: formatKb(compressed.size) }
    },
    onSuccess: ({ updated, originalKb, compressedKb }) => {
      updateUser(updated)
      toast.success(t("profile.toast.avatarUpdated", { from: originalKb, to: compressedKb }))
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t("profile.error.avatarFailed"))
      setAvatarPreview(null)
    },
  })

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setAvatarPreview(URL.createObjectURL(file))
    avatarMutation.mutate(file)
  }

  function handleNameSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length === 0) return
    saveNameMutation.mutate(name.trim())
  }

  if (!user) return null
  const avatarSrc = avatarPreview ?? assetUrl(user.avatar_url)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile icon={CheckCircle2} label={t("profile.stat.completed")} value={stats?.completed_reservations ?? 0} />
        <StatTile icon={CalendarClock} label={t("profile.stat.hoursPlayed")} value={stats?.hours_played ?? 0} />
        <StatTile icon={MapPinned} label={t("profile.stat.courtsPlayed")} value={stats?.distinct_courts_played ?? 0} />
        <StatTile icon={Volleyball} label={t("profile.stat.sportsPlayed")} value={stats?.sports_played ?? 0} />
        <StatTile icon={Flame} label={t("profile.stat.streak")} value={stats?.current_streak_weeks ?? 0} />
        <StatTile
          icon={Award}
          label={t("profile.stat.achievements")}
          value={stats ? `${stats.achievements_unlocked}/${stats.achievements_total}` : "–"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5 text-signal-blue" /> {t("profile.calendar.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-slate-gray">{t("profile.calendar.description")}</p>
          {feedUrl ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-hairline bg-pebble px-3 py-2">
                <span className="flex-1 truncate text-xs text-slate-gray">{feedUrl}</span>
                <Button size="sm" variant="ghost" onClick={copyFeedUrl}>
                  <Copy className="size-3.5" /> {copied ? t("profile.calendar.copied") : t("profile.calendar.copy")}
                </Button>
              </div>
              <p className="text-xs text-slate-gray">{t("profile.calendar.hint")}</p>
              <Button
                size="sm"
                variant="outline"
                className="w-fit"
                disabled={calendarTokenMutation.isPending}
                onClick={() => calendarTokenMutation.mutate()}
              >
                {t("profile.calendar.regenerate")}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="w-fit"
              disabled={calendarTokenMutation.isPending}
              onClick={() => calendarTokenMutation.mutate()}
            >
              {t("profile.calendar.generate")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.picture.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="size-20">
              <AvatarImage src={avatarSrc} alt={user.name} className="object-cover" />
              <AvatarFallback className="text-lg">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMutation.isPending}
              className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-signal-blue text-paper shadow-button transition-transform hover:scale-105 disabled:opacity-60"
              aria-label={t("profile.avatar.change")}
            >
              <Camera className="size-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-ink-navy">
              {avatarMutation.isPending ? t("profile.avatar.uploading") : t("profile.avatar.hint")}
            </p>
            <p className="text-sm text-slate-gray">{t("profile.avatar.description")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.details.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNameSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t("auth.field.name")}</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("auth.field.email")}</Label>
              <Input value={user.email} disabled />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("profile.role.label")}</Label>
              <Badge variant={ROLE_VARIANT[user.role]} className="w-fit gap-1.5">
                <ShieldCheck className="size-3.5" />
                {roleLabels[user.role]}
              </Badge>
            </div>

            <Button
              type="submit"
              className="mt-2 w-fit"
              disabled={saveNameMutation.isPending || name.trim() === user.name}
            >
              {saveNameMutation.isPending ? t("profile.saving") : t("profile.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites-mine"] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.favoritesFailed")),
  })

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[16/10] w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState title={t("common.error.title")} description={t("common.error.description")} onRetry={() => refetch()} />
  }

  if (favorites?.length === 0) {
    return (
      <EmptyState
        title={t("profile.favorites.empty.title")}
        description={t("profile.favorites.empty.description")}
        action={
          <Button asChild size="sm" className="mt-2">
            <Link to="/courts">{t("profile.favorites.browse")}</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {favorites?.map((court) => (
        <CourtCard
          key={court.id}
          court={court}
          href={`/courts/${court.id}`}
          isFavorite
          onToggleFavorite={(c) => removeMutation.mutate(c)}
        />
      ))}
    </div>
  )
}

function ReviewsTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: reviews, isLoading, isError, refetch } = useQuery({
    queryKey: ["reviews-mine"],
    queryFn: () => api.listMyReviews(token!),
    enabled: Boolean(token),
  })
  const { data: courts } = useQuery({ queryKey: ["courts"], queryFn: () => api.listCourts() })
  const courtNameById = new Map(courts?.map((c) => [c.id, c.name]) ?? [])

  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteReview(token!, id),
    onSuccess: () => {
      toast.success(t("profile.toast.reviewDeleted"))
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ["reviews-mine"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.reviewDeleteFailed")),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState title={t("common.error.title")} description={t("common.error.description")} onRetry={() => refetch()} />
  }

  if (reviews?.length === 0) {
    return <EmptyState title={t("profile.reviews.empty.title")} description={t("profile.reviews.empty.description")} />
  }

  return (
    <div className="flex flex-col gap-3">
      {reviews?.map((review) => (
        <div
          key={review.id}
          className="flex flex-col gap-2 rounded-2xl border border-hairline bg-card p-4 shadow-card sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink-navy">{courtNameById.get(review.court_id) ?? "Court"}</span>
              <StarRating value={review.rating} />
            </div>
            {review.comment && <p className="text-sm text-slate-gray">{review.comment}</p>}
            <span className="text-xs text-mist-gray">
              {new Date(review.created_at).toLocaleDateString()}
              {review.helpful_count > 0 && ` · ${t("courtDetail.reviews.helpfulCount", { count: review.helpful_count })}`}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-red-50"
            disabled={deleteMutation.isPending}
            onClick={() => setDeleteTarget(review)}
          >
            <Trash2 className="size-3.5" /> {t("common.delete")}
          </Button>
        </div>
      ))}

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

  const { data: achievements, isLoading, isError, refetch } = useQuery({
    queryKey: ["achievements-mine"],
    queryFn: () => api.listMyAchievements(token!),
    enabled: Boolean(token),
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState title={t("common.error.title")} description={t("common.error.description")} onRetry={() => refetch()} />
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {achievements?.map((achievement) => (
        <div
          key={achievement.key}
          className={cn(
            "flex items-center gap-4 rounded-2xl border p-4 shadow-card",
            achievement.unlocked ? "border-hairline bg-card" : "border-dashed border-hairline bg-cloud opacity-70",
          )}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-pebble text-xl">
            {achievement.icon}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-ink-navy">{achievement.title}</span>
            <span className="text-xs text-slate-gray">{achievement.description}</span>
            <span className="text-[11px] text-mist-gray">
              {achievement.unlocked && achievement.earned_at
                ? t("achievements.earnedOn", { date: new Date(achievement.earned_at).toLocaleDateString() })
                : t("achievements.locked")}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function LeaderboardTab() {
  const { token, user } = useAuth()
  const { t } = useTranslation()

  const { data: leaderboard, isLoading, isError, refetch } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.getLeaderboard(token!, 20),
    enabled: Boolean(token),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState title={t("common.error.title")} description={t("common.error.description")} onRetry={() => refetch()} />
  }

  if (leaderboard?.length === 0) {
    return <EmptyState title={t("leaderboard.empty")} />
  }

  return (
    <div className="flex flex-col gap-2">
      {leaderboard?.map((entry) => (
        <div
          key={entry.user.id}
          className={cn(
            "flex items-center gap-4 rounded-2xl border p-4 shadow-card",
            entry.user.id === user?.id ? "border-signal-blue bg-[#eaf3ff]" : "border-hairline bg-card",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pebble text-sm font-semibold text-ink-navy">
            {entry.rank <= 3 ? <Trophy className="size-4 text-amber-500" /> : t("leaderboard.rank", { rank: entry.rank })}
          </span>
          <Avatar className="size-9">
            <AvatarImage src={assetUrl(entry.user.avatar_url)} alt={entry.user.name} className="object-cover" />
            <AvatarFallback>{initials(entry.user.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-ink-navy">
              {entry.user.name}
              {entry.user.id === user?.id && <span className="ml-1.5 text-xs text-signal-blue">({t("leaderboard.you")})</span>}
            </span>
            <span className="text-xs text-slate-gray">
              {entry.completed_reservations} · {t("leaderboard.hoursPlayed", { hours: entry.hours_played })}
            </span>
          </div>
          <Star className="ml-auto size-4 text-mist-gray" />
        </div>
      ))}
    </div>
  )
}

function ProfilePage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <SectionHeader align="left" title={t("profile.title")} description={t("profile.description")} />

      <Tabs defaultValue="overview" className="mt-10">
        <TabsList>
          <TabsTrigger value="overview">{t("profile.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="achievements">{t("profile.tabs.achievements")}</TabsTrigger>
          <TabsTrigger value="leaderboard">{t("profile.tabs.leaderboard")}</TabsTrigger>
          <TabsTrigger value="favorites">{t("profile.tabs.favorites")}</TabsTrigger>
          <TabsTrigger value="reviews">{t("profile.tabs.reviews")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="achievements">
          <AchievementsTab />
        </TabsContent>
        <TabsContent value="leaderboard">
          <LeaderboardTab />
        </TabsContent>
        <TabsContent value="favorites">
          <FavoritesTab />
        </TabsContent>
        <TabsContent value="reviews">
          <ReviewsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { ProfilePage }
