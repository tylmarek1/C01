import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, CalendarClock, Heart, MapPin, ThumbsUp } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/shared/avatar"
import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/card"
import { CourtArt } from "@/components/shared/court-art"
import { Input } from "@/components/shared/input"
import { Label } from "@/components/shared/label"
import { OccupancyTimeline } from "@/components/shared/occupancy-timeline"
import { Skeleton } from "@/components/shared/skeleton"
import { useSportLabels } from "@/components/shared/sport-icon"
import { StarRating } from "@/components/shared/star-rating"
import { Textarea } from "@/components/shared/textarea"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAmenityLabels } from "@/lib/amenities"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency, formatDateRange, todayDateString } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function CourtDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const amenityLabels = useAmenityLabels()
  const [date, setDate] = useState(todayDateString())
  const [activePhoto, setActivePhoto] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const canReplyToReviews = user?.role === "VENUE_MANAGER" || user?.role === "ADMIN"

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
  const upcomingBlock = blocks?.find((block) => new Date(block.end_time).getTime() > Date.now())

  const { data: favorites } = useQuery({
    queryKey: ["favorites-mine"],
    queryFn: () => api.listMyFavorites(token!),
    enabled: Boolean(token),
  })
  const isFavorite = Boolean(favorites?.some((c) => c.id === id))

  const favoriteMutation = useMutation({
    mutationFn: () => (isFavorite ? api.removeFavorite(token!, id!) : api.addFavorite(token!, id!)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites-mine"] }),
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
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("courtDetail.reviews.replyError")),
  })

  const deleteReplyMutation = useMutation({
    mutationFn: (reviewId: string) => api.deleteReviewReply(token!, reviewId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["court-reviews", id] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("courtDetail.reviews.replyError")),
  })

  function handleBook() {
    navigate(user ? `/app/book?court=${id}` : "/register")
  }

  if (isError) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-sm font-semibold text-signal-blue">404</span>
        <h1 className="text-3xl font-bold text-ink-navy">{t("courtDetail.notFound.title")}</h1>
        <p className="text-slate-gray">{t("courtDetail.notFound.description")}</p>
        <Button asChild className="mt-2">
          <Link to="/courts">{t("courtDetail.notFound.browse")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <Link
        to="/courts"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-gray transition-colors hover:text-ink-navy"
      >
        <ArrowLeft className="size-4" /> {t("courtDetail.backToCourts")}
      </Link>
      {isLoadingCourt || !court ? (
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <div className="relative">
              <CourtArt
                sport={court.sport_type}
                indoor={court.indoor}
                imageUrl={activePhoto ?? court.image_url}
                className="aspect-[16/11]"
                loading="eager"
              />
              {user && (
                <button
                  type="button"
                  onClick={() => favoriteMutation.mutate()}
                  className="absolute top-4 left-4 flex size-10 items-center justify-center rounded-full bg-paper/90 text-ink-navy shadow-sm backdrop-blur-sm transition-transform hover:scale-105"
                  aria-label={isFavorite ? t("courts.favorite.remove") : t("courts.favorite.add")}
                >
                  <Heart className={isFavorite ? "size-5 fill-red-500 text-red-500" : "size-5"} />
                </button>
              )}
            </div>
            {court.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  ...(court.image_url ? [{ id: "cover", url: court.image_url }] : []),
                  ...court.images,
                ].map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setActivePhoto(photo.url)}
                    aria-label={t("courtDetail.gallery.viewPhoto")}
                    className={cn(
                      "size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                      (activePhoto ?? court.image_url) === photo.url ? "border-signal-blue" : "border-transparent",
                    )}
                  >
                    <img src={assetUrl(photo.url)} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-ink-navy">{court.name}</h1>
                <Badge>{sportLabels[court.sport_type]}</Badge>
                <Badge variant="secondary">{court.indoor ? t("courts.indoor") : t("courts.outdoor")}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {court.review_count > 0 && (
                  <div className="flex items-center gap-2">
                    <StarRating value={court.average_rating ?? 0} size="md" />
                    <span className="text-sm font-medium text-ink-navy">{court.average_rating?.toFixed(1)}</span>
                    <span className="text-sm text-slate-gray">
                      ({t("courtDetail.reviews.count", { count: court.review_count })})
                    </span>
                  </div>
                )}
                {court.price_per_hour !== null && (
                  <span className="text-sm font-semibold text-signal-blue">
                    {t("courts.pricePerHour", { price: formatCurrency(court.price_per_hour) })}
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-slate-gray">
                <MapPin className="size-4" /> {t("courtDetail.venueName")}
              </p>
              <p className="max-w-lg text-base text-slate-gray">{court.description ?? t("courtDetail.noDescription")}</p>
              {court.amenities.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {court.amenities.map((amenity) => (
                    <Badge key={amenity} variant="secondary">
                      {amenityLabels[amenity]}
                    </Badge>
                  ))}
                </div>
              )}
              {upcomingBlock && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {t("courtDetail.facilityBlock", {
                      range: formatDateRange(upcomingBlock.start_time, upcomingBlock.end_time),
                      reason: upcomingBlock.reason,
                    })}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 border-t border-hairline pt-6">
              <span className="text-sm font-semibold text-ink-navy">{t("courtDetail.reviews.title")}</span>
              {isLoadingReviews && <Skeleton className="h-16 w-full" />}
              {!isLoadingReviews && reviews?.length === 0 && (
                <p className="text-sm text-slate-gray">{t("courtDetail.reviews.empty")}</p>
              )}
              {reviews?.map((review) => (
                <div key={review.id} className="flex gap-3 border-b border-hairline pb-4 last:border-b-0">
                  <Avatar className="size-9">
                    <AvatarFallback>{initials(review.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/app/players/${review.user.id}`} className="text-sm font-medium text-ink-navy hover:underline">
                        {review.user.name}
                      </Link>
                      <StarRating value={review.rating} />
                    </div>
                    {review.comment && <p className="text-sm text-slate-gray">{review.comment}</p>}
                    {review.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {review.images.map((image) => (
                          <div key={image.id} className="size-14 shrink-0 overflow-hidden rounded-lg border border-hairline">
                            <img src={assetUrl(image.url)} alt="" loading="lazy" className="size-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-mist-gray">{new Date(review.created_at).toLocaleDateString()}</span>
                      {user && (
                        <button
                          type="button"
                          disabled={helpfulMutation.isPending}
                          onClick={() => helpfulMutation.mutate(review.id)}
                          className={cn(
                            "flex items-center gap-1 text-xs font-medium transition-colors",
                            review.voted_helpful_by_me ? "text-signal-blue" : "text-slate-gray hover:text-ink-navy",
                          )}
                        >
                          <ThumbsUp className={cn("size-3.5", review.voted_helpful_by_me && "fill-signal-blue")} />
                          {review.helpful_count > 0
                            ? t("courtDetail.reviews.helpfulCount", { count: review.helpful_count })
                            : t("courtDetail.reviews.helpful")}
                        </button>
                      )}
                      {canReplyToReviews && !review.manager_reply && replyingTo !== review.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(review.id)
                            setReplyDraft("")
                          }}
                          className="text-xs font-medium text-slate-gray transition-colors hover:text-ink-navy"
                        >
                          {t("courtDetail.reviews.reply")}
                        </button>
                      )}
                    </div>

                    {review.manager_reply && (
                      <div className="mt-1 flex flex-col gap-1 rounded-xl bg-cloud/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink-navy">{t("courtDetail.reviews.venueReply")}</span>
                          {canReplyToReviews && (
                            <button
                              type="button"
                              disabled={deleteReplyMutation.isPending}
                              onClick={() => deleteReplyMutation.mutate(review.id)}
                              className="text-xs text-slate-gray transition-colors hover:text-ink-navy"
                            >
                              {t("common.remove")}
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-slate-gray">{review.manager_reply}</p>
                      </div>
                    )}

                    {replyingTo === review.id && (
                      <div className="mt-1 flex flex-col gap-2">
                        <Textarea
                          value={replyDraft}
                          onChange={(event) => setReplyDraft(event.target.value)}
                          placeholder={t("courtDetail.reviews.replyPlaceholder")}
                          maxLength={1000}
                          className="min-h-16"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={replyMutation.isPending || replyDraft.trim().length === 0}
                            onClick={() => replyMutation.mutate({ reviewId: review.id, reply: replyDraft.trim() })}
                          >
                            {t("courtDetail.reviews.replySubmit")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Card className="h-fit gap-5 lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-5 text-signal-blue" /> {t("courtDetail.occupancy.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="availability-date">{t("courtDetail.occupancy.checkDate")}</Label>
                <Input
                  id="availability-date"
                  type="date"
                  min={todayDateString()}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>

              {isLoadingAvailability && <Skeleton className="h-16 w-full" />}
              {availability && (
                <OccupancyTimeline opensAt={availability.opens_at} closesAt={availability.closes_at} busy={availability.busy} />
              )}

              <Button size="lg" className="w-full" onClick={handleBook}>
                {t("courtDetail.bookButton")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export { CourtDetailPage }
