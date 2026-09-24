import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Award,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  ListChecks,
  Newspaper,
  Rows3,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { ActivityFeedItem } from "@/components/shared/activity-feed-item"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataRow, DataRowButton } from "@/components/shared/data-row"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { ReservationCard } from "@/components/shared/reservation-card"
import { ReservationDetailDialog } from "@/components/shared/reservation-detail-dialog"
import { SectionHeader } from "@/components/shared/section-header"
import { Skeleton } from "@/components/ui/skeleton"
import { StatTile } from "@/components/shared/stat-tile"
import { SubsectionHeading } from "@/components/shared/subsection-heading"
import { Textarea } from "@/components/ui/textarea"
import { WeekCalendar } from "@/components/shared/week-calendar"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatDateRange } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { compressImageFile } from "@/lib/image"
import { STATUS_VARIANT, useStatusLabels } from "@/lib/reservation-status"
import { cn } from "@/lib/utils"
import type { OpenGame, PlayerSearchResult, Reservation } from "@/types"

type ViewMode = "list" | "calendar" | "open" | "feed"
const ACTIVITY_FEED_PAGE_SIZE = 30

function DashboardPage() {
  const { user, token } = useAuth()
  const { t } = useTranslation()
  const statusLabels = useStatusLabels()
  const queryClient = useQueryClient()
  const [detailReservation, setDetailReservation] = useState<Reservation | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [feedLimit, setFeedLimit] = useState(ACTIVITY_FEED_PAGE_SIZE)

  const {
    data: reservations,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["reservations"],
    queryFn: () => api.listReservations(token!),
    enabled: Boolean(token),
  })

  const { data: waitlist } = useQuery({
    queryKey: ["waitlist-mine"],
    queryFn: () => api.listMyWaitlist(token!),
    enabled: Boolean(token),
  })

  const { data: myReviews } = useQuery({
    queryKey: ["reviews-mine"],
    queryFn: () => api.listMyReviews(token!),
    enabled: Boolean(token),
  })
  const reviewedReservationIds = new Set(myReviews?.map((r) => r.reservation_id) ?? [])

  const { data: sharedWithMe } = useQuery({
    queryKey: ["shared-with-me"],
    queryFn: () => api.listSharedWithMe(token!),
    enabled: Boolean(token),
  })

  const { data: myStats } = useQuery({
    queryKey: ["stats-me"],
    queryFn: () => api.getMyStats(token!),
    enabled: Boolean(token),
  })

  const canManageVenue = user?.role === "VENUE_MANAGER" || user?.role === "ADMIN"
  const { data: venueStats, isLoading: isLoadingVenueStats } = useQuery({
    queryKey: ["admin-stats-snapshot"],
    queryFn: () => api.getAdminStats(token!, 7),
    enabled: Boolean(token) && canManageVenue,
  })
  const pendingApprovalCount = venueStats?.status_breakdown["PENDING_APPROVAL"] ?? 0

  const { data: openGames } = useQuery({
    queryKey: ["reservations-open"],
    queryFn: () => api.listOpenGames(token!),
    enabled: Boolean(token) && viewMode === "open",
  })

  const {
    data: activityFeed,
    isLoading: isLoadingFeed,
    isError: isFeedError,
    refetch: refetchFeed,
  } = useQuery({
    queryKey: ["activity-feed", feedLimit],
    queryFn: () => api.getActivityFeed(token!, feedLimit),
    enabled: Boolean(token) && viewMode === "feed",
  })

  const { data: myJoinRequests } = useQuery({
    queryKey: ["join-requests-mine"],
    queryFn: () => api.listMyJoinRequests(token!),
    enabled: Boolean(token),
  })

  const { data: teammates } = useQuery({
    queryKey: ["frequent-teammates"],
    queryFn: () => api.listFrequentTeammates(token!, 5),
    enabled: Boolean(token),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reservations"] })
    queryClient.invalidateQueries({ queryKey: ["waitlist-mine"] })
  }

  const inviteGuestMutation = useMutation({
    mutationFn: ({ reservation, player }: { reservation: Reservation; player: PlayerSearchResult }) =>
      api.inviteGuest(token!, reservation.id, { userId: player.id }),
    onSuccess: () => toast.success(t("dashboard.toast.inviteSent")),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.invite")),
  })

  const reviewMutation = useMutation({
    mutationFn: async ({
      reservation,
      rating,
      comment,
      photos,
    }: {
      reservation: Reservation
      rating: number
      comment: string
      photos: File[]
    }) => {
      const review = await api.createReview(token!, reservation.id, rating, comment || undefined)
      // One at a time, not Promise.all — matches the existing add-photo-to-an-
      // existing-review flow (ProfilePage's ReviewsTab) rather than hammering
      // the upload endpoint with concurrent requests for the same review.
      for (const photo of photos) {
        await api.addReviewImage(token!, review.id, await compressImageFile(photo, 1200, 0.85))
      }
    },
    onSuccess: () => {
      toast.success(t("dashboard.toast.reviewSubmitted"))
      queryClient.invalidateQueries({ queryKey: ["reviews-mine"] })
      queryClient.invalidateQueries({ queryKey: ["court-reviews"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.review")),
  })

  const confirmMutation = useMutation({
    mutationFn: (reservation: Reservation) => api.confirmReservation(token!, reservation.id),
    onSuccess: (confirmed) => {
      toast.success(t(confirmed.status === "PENDING_APPROVAL" ? "dashboard.toast.submitted" : "dashboard.toast.confirmed"))
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.confirm")),
  })

  const cancelMutation = useMutation({
    mutationFn: (reservation: Reservation) => api.cancelReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success(t("dashboard.toast.cancelled"))
      setCancelTarget(null)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.cancel")),
  })

  const checkInMutation = useMutation({
    mutationFn: (reservation: Reservation) => api.checkInReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success(t("dashboard.toast.checkedIn"))
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.checkIn")),
  })

  const rescheduleMutation = useMutation({
    mutationFn: ({ reservation, startTime, endTime }: { reservation: Reservation; startTime: string; endTime: string }) =>
      api.rescheduleReservation(token!, reservation.id, startTime, endTime),
    onSuccess: () => {
      toast.success(t("dashboard.toast.rescheduled"))
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.reschedule")),
  })

  const acceptWaitlistMutation = useMutation({
    mutationFn: (entryId: string) => api.acceptWaitlistOffer(token!, entryId),
    onSuccess: () => {
      toast.success(t("dashboard.toast.waitlistBooked"))
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.waitlistAccept")),
  })

  const cancelWaitlistMutation = useMutation({
    mutationFn: (entryId: string) => api.cancelWaitlistEntry(token!, entryId),
    onSuccess: () => {
      toast.success(t("dashboard.toast.waitlistLeft"))
      setLeaveWaitlistTarget(null)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.waitlistLeave")),
  })

  const setOpenMutation = useMutation({
    mutationFn: ({ reservation, openToJoin, note }: { reservation: Reservation; openToJoin: boolean; note: string }) =>
      api.setReservationOpen(token!, reservation.id, { open_to_join: openToJoin, open_note: note || undefined }),
    onSuccess: () => {
      toast.success(t("dashboard.toast.openUpdated"))
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.openUpdate")),
  })

  const requestToJoinMutation = useMutation({
    mutationFn: ({ game, note }: { game: OpenGame; note: string }) => api.requestToJoin(token!, game.id, note || undefined),
    onSuccess: () => {
      toast.success(t("dashboard.toast.joinRequestSent"))
      queryClient.invalidateQueries({ queryKey: ["join-requests-mine"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.joinRequest")),
  })
  const [joinTarget, setJoinTarget] = useState<OpenGame | null>(null)
  const [joinNote, setJoinNote] = useState("")
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)
  const [leaveWaitlistTarget, setLeaveWaitlistTarget] = useState<string | null>(null)

  const confirmedCount = reservations?.filter((r) => r.status === "CONFIRMED").length ?? 0
  const pendingCount = reservations?.filter((r) => r.status === "PENDING").length ?? 0
  const completedCount = reservations?.filter((r) => r.status === "COMPLETED").length ?? 0
  const isBusy = confirmMutation.isPending || cancelMutation.isPending || checkInMutation.isPending || rescheduleMutation.isPending

  const activeWaitlist = waitlist?.filter((entry) => entry.status === "WAITING" || entry.status === "OFFERED") ?? []

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeader
        align="left"
        title={t("dashboard.welcome", { name: user?.name.split(" ")[0] ?? "" })}
        description={t("dashboard.subtitle")}
        action={
          <Button asChild className="mt-2 w-fit">
            <Link to="/app/book">
              <CalendarPlus className="size-4" />
              {t("nav.book")}
            </Link>
          </Button>
        }
      />

      {canManageVenue && (
        <div className="mt-10 flex flex-col gap-4 rounded-3xl border border-hairline bg-cloud px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="w-fit rounded-full bg-tint-blue px-2.5 py-1 text-xs font-medium text-deep-cobalt">
                {t("dashboard.venueSnapshot.eyebrow")}
              </span>
              <h2 className="text-xl font-bold text-ink-navy">{t("dashboard.venueSnapshot.title")}</h2>
              <p className="max-w-lg text-sm text-slate-gray">{t("dashboard.venueSnapshot.description")}</p>
            </div>
            <Button variant="dark" className="shrink-0" asChild>
              <Link to="/app/admin">
                <ShieldCheck className="size-4" />
                {t("dashboard.venueSnapshot.openAdmin")}
              </Link>
            </Button>
          </div>

          {isLoadingVenueStats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          )}

          {venueStats && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile icon={Clock3} label={statusLabels.PENDING_APPROVAL} value={pendingApprovalCount} />
                <StatTile
                  icon={CalendarClock}
                  label={t("admin.overview.reservationsInWindow", { days: 7 })}
                  value={venueStats.reservations_in_window}
                />
                <StatTile icon={LayoutGrid} label={t("admin.overview.courts")} value={venueStats.total_courts} />
                <StatTile
                  icon={AlertTriangle}
                  label={t("admin.overview.noShowRate")}
                  value={`${Math.round(venueStats.no_show_rate * 100)}%`}
                />
              </div>

              {pendingApprovalCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" />
                    {t("dashboard.venueSnapshot.pendingBanner", { count: pendingApprovalCount })}
                  </span>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/app/admin?tab=reservations&status=PENDING_APPROVAL">
                      {t("dashboard.venueSnapshot.reviewRequests")}
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={CalendarClock} label={t("dashboard.stat.total")} value={reservations?.length ?? 0} />
        <StatTile icon={CheckCircle2} label={t("dashboard.stat.confirmed")} value={confirmedCount} />
        <StatTile icon={Clock3} label={t("dashboard.stat.held")} value={pendingCount} />
        <StatTile icon={ListChecks} label={t("dashboard.stat.completed")} value={completedCount} />
        <StatTile
          icon={Award}
          label={t("dashboard.stat.achievements")}
          value={myStats ? `${myStats.achievements_unlocked}/${myStats.achievements_total}` : "–"}
        />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-6">

      {isError && (
        <ErrorState
          title={t("common.error.title")}
          description={t("common.error.description")}
          onRetry={() => refetch()}
        />
      )}

      <div className="ml-auto w-fit max-w-full overflow-x-auto rounded-xl border border-hairline bg-card p-1 shadow-sm">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              viewMode === "list" ? "bg-ink-navy text-paper" : "text-slate-gray hover:text-ink-navy",
            )}
          >
            <Rows3 className="size-3.5" />
            {t("calendar.view.list")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              viewMode === "calendar" ? "bg-ink-navy text-paper" : "text-slate-gray hover:text-ink-navy",
            )}
          >
            <LayoutGrid className="size-3.5" />
            {t("calendar.view.week")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("open")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              viewMode === "open" ? "bg-ink-navy text-paper" : "text-slate-gray hover:text-ink-navy",
            )}
          >
            <Sparkles className="size-3.5" />
            {t("dashboard.view.open")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("feed")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              viewMode === "feed" ? "bg-ink-navy text-paper" : "text-slate-gray hover:text-ink-navy",
            )}
          >
            <Newspaper className="size-3.5" />
            {t("dashboard.view.feed")}
          </button>
        </div>
      </div>

      {viewMode === "calendar" && (
        <div>
          <WeekCalendar reservations={reservations ?? []} onSelectReservation={setDetailReservation} />
        </div>
      )}

      {viewMode === "list" && (
        <div className="flex flex-col gap-4">
          {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}

          {!isLoading && reservations?.length === 0 && (
            <EmptyState
              title={t("dashboard.empty.title")}
              description={t("dashboard.empty.description")}
              action={
                <Button asChild size="sm" className="mt-2">
                  <Link to="/app/book">{t("nav.book")}</Link>
                </Button>
              }
            />
          )}

          {reservations?.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              isBusy={isBusy}
              onConfirm={(r) => confirmMutation.mutate(r)}
              onCancel={(r) => setCancelTarget(r)}
              onCheckIn={(r) => checkInMutation.mutate(r)}
              onReschedule={(reservation, startTime, endTime) => rescheduleMutation.mutate({ reservation, startTime, endTime })}
              onOpenDetail={setDetailReservation}
              onInviteGuest={(reservation, player) => inviteGuestMutation.mutate({ reservation, player })}
              onSetOpen={(reservation, openToJoin, note) => setOpenMutation.mutate({ reservation, openToJoin, note })}
              isSettingOpen={setOpenMutation.isPending}
              hasReview={reviewedReservationIds.has(reservation.id)}
              onSubmitReview={(reservation, rating, comment, photos) =>
                reviewMutation.mutate({ reservation, rating, comment, photos })
              }
            />
          ))}
        </div>
      )}

      {viewMode === "open" && (
        <div className="flex flex-col gap-4">
          {!openGames && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}

          {openGames?.length === 0 && (
            <EmptyState title={t("dashboard.openGames.empty.title")} description={t("dashboard.openGames.empty.description")} />
          )}

          {openGames?.map((game) => {
            const alreadyRequested = myJoinRequests?.some((request) => request.reservation_id === game.id)
            return (
              <DataRow key={game.id} className="p-5">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink-navy">{game.court.name}</span>
                  <span className="text-sm text-slate-gray">{formatDateRange(game.start_time, game.end_time)}</span>
                  <span className="text-xs text-slate-gray">{t("dashboard.openGames.hostedBy", { name: game.user.name })}</span>
                  {game.open_note && <span className="text-xs text-slate-gray">{game.open_note}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{t("dashboard.openGames.spotsLeft", { count: game.spots_left })}</Badge>
                  <Button
                    size="sm"
                    disabled={alreadyRequested}
                    onClick={() => {
                      setJoinTarget(game)
                      setJoinNote("")
                    }}
                  >
                    {alreadyRequested ? t("joinRequestStatus.PENDING") : t("dashboard.openGames.request")}
                  </Button>
                </div>
              </DataRow>
            )
          })}
        </div>
      )}

      {viewMode === "feed" && (
        <div className="flex flex-col gap-3">
          {isLoadingFeed && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}

          {isFeedError && (
            <ErrorState
              title={t("common.error.title")}
              description={t("common.error.description")}
              onRetry={() => refetchFeed()}
            />
          )}

          {!isLoadingFeed && !isFeedError && activityFeed?.length === 0 && (
            <EmptyState title={t("dashboard.feed.empty.title")} description={t("dashboard.feed.empty.description")} />
          )}

          {activityFeed?.map((event) => <ActivityFeedItem key={event.id} event={event} />)}

          {activityFeed && activityFeed.length > 0 && activityFeed.length >= feedLimit && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setFeedLimit((current) => current + ACTIVITY_FEED_PAGE_SIZE)}
            >
              {t("common.loadMore")}
            </Button>
          )}
        </div>
      )}

      </div>

      <div className="flex min-w-0 flex-col gap-10">
        {teammates && teammates.length > 0 && (
          <div className="flex flex-col gap-3">
            <SubsectionHeading title={t("dashboard.teammates.title")} />
            <div className="flex flex-wrap gap-3">
              {teammates.map((teammate) => (
                <Link
                  key={teammate.user.id}
                  to={`/app/players/${teammate.user.id}`}
                  className="flex items-center gap-2.5 rounded-2xl border border-hairline bg-card px-3 py-2 shadow-card transition-colors hover:bg-pebble"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={assetUrl(teammate.user.avatar_url)} alt={teammate.user.name} loading="lazy" className="object-cover" />
                    <AvatarFallback className="text-xs">
                      {teammate.user.name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink-navy">{teammate.user.name}</span>
                    <span className="text-xs text-slate-gray">{t("dashboard.teammates.gamesTogether", { count: teammate.games_together })}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeWaitlist.length > 0 && (
          <div className="flex flex-col gap-3">
            <SubsectionHeading title={t("dashboard.waitlist.title")} />
            <div className="flex flex-col gap-3">
              {activeWaitlist.map((entry) => (
                <DataRow key={entry.id}>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-ink-navy">{entry.court.name}</span>
                    <span className="text-sm text-slate-gray">{formatDateRange(entry.start_time, entry.end_time)}</span>
                    {entry.status === "OFFERED" && entry.offer_expires_at && (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        {t("reservationCard.holdExpires", {
                          time: new Date(entry.offer_expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge variant={entry.status === "OFFERED" ? "success" : "secondary"}>
                      {entry.status === "OFFERED" ? t("waitlist.offered") : t("waitlist.waiting")}
                    </Badge>
                    {entry.status === "OFFERED" && (
                      <Button size="sm" onClick={() => acceptWaitlistMutation.mutate(entry.id)}>
                        {t("waitlist.bookIt")}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setLeaveWaitlistTarget(entry.id)}>
                      {t("waitlist.leave")}
                    </Button>
                  </div>
                </DataRow>
              ))}
            </div>
          </div>
        )}

      {myJoinRequests && myJoinRequests.length > 0 && (
        <div className="flex flex-col gap-3">
          <SubsectionHeading title={t("dashboard.myJoinRequests.title")} />
          {myJoinRequests.map((request) => (
            <DataRow key={request.id}>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-ink-navy">{request.user.name}</span>
                {request.note && <span className="text-sm text-slate-gray">{request.note}</span>}
              </div>
              <Badge
                variant={
                  request.status === "ACCEPTED" ? "success" : request.status === "DECLINED" ? "destructive" : "secondary"
                }
              >
                {t(`joinRequestStatus.${request.status}` as TranslationKey)}
              </Badge>
            </DataRow>
          ))}
        </div>
      )}

      <Dialog open={Boolean(joinTarget)} onOpenChange={(open) => !open && setJoinTarget(null)}>
        <DialogContent>
          {joinTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{t("dashboard.joinRequest.dialog.title")}</DialogTitle>
                <DialogDescription>
                  {t("dashboard.joinRequest.dialog.description", { name: joinTarget.user.name, court: joinTarget.court.name })}
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={joinNote}
                onChange={(event) => setJoinNote(event.target.value)}
                placeholder={t("dashboard.joinRequest.notePlaceholder")}
                maxLength={200}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setJoinTarget(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  disabled={requestToJoinMutation.isPending}
                  onClick={() => {
                    requestToJoinMutation.mutate({ game: joinTarget, note: joinNote.trim() })
                    setJoinTarget(null)
                  }}
                >
                  {t("dashboard.joinRequest.send")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {sharedWithMe && sharedWithMe.length > 0 && (
        <div className="flex flex-col gap-3">
          <SubsectionHeading title={t("dashboard.sharedWithYou")} />
          {sharedWithMe.map((reservation) => (
            <DataRowButton key={reservation.id} variant="dashed" onClick={() => setDetailReservation(reservation)}>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-ink-navy">{reservation.court.name}</span>
                <span className="text-sm text-slate-gray">{formatDateRange(reservation.start_time, reservation.end_time)}</span>
              </div>
              <Badge variant={STATUS_VARIANT[reservation.status]}>{statusLabels[reservation.status]}</Badge>
            </DataRowButton>
          ))}
        </div>
      )}

      </div>
      </div>

      <ReservationDetailDialog reservation={detailReservation} onClose={() => setDetailReservation(null)} />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title={t("confirmDialog.cancelReservation.title")}
        description={t("confirmDialog.cancelReservation.description")}
        confirmLabel={t("confirmDialog.cancelReservation.confirm")}
        isLoading={cancelMutation.isPending}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget)}
      />

      <ConfirmDialog
        open={Boolean(leaveWaitlistTarget)}
        onOpenChange={(open) => !open && setLeaveWaitlistTarget(null)}
        title={t("confirmDialog.cancelWaitlist.title")}
        description={t("confirmDialog.cancelWaitlist.description")}
        confirmLabel={t("waitlist.leave")}
        isLoading={cancelWaitlistMutation.isPending}
        onConfirm={() => leaveWaitlistTarget && cancelWaitlistMutation.mutate(leaveWaitlistTarget)}
      />
    </div>
  )
}

export { DashboardPage }
