import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Heart,
  Images,
  MessageCircle,
  Share2,
  ShieldCheck,
  Star,
  ThumbsUp,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip } from "@/components/ui/tooltip"
import { CourtArt } from "@/components/shared/court-art"
import { EmptyState } from "@/components/shared/empty-state"
import { OccupancyTimeline } from "@/components/shared/occupancy-timeline"
import { PageContainer } from "@/components/shared/page-header"
import { DayStrip, SlotGrid } from "@/components/shared/slot-picker"
import { useSportLabels } from "@/components/shared/sport-icon"
import { StarRating } from "@/components/shared/star-rating"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api, assetUrl } from "@/lib/api"
import { AMENITY_ICON, useAmenityLabels } from "@/lib/amenities"
import { useAuth } from "@/lib/auth-context"
import { bookingHref } from "@/lib/booking"
import { formatCurrency, useFormatters } from "@/lib/format"
import { firstBookableDate } from "@/lib/slots"
import { useTranslation } from "@/lib/i18n"
import { isVenueStaff } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { useNow } from "@/lib/use-now"
import type { Review } from "@/types"

function ReviewCommentThread({ reviewId, courtId }: { reviewId: string; courtId: string }) {
  const { token, user } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")

  const { data: comments, isLoading } = useQuery({
    queryKey: ["review-comments", reviewId],
    queryFn: () => api.listReviewComments(token!, reviewId),
    enabled: Boolean(token),
  })

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["review-comments", reviewId] })
    queryClient.invalidateQueries({ queryKey: ["court-reviews", courtId] })
  }

  const addMutation = useMutation({
    mutationFn: (body: string) => api.addReviewComment(token!, reviewId, body),
    onSuccess: () => {
      setDraft("")
      refresh()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("courtDetail.reviews.commentError")),
  })
  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteReviewComment(token!, reviewId, commentId),
    onSuccess: refresh,
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("courtDetail.reviews.commentError")),
  })

  if (!user) {
    return (
      <p className="mt-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
        <Link to="/login" className="font-medium text-foreground underline underline-offset-2">
          {t("nav.login")}
        </Link>{" "}
        {t("courtDetail.reviews.loginToComment")}
      </p>
    )
  }

  return (
    <div className="mt-2 flex animate-fade-in flex-col gap-3 border-l-2 border-border pl-4">
      {isLoading && <Skeleton className="h-9 w-full" />}
      {!isLoading && comments?.length === 0 && <p className="text-xs text-muted-foreground">{t("courtDetail.reviews.commentsEmpty")}</p>}
      {comments?.map((comment) => (
        <div key={comment.id} className="flex items-start gap-2.5">
          <UserAvatar name={comment.user.name} avatarUrl={comment.user.avatar_url} size="xs" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-xs">
              <Link to={`/app/players/${comment.user.id}`} className="font-medium hover:underline">
                {comment.user.name}
              </Link>
              <span className="font-mono text-[10.5px] text-subtle-foreground">{fmt.relativeTime(comment.created_at)}</span>
            </span>
            <p className="text-[13px] text-foreground/90">{comment.body}</p>
          </div>
          {(comment.user.id === user.id || user.role === "ADMIN") && (
            <Tooltip content={t("common.remove")}>
              <Button size="icon-xs" variant="subtle" onClick={() => deleteMutation.mutate(comment.id)} aria-label={t("common.remove")}>
                <Trash2 />
              </Button>
            </Tooltip>
          )}
        </div>
      ))}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (draft.trim()) addMutation.mutate(draft.trim())
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("courtDetail.reviews.commentPlaceholder")}
          maxLength={500}
          className="h-8 text-[13px]"
          aria-label={t("courtDetail.reviews.commentPlaceholder")}
        />
        <Button type="submit" size="sm" disabled={draft.trim().length === 0} isLoading={addMutation.isPending}>
          {t("courtDetail.reviews.commentSubmit")}
        </Button>
      </form>
    </div>
  )
}

