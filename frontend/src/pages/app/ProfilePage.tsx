import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Camera, CalendarClock, CheckCircle2, ShieldCheck, Trash2, XCircle } from "lucide-react"
import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/avatar"
import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/card"
import { CourtCard } from "@/components/shared/court-card"
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
import type { Court } from "@/types"

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user?.name ?? "")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const { data: reservations } = useQuery({
    queryKey: ["reservations"],
    queryFn: () => api.listReservations(token!),
    enabled: Boolean(token),
  })
  const total = reservations?.length ?? 0
  const confirmed = reservations?.filter((r) => r.status === "CONFIRMED" || r.status === "CHECKED_IN" || r.status === "COMPLETED").length ?? 0
  const noShows = reservations?.filter((r) => r.status === "NO_SHOW").length ?? 0

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
        <StatTile icon={CalendarClock} label={t("profile.stat.total")} value={total} />
        <StatTile icon={CheckCircle2} label={t("profile.stat.confirmed")} value={confirmed} />
        <StatTile icon={XCircle} label={t("profile.stat.noShows")} value={noShows} />
      </div>

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
              <Badge variant="secondary" className="w-fit gap-1.5">
                <ShieldCheck className="size-3.5" />
                {user.role === "VENUE_MANAGER" ? t("profile.role.manager") : t("profile.role.player")}
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

  const { data: favorites, isLoading } = useQuery({
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

  if (favorites?.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline py-16 text-center">
        <p className="font-medium text-ink-navy">{t("profile.favorites.empty.title")}</p>
        <p className="max-w-xs text-sm text-slate-gray">{t("profile.favorites.empty.description")}</p>
        <Button asChild size="sm" className="mt-2">
          <Link to="/courts">{t("profile.favorites.browse")}</Link>
        </Button>
      </div>
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

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews-mine"],
    queryFn: () => api.listMyReviews(token!),
    enabled: Boolean(token),
  })
  const { data: courts } = useQuery({ queryKey: ["courts"], queryFn: () => api.listCourts() })
  const courtNameById = new Map(courts?.map((c) => [c.id, c.name]) ?? [])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteReview(token!, id),
    onSuccess: () => {
      toast.success(t("profile.toast.reviewDeleted"))
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

  if (reviews?.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline py-16 text-center">
        <p className="font-medium text-ink-navy">{t("profile.reviews.empty.title")}</p>
        <p className="max-w-xs text-sm text-slate-gray">{t("profile.reviews.empty.description")}</p>
      </div>
    )
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
            <span className="text-xs text-mist-gray">{new Date(review.created_at).toLocaleDateString()}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-red-50"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(review.id)}
          >
            <Trash2 className="size-3.5" /> {t("common.delete")}
          </Button>
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
          <TabsTrigger value="favorites">{t("profile.tabs.favorites")}</TabsTrigger>
          <TabsTrigger value="reviews">{t("profile.tabs.reviews")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
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