function RatingSummary({ reviews, average, count }: { reviews: Review[]; average: number | null; count: number }) {
  const { t } = useTranslation()
  const buckets = [5, 4, 3, 2, 1].map((stars) => ({ stars, n: reviews.filter((r) => r.rating === stars).length }))
  const max = Math.max(1, ...buckets.map((b) => b.n))
  return (
    <div className="grid gap-6 rounded-xl border border-border bg-card p-5 shadow-xs sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-start gap-1.5 sm:pr-6 sm:border-r sm:border-border">
        <span className="text-[44px] leading-none font-semibold tracking-[-0.04em] tabular">{average !== null ? average.toFixed(1) : "–"}</span>
        <StarRating value={average ?? 0} size="md" />
        <span className="text-xs text-muted-foreground">{t("courtDetail.reviews.count", { count })}</span>
      </div>
      <ul className="flex flex-col justify-center gap-1.5">
        {buckets.map((bucket) => (
          <li key={bucket.stars} className="grid grid-cols-[1.5rem_1fr_2rem] items-center gap-2 text-xs">
            <span className="flex items-center gap-0.5 font-mono text-muted-foreground tabular">
              {bucket.stars}
              <Star className="size-3 fill-star text-star" />
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full origin-left animate-[grow-x_600ms_var(--ease-out)_both] rounded-full bg-star" style={{ width: `${(bucket.n / max) * 100}%` }} />
            </span>
            <span className="text-right font-mono text-muted-foreground tabular">{bucket.n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CourtDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const sportLabels = useSportLabels()
  const amenityLabels = useAmenityLabels()
  const [date, setDate] = useState(firstBookableDate)
  const [duration, setDuration] = useState(60)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [reviewSort, setReviewSort] = useState<"recent" | "helpful">("recent")
  const canReplyToReviews = isVenueStaff(user?.role)

  function toggleComments(reviewId: string) {
    setOpenComments((current) => {
      const next = new Set(current)
      if (next.has(reviewId)) next.delete(reviewId)
      else next.add(reviewId)
      return next
    })
  }

  const { data: court, isLoading: isLoadingCourt, isError } = useQuery({
    queryKey: ["court", id],
    queryFn: () => api.getCourt(id!),
    enabled: Boolean(id),
    retry: false,
  })
  const { data: availability, isLoading: isLoadingAvailability } = useQuery({
    queryKey: ["court-availability", id, date],
    queryFn: () => api.getCourtAvailability(id!, date),
    enabled: Boolean(id),
  })
  const { data: reviews, isLoading: isLoadingReviews } = useQuery({
    queryKey: ["court-reviews", id],
    queryFn: () => api.listCourtReviews(id!),
    enabled: Boolean(id),
  })
  const { data: blocks } = useQuery({
    queryKey: ["facility-blocks", id],
    queryFn: () => api.listFacilityBlocks(id),
    enabled: Boolean(id),
  })
  const now = useNow(60_000)
  const upcomingBlocks = (blocks ?? [])
    .filter((block) => new Date(block.end_time).getTime() > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 3)

  const { data: favorites } = useQuery({
    queryKey: ["favorites-mine"],
    queryFn: () => api.listMyFavorites(token!),
    enabled: Boolean(token),
  })
  const isFavorite = Boolean(favorites?.some((c) => c.id === id))

  const favoriteMutation = useMutation({
    mutationFn: () => (isFavorite ? api.removeFavorite(token!, id!) : api.addFavorite(token!, id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites-mine"] })
      toast.success(t(isFavorite ? "courts.favorite.removedToast" : "courts.favorite.addedToast", { court: court?.name ?? "" }))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.favoritesFailed")),
  })
  const helpfulMutation = useMutation({
    mutationFn: (reviewId: string) => api.toggleReviewHelpful(token!, reviewId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["court-reviews", id] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("courtDetail.reviews.helpfulError")),
  })
  const replyMutation = useMutation({
    mutationFn: ({ reviewId, reply }: { reviewId: string; reply: string }) => api.replyToReview(token!, reviewId, reply),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-reviews", id] })
      setReplyingTo(null)
      setReplyDraft("")
      toast.success(t("courtDetail.reviews.replyPosted"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("courtDetail.reviews.replyError")),
  })
  const deleteReplyMutation = useMutation({
    mutationFn: (reviewId: string) => api.deleteReviewReply(token!, reviewId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["court-reviews", id] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("courtDetail.reviews.replyError")),
  })

  function share() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: court?.name, url }).catch(() => undefined)
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success(t("courtDetail.linkCopied")))
    }
  }

  if (isError) {
    return (
      <PageContainer size="narrow" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <span className="font-mono text-sm text-muted-foreground">404</span>
        <h1 className="display text-[52px]">{t("courtDetail.notFound.title")}</h1>
        <p className="max-w-sm text-muted-foreground">{t("courtDetail.notFound.description")}</p>
        <Button asChild className="mt-2">
          <Link to="/courts">{t("courtDetail.notFound.browse")}</Link>
        </Button>
      </PageContainer>
    )
  }

  if (isLoadingCourt || !court) {
    return (
      <PageContainer size="wide">
        <Skeleton className="mb-6 h-4 w-28" />
        <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
          <div className="hidden flex-col gap-2 md:flex">
            <Skeleton className="flex-1 rounded-xl" />
            <Skeleton className="flex-1 rounded-xl" />
          </div>
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </PageContainer>
    )
  }

  const photos = [...(court.image_url ? [{ id: "cover", url: court.image_url }] : []), ...court.images]
  const sortedReviews = [...(reviews ?? [])].sort((a, b) =>
    reviewSort === "helpful" ? b.helpful_count - a.helpful_count : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return (
    <PageContainer size="wide">
      <Link to="/courts" className="mb-5 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft className="size-4" /> {t("courtDetail.backToCourts")}
      </Link>

      {/* Title row */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="display text-[52px] sm:text-[72px]">{court.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
            {court.review_count > 0 && court.average_rating !== null ? (
              <a href="#reviews" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
                <Star className="size-3.5 fill-star text-star" /> {court.average_rating.toFixed(1)}
                <span className="font-normal text-muted-foreground">({t("courtDetail.reviews.count", { count: court.review_count })})</span>
              </a>
            ) : (
              <span>{t("courts.noReviews")}</span>
            )}
            <span>·</span>
            <span>{sportLabels[court.sport_type]}</span>
            <span>·</span>
            <span>{court.indoor ? t("courts.indoor") : t("courts.outdoor")}</span>
            {court.requires_approval && (
              <Badge variant="info">
                <ShieldCheck /> {t("courts.requiresApproval")}
              </Badge>
            )}
            {!court.active && <Badge variant="warning">{t("admin.court.hidden")}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 /> {t("courtDetail.share")}
          </Button>
          {user && (
            <Button variant="outline" size="sm" isLoading={favoriteMutation.isPending} onClick={() => favoriteMutation.mutate()} aria-pressed={isFavorite}>
              {!favoriteMutation.isPending && <Heart className={cn(isFavorite && "fill-danger text-danger")} />}
              {isFavorite ? t("courtDetail.saved") : t("courtDetail.save")}
            </Button>
          )}
        </div>
      </div>

      {/* Gallery */}
      <div className={cn("grid gap-2", photos.length > 1 && "md:grid-cols-[2fr_1fr]")}>
        <button
          type="button"
          onClick={() => photos.length > 0 && setLightboxIndex(0)}
          disabled={photos.length === 0}
          className="group relative overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default"
        >
          <CourtArt sport={court.sport_type} indoor={court.indoor} imageUrl={court.image_url} loading="eager" className={cn("rounded-xl", court.image_url ? "aspect-[16/9] md:aspect-[16/10]" : "aspect-[16/9] md:aspect-[21/8]")} />
          {photos.length > 1 && (
            <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-sm bg-card px-2 py-1 text-xs font-medium md:hidden">
              <Images className="size-3.5" /> {photos.length}
            </span>
          )}
        </button>
        {photos.length > 1 && (
          <div className="hidden grid-rows-2 gap-2 md:grid">
            {photos.slice(1, 3).map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setLightboxIndex(index + 1)}
                className="group relative overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={t("courtDetail.gallery.viewPhoto")}
              >
                <img src={assetUrl(photo.url)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                {index === 1 && photos.length > 3 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-panel/55 text-[15px] font-semibold text-panel-foreground">
                    +{photos.length - 3}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-10">
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-[26px] leading-none font-extrabold uppercase">{t("courtDetail.about")}</h2>
            <p className="max-w-prose text-[15px] leading-relaxed text-foreground/85">{court.description ?? t("courtDetail.noDescription")}</p>
            <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
              {[
                { label: t("courtDetail.facts.sport"), value: sportLabels[court.sport_type] },
                { label: t("courtDetail.facts.surface"), value: court.indoor ? t("courts.indoor") : t("courts.outdoor") },
                {
                  label: t("courtDetail.facts.price"),
                  value: court.price_per_hour !== null ? `${formatCurrency(court.price_per_hour)}${t("courts.perHourSuffix")}` : t("courts.priceUnset"),
                },
                {
                  label: t("courtDetail.facts.hours"),
                  value: availability ? (availability.closed ? t("courtDetail.closedThatDay") : fmt.timeRange(availability.opens_at, availability.closes_at)) : "—",
                },
              ].map((fact) => (
                <div key={fact.label} className="flex flex-col gap-1 bg-card p-3.5">
                  <dt className="eyebrow text-[10px]">{fact.label}</dt>
                  <dd className="text-[13px] font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {court.amenities.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-[26px] leading-none font-extrabold uppercase">{t("courtDetail.amenities")}</h2>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {court.amenities.map((amenity) => {
                  const Icon = AMENITY_ICON[amenity]
                  return (
                    <li key={amenity} className="flex items-center gap-2.5 text-[14px]">
                      <span className="flex size-8 items-center justify-center rounded-md border border-border bg-card shadow-xs">
                        <Icon className="size-4" />
                      </span>
                      {amenityLabels[amenity]}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {upcomingBlocks.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-soft/60 p-4">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-warning">
                <AlertTriangle className="size-4" /> {t("courtDetail.notices.title")}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {upcomingBlocks.map((block) => (
                  <li key={block.id} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                    <span className="font-mono font-medium tabular">{fmt.dateRange(block.start_time, block.end_time)}</span>
                    <span className="text-muted-foreground">{block.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section id="reviews" className="flex scroll-mt-20 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-[26px] leading-none font-extrabold uppercase">{t("courtDetail.reviews.title")}</h2>
              {(reviews?.length ?? 0) > 1 && (
                <Tabs value={reviewSort} onValueChange={(value) => setReviewSort(value as "recent" | "helpful")} className="gap-0">
                  <TabsList>
                    <TabsTrigger value="recent">{t("courtDetail.reviews.sortRecent")}</TabsTrigger>
                    <TabsTrigger value="helpful">{t("courtDetail.reviews.sortHelpful")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
            {isLoadingReviews && <Skeleton className="h-36 w-full" />}
            {reviews && reviews.length > 0 && <RatingSummary reviews={reviews} average={court.average_rating} count={court.review_count} />}
            {!isLoadingReviews && reviews?.length === 0 && (
              <EmptyState size="compact" icon={Star} title={t("courtDetail.reviews.empty")} description={t("courtDetail.reviews.emptyHint")} />
            )}
            <div className="flex flex-col divide-y divide-border">
              {sortedReviews.map((review) => (
                <article key={review.id} className="flex gap-3.5 py-5 first:pt-1">
                  <UserAvatar name={review.user.name} avatarUrl={review.user.avatar_url} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link to={`/app/players/${review.user.id}`} className="text-[14px] font-semibold hover:underline">
                        {review.user.name}
                      </Link>
                      <StarRating value={review.rating} />
                      <span className="font-mono text-[11px] text-subtle-foreground">{fmt.dateMedium(review.created_at)}</span>
                    </div>
                    {review.comment && <p className="text-[14px] leading-relaxed text-foreground/90">{review.comment}</p>}
                    {review.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {review.images.map((image) => (
                          <a
                            key={image.id}
                            href={assetUrl(image.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="size-20 shrink-0 overflow-hidden rounded-md border border-border transition-opacity hover:opacity-90"
                          >
                            <img src={assetUrl(image.url)} alt="" loading="lazy" className="size-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {user && (
                        <Button
                          size="xs"
                          variant={review.voted_helpful_by_me ? "secondary" : "ghost"}
                          disabled={helpfulMutation.isPending}
                          onClick={() => helpfulMutation.mutate(review.id)}
                          aria-pressed={review.voted_helpful_by_me}
                        >
                          <ThumbsUp className={cn(review.voted_helpful_by_me && "fill-current")} />
                          {review.helpful_count > 0
                            ? t("courtDetail.reviews.helpfulCount", { count: review.helpful_count })
                            : t("courtDetail.reviews.helpful")}
                        </Button>
                      )}
                      {!user && review.helpful_count > 0 && (
                        <span className="px-2 text-xs text-muted-foreground">{t("courtDetail.reviews.helpfulCount", { count: review.helpful_count })}</span>
                      )}
                      <Button
                        size="xs"
                        variant={openComments.has(review.id) ? "secondary" : "ghost"}
                        onClick={() => toggleComments(review.id)}
                        aria-expanded={openComments.has(review.id)}
                      >
                        <MessageCircle />
                        {review.comment_count > 0
                          ? t("courtDetail.reviews.commentCount", { count: review.comment_count })
                          : t("courtDetail.reviews.comment")}
                      </Button>
                      {canReplyToReviews && !review.manager_reply && replyingTo !== review.id && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setReplyingTo(review.id)
                            setReplyDraft("")
                          }}
                        >
                          {t("courtDetail.reviews.reply")}
                        </Button>
                      )}
                    </div>

                    {review.manager_reply && (
                      <div className="mt-1 flex flex-col gap-1 rounded-lg border-l-2 border-brand bg-muted/60 px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold">
                            <ShieldCheck className="size-3.5" /> {t("courtDetail.reviews.venueReply")}
                            {review.manager_reply_at && (
                              <span className="font-mono font-normal text-subtle-foreground">· {fmt.dateMedium(review.manager_reply_at)}</span>
                            )}
                          </span>
                          {canReplyToReviews && (
                            <Button size="xs" variant="subtle" disabled={deleteReplyMutation.isPending} onClick={() => deleteReplyMutation.mutate(review.id)}>
                              {t("common.remove")}
                            </Button>
                          )}
                        </div>
                        <p className="text-[13px] leading-relaxed text-foreground/90">{review.manager_reply}</p>
                      </div>
                    )}

                    {openComments.has(review.id) && <ReviewCommentThread reviewId={review.id} courtId={id!} />}

                    {replyingTo === review.id && (
                      <div className="mt-1 flex animate-fade-in flex-col gap-2">
                        <Textarea
                          value={replyDraft}
                          onChange={(event) => setReplyDraft(event.target.value)}
                          placeholder={t("courtDetail.reviews.replyPlaceholder")}
                          maxLength={1000}
                          className="min-h-16"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={replyDraft.trim().length === 0}
                            isLoading={replyMutation.isPending}
                            onClick={() => replyMutation.mutate({ reviewId: review.id, reply: replyDraft.trim() })}
                          >
                            {t("courtDetail.reviews.replySubmit")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        {/* Booking widget */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-md">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-muted-foreground">
                {court.price_per_hour !== null ? (
                  <>
                    <span className="font-display text-[34px] leading-none font-extrabold text-foreground tabular">{formatCurrency(court.price_per_hour)}</span>
                    {t("courts.perHourSuffix")}
                  </>
                ) : (
                  t("courts.priceUnset")
                )}
              </span>
              {court.review_count > 0 && court.average_rating !== null && (
                <span className="inline-flex items-center gap-1 text-xs">
                  <Star className="size-3.5 fill-star text-star" /> <span className="font-semibold tabular">{court.average_rating.toFixed(1)}</span>
                </span>
              )}
            </div>

            <DayStrip value={date} onChange={setDate} />

            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium">{t("book.duration")}</span>
              <Tabs value={String(duration)} onValueChange={(value) => setDuration(Number(value))} className="gap-0">
                <TabsList>
                  {[60, 90, 120].map((option) => (
                    <TabsTrigger key={option} value={String(option)}>
                      {fmt.duration(option)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {isLoadingAvailability && <Skeleton className="h-48 w-full" />}
            {availability && (
              <>
                <OccupancyTimeline
                  opensAt={availability.opens_at}
                  closesAt={availability.closes_at}
                  busy={availability.busy}
                  compact
                  pick={
                    court.active
                      ? { durationMinutes: duration, onSelect: (slot) => navigate(user ? bookingHref(court.id, slot.start) : "/register") }
                      : undefined
                  }
                />
                {court.active ? (
                  <SlotGrid
                    availability={availability}
                    durationMinutes={duration}
                    onSelect={(slot) => navigate(user ? bookingHref(court.id, slot.start) : "/register")}
                  />
                ) : (
                  <p className="rounded-lg bg-muted p-3 text-[13px] text-muted-foreground">{t("courtDetail.inactive")}</p>
                )}
              </>
            )}

            <Button variant="brand" size="lg" className="w-full" asChild>
              <Link to={user ? bookingHref(court.id) : "/register"}>{user ? t("courtDetail.bookButton") : t("courtDetail.signUpToBook")}</Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t("courtDetail.bookHint")}</p>
          </div>
        </aside>
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && setLightboxIndex(null)}>
        <DialogContent
          className="max-w-4xl gap-3 p-3 sm:max-w-4xl sm:p-3"
          onKeyDown={(event) => {
            if (lightboxIndex === null) return
            if (event.key === "ArrowRight") setLightboxIndex((lightboxIndex + 1) % photos.length)
            if (event.key === "ArrowLeft") setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length)
          }}
        >
          <DialogTitle className="sr-only">{court.name}</DialogTitle>
          <DialogDescription className="sr-only">{t("courtDetail.gallery.viewPhoto")}</DialogDescription>
          {lightboxIndex !== null && photos[lightboxIndex] && (
            <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-muted">
              <img key={photos[lightboxIndex].id} src={assetUrl(photos[lightboxIndex].url)} alt="" className="max-h-[75vh] w-full animate-fade-in object-contain" />
              {photos.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="outline"
                    className="absolute left-3 rounded-full"
                    onClick={() => setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length)}
                    aria-label={t("courtDetail.gallery.previous")}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="absolute right-3 rounded-full"
                    onClick={() => setLightboxIndex((lightboxIndex + 1) % photos.length)}
                    aria-label={t("courtDetail.gallery.next")}
                  >
                    <ChevronRight />
                  </Button>
                </>
              )}
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setLightboxIndex(index)}
                className={cn(
                  "size-14 shrink-0 overflow-hidden rounded-md border-2 transition-[border-color,opacity]",
                  index === lightboxIndex ? "border-foreground" : "border-transparent opacity-60 hover:opacity-100",
                )}
                aria-label={t("courtDetail.gallery.viewPhoto")}
              >
                <img src={assetUrl(photo.url)} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
            <span className="ml-auto self-center pr-1 font-mono text-xs text-muted-foreground tabular">
              {(lightboxIndex ?? 0) + 1} / {photos.length}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

export { CourtDetailPage }
