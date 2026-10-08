import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Clock3,
  Flame,
  History,
  Hourglass,
  LayoutGrid,
  ListChecks,
  LogIn,
  MapPinned,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ActivityFeedItem } from "@/components/shared/activity-feed-item"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Countdown } from "@/components/shared/countdown"
import { CourtArt } from "@/components/shared/court-art"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { ReservationCard } from "@/components/shared/reservation-card"
import { ReservationDetailDialog } from "@/components/shared/reservation-detail-dialog"
import { StatTile } from "@/components/shared/stat-tile"
import { StatusBadge } from "@/components/shared/status-badge"
import { SubsectionHeading } from "@/components/shared/subsection-heading"
import { UserAvatar } from "@/components/shared/user-avatar"
import { WeekCalendar } from "@/components/shared/week-calendar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { compressImageFile } from "@/lib/image"
import { useAdminStats, useMyReservations, isVenueStaff } from "@/lib/queries"
import { groupByDay, isUpcoming } from "@/lib/reservation-status"
import { cn, firstName } from "@/lib/utils"
import { useNow } from "@/lib/use-now"
import type { PlayerSearchResult, Reservation } from "@/types"

type View = "upcoming" | "history" | "calendar"
const HISTORY_PAGE = 10

function greetingKey(hour: number) {
  if (hour < 5) return "dashboard.greeting.night" as const
  if (hour < 12) return "dashboard.greeting.morning" as const
  if (hour < 18) return "dashboard.greeting.afternoon" as const
  return "dashboard.greeting.evening" as const
}

function SideCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("flex flex-col gap-3.5 border-t-2 border-foreground pt-3.5", className)}>{children}</section>
}

function NextUpCard({
  reservation,
  onOpenDetail,
  onCheckIn,
  isBusy,
}: {
  reservation: Reservation
  onOpenDetail: () => void
  onCheckIn: () => void
  isBusy: boolean
}) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const navigate = useNavigate()
  const { data: guests } = useQuery({
    queryKey: ["reservation-guests", reservation.id],
    queryFn: () => api.listGuests(token!, reservation.id),
    enabled: Boolean(token),
  })
  const chatMutation = useMutation({
    mutationFn: () => api.openReservationChat(token!, reservation.id),
    onSuccess: (conversation) => navigate(`/app/chat?conversation=${conversation.id}`),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("reservationDetail.error.chat")),
  })
  const now = useNow(30_000)
  const startsAt = new Date(reservation.start_time)
  const inProgress = startsAt.getTime() <= now
  const isToday = new Date().toDateString() === startsAt.toDateString()

  return (
    <article className="group relative grid animate-fade-up overflow-hidden rounded-md bg-panel text-panel-foreground sm:grid-cols-[minmax(0,17rem)_1fr]">
      <CourtArt
        sport={reservation.court.sport_type}
        imageUrl={reservation.court.image_url}
        indoor={reservation.court.indoor}
        className="aspect-[16/7] h-full rounded-none sm:aspect-auto sm:min-h-40"
      />
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 bg-brand px-2 py-1 font-mono text-[10.5px] leading-none font-semibold tracking-[0.1em] text-brand-foreground uppercase">
            <span className="size-1.5 animate-blink bg-brand-foreground" />
            {inProgress ? t("dashboard.nextUp.now") : t("dashboard.nextUp.eyebrow")}
          </span>
          <span className="font-mono text-[11px] tracking-[0.06em] text-panel-muted uppercase">
            {inProgress ? t("dashboard.nextUp.inProgress") : fmt.relativeTime(reservation.start_time)}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="display text-[40px] sm:text-[52px]">{reservation.court.name}</h2>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-[20px] font-semibold tabular">{fmt.timeRange(reservation.start_time, reservation.end_time)}</span>
            <span className="text-[14px] text-panel-muted">{fmt.dayLabel(reservation.start_time)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-panel-foreground/25 pt-3">
          {guests && guests.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {guests.slice(0, 4).map((guest) => (
                  <UserAvatar key={guest.id} name={guest.user.name} avatarUrl={guest.user.avatar_url} size="sm" className="ring-2 ring-panel" />
                ))}
              </div>
              <span className="text-xs text-panel-muted">{t("dashboard.nextUp.withGuests", { count: guests.length })}</span>
            </div>
          ) : (
            <span className="text-xs text-panel-muted">{t("dashboard.nextUp.solo")}</span>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          {reservation.status === "CONFIRMED" && isToday && (
            <Button size="sm" variant="brand" isLoading={isBusy} onClick={onCheckIn}>
              {!isBusy && <LogIn />} {t("reservationCard.checkIn")}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-panel-foreground/30 text-panel-foreground hover:border-panel-foreground hover:bg-panel-foreground/10"
            isLoading={chatMutation.isPending}
            onClick={() => chatMutation.mutate()}
          >
            {!chatMutation.isPending && <MessageCircle />} {t("reservationDetail.chat")}
          </Button>
          <Button size="sm" variant="ghost" className="text-panel-foreground hover:bg-panel-foreground/10" onClick={onOpenDetail}>
            {t("reservationCard.viewDetails")} <ArrowRight />
          </Button>
        </div>
      </div>
    </article>
  )
}

function DashboardPage() {
  const { user, token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (["upcoming", "history", "calendar"].includes(searchParams.get("view") ?? "") ? searchParams.get("view") : "upcoming") as View
  const [detailReservation, setDetailReservation] = useState<Reservation | null>(null)
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE)
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)
  const [leaveWaitlistTarget, setLeaveWaitlistTarget] = useState<string | null>(null)

  const { data: reservations, isLoading, isError, refetch } = useMyReservations()

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
  const { data: openGames } = useQuery({
    queryKey: ["reservations-open"],
    queryFn: () => api.listOpenGames(token!),
    enabled: Boolean(token),
  })
  const { data: activityFeed, isLoading: isLoadingFeed } = useQuery({
    queryKey: ["activity-feed", 6],
    queryFn: () => api.getActivityFeed(token!, 6),
    enabled: Boolean(token),
  })
  const { data: teammates } = useQuery({
    queryKey: ["frequent-teammates"],
    queryFn: () => api.listFrequentTeammates(token!, 5),
    enabled: Boolean(token),
  })

  const canManageVenue = isVenueStaff(user?.role)
  const { data: venueStats, isLoading: isLoadingVenueStats } = useAdminStats(30)
  const pendingApprovalCount = venueStats?.status_breakdown["PENDING_APPROVAL"] ?? 0

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reservations"] })
    queryClient.invalidateQueries({ queryKey: ["waitlist-mine"] })
    queryClient.invalidateQueries({ queryKey: ["stats-me"] })
  }

  const inviteGuestMutation = useMutation({
    mutationFn: ({ reservation, player }: { reservation: Reservation; player: PlayerSearchResult }) =>
      api.inviteGuest(token!, reservation.id, { userId: player.id }),
    onSuccess: (_guest, { reservation, player }) => {
      toast.success(t("dashboard.toast.inviteSentTo", { name: player.name }))
      queryClient.invalidateQueries({ queryKey: ["reservation-guests", reservation.id] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.invite")),
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ reservation, rating, comment, photos }: { reservation: Reservation; rating: number; comment: string; photos: File[] }) => {
      const review = await api.createReview(token!, reservation.id, rating, comment || undefined)
      // One at a time, not Promise.all — matches the add-photo-to-an-existing-
      // review flow rather than hammering the upload endpoint concurrently.
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
      queryClient.invalidateQueries({ queryKey: ["reservations-open"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.openUpdate")),
  })

  const isBusy = confirmMutation.isPending || cancelMutation.isPending || checkInMutation.isPending || rescheduleMutation.isPending
  const reviewedReservationIds = new Set(myReviews?.map((r) => r.reservation_id) ?? [])

  const now = useNow(60_000)
  const { upcoming, history, holds, nextUp, unrated } = useMemo(() => {
    const all = reservations ?? []
    const upcomingList = all
      .filter((r) => isUpcoming(r, now))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    const historyList = all
      .filter((r) => !isUpcoming(r, now))
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    return {
      upcoming: upcomingList,
      history: historyList,
      holds: upcomingList.filter((r) => r.status === "PENDING"),
      nextUp: upcomingList.find((r) => r.status === "CONFIRMED" || r.status === "CHECKED_IN"),
      unrated: historyList.filter((r) => r.status === "COMPLETED" && !reviewedReservationIds.has(r.id)),
    }
    // reviewedReservationIds is derived from myReviews
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, myReviews, now])

  const offers = waitlist?.filter((entry) => entry.status === "OFFERED") ?? []
  const waiting = waitlist?.filter((entry) => entry.status === "WAITING") ?? []
  const otherOpenGames = (openGames ?? []).filter((game) => game.user.id !== user?.id)
  const attentionCount = holds.length + offers.length + (unrated.length > 0 ? 1 : 0)

  function setView(next: View) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === "upcoming") params.delete("view")
        else params.set("view", next)
        return params
      },
      { replace: true },
    )
  }

  const cardHandlers = (reservation: Reservation) => ({
    reservation,
    isBusy,
    onConfirm: (r: Reservation) => confirmMutation.mutate(r),
    onCancel: (r: Reservation) => setCancelTarget(r),
    onCheckIn: (r: Reservation) => checkInMutation.mutate(r),
    onReschedule: (r: Reservation, startTime: string, endTime: string) => rescheduleMutation.mutate({ reservation: r, startTime, endTime }),
    onOpenDetail: setDetailReservation,
    onInviteGuest: (r: Reservation, player: PlayerSearchResult) => inviteGuestMutation.mutate({ reservation: r, player }),
    onSetOpen: (r: Reservation, openToJoin: boolean, note: string) => setOpenMutation.mutate({ reservation: r, openToJoin, note }),
    onHoldExpired: () => queryClient.invalidateQueries({ queryKey: ["reservations"] }),
    isSettingOpen: setOpenMutation.isPending,
    canPay: true,
    hasReview: reviewedReservationIds.has(reservation.id),
    onSubmitReview: (r: Reservation, rating: number, comment: string, photos: File[]) =>
      reviewMutation.mutate({ reservation: r, rating, comment, photos }),
  })

  const hour = new Date().getHours()

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow={fmt.dateLong(new Date())}
        title={t(greetingKey(hour), { name: firstName(user?.name) })}
        description={
          upcoming.length > 0 ? t("dashboard.subtitle.upcoming", { count: upcoming.length }) : t("dashboard.subtitle.empty")
        }
        actions={
          // The masthead already carries the brand "Book" CTA on desktop.
          <Button variant="brand" asChild className="lg:hidden">
            <Link to="/app/book">
              <CalendarPlus /> {t("nav.book")}
            </Link>
          </Button>
        }
      />

      {/* Needs attention — time-critical things first, each with its one action. */}
      {attentionCount > 0 && (
        <section aria-label={t("dashboard.attention.title")} className="mb-8 flex flex-col gap-3">
          <span className="eyebrow flex items-center gap-1.5 text-foreground">
            <AlertTriangle className="size-3.5 text-warning" /> {t("dashboard.attention.title")}
          </span>
          <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {holds.map((reservation, index) => (
              <div
                key={reservation.id}
                style={{ "--i": index } as React.CSSProperties}
                className="flex items-center gap-3 border-l-4 border-warning bg-warning-soft p-3.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center text-warning">
                  <Timer className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold">
                    {t("dashboard.attention.hold", { court: reservation.court.name })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmt.dayLabel(reservation.start_time)} · <span className="font-mono">{fmt.timeRange(reservation.start_time, reservation.end_time)}</span> ·{" "}
                    {reservation.hold_expires_at && (
                      <Countdown
                        to={reservation.hold_expires_at}
                        className="font-semibold text-warning"
                        onExpire={() => queryClient.invalidateQueries({ queryKey: ["reservations"] })}
                      />
                    )}
                  </span>
                </div>
                <Button size="sm" variant="brand" disabled={isBusy} onClick={() => confirmMutation.mutate(reservation)}>
                  {reservation.court.requires_approval ? t("reservationCard.requestApproval") : t("reservationCard.confirm")}
                </Button>
              </div>
            ))}
            {offers.map((entry, index) => (
              <div
                key={entry.id}
                style={{ "--i": holds.length + index } as React.CSSProperties}
                className="flex items-center gap-3 border-l-4 border-success bg-success-soft p-3.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center text-success">
                  <Sparkles className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold">{t("dashboard.attention.offer", { court: entry.court.name })}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmt.dayLabel(entry.start_time)} · <span className="font-mono">{fmt.timeRange(entry.start_time, entry.end_time)}</span>
                    {entry.offer_expires_at && (
                      <>
                        {" · "}
                        <Countdown to={entry.offer_expires_at} className="font-semibold text-success" />
                      </>
                    )}
                  </span>
                </div>
                <Button size="sm" variant="brand" isLoading={acceptWaitlistMutation.isPending} onClick={() => acceptWaitlistMutation.mutate(entry.id)}>
                  {t("waitlist.bookIt")}
                </Button>
              </div>
            ))}
            {unrated.length > 0 && (
              <div
                style={{ "--i": holds.length + offers.length } as React.CSSProperties}
                className="flex items-center gap-3 border-l-4 border-star bg-card p-3.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center text-star">
                  <Star className="size-4 fill-current" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold">{t("dashboard.attention.rate", { count: unrated.length })}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("dashboard.attention.rateHint", { court: unrated[0].court.name })}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setView("history")}>
                  {t("dashboard.attention.rateAction")}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {canManageVenue && (
        <section className="mb-8 flex flex-col gap-3">
          <SubsectionHeading
            title={t("dashboard.venueSnapshot.title")}
            description={t("dashboard.venueSnapshot.description")}
            action={
              <Button size="sm" variant="outline" asChild>
                <Link to="/app/admin">
                  <ShieldCheck /> {t("dashboard.venueSnapshot.openAdmin")}
                </Link>
              </Button>
            }
          />
          {isLoadingVenueStats ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-[104px]" />
              ))}
            </div>
          ) : (
            venueStats && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
                <StatTile
                  icon={Clock3}
                  label={t("status.PENDING_APPROVAL")}
                  value={pendingApprovalCount}
                  tone={pendingApprovalCount > 0 ? "attention" : "default"}
                  hint={pendingApprovalCount > 0 ? t("dashboard.venueSnapshot.reviewRequests") : t("dashboard.venueSnapshot.queueClear")}
                  to="/app/admin?tab=reservations&status=PENDING_APPROVAL"
                />
                <StatTile
                  icon={CalendarClock}
                  label={t("admin.overview.reservationsInWindow", { days: venueStats.window_days })}
                  value={fmt.number(venueStats.reservations_in_window)}
                />
                <StatTile icon={LayoutGrid} label={t("admin.overview.courts")} value={venueStats.total_courts} />
                <StatTile icon={AlertTriangle} label={t("admin.overview.noShowRate")} value={fmt.percent(venueStats.no_show_rate)} />
              </div>
            )
          )}
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-14">
        <div className="flex min-w-0 flex-col gap-8">
          {nextUp && view === "upcoming" && (
            <NextUpCard
              reservation={nextUp}
              onOpenDetail={() => setDetailReservation(nextUp)}
              onCheckIn={() => checkInMutation.mutate(nextUp)}
              isBusy={checkInMutation.isPending}
            />
          )}

          <Tabs value={view} onValueChange={(value) => setView(value as View)} className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-[26px] leading-none font-extrabold uppercase">{t("dashboard.reservations.title")}</h2>
              <TabsList>
                <TabsTrigger value="upcoming">
                  <CalendarDays /> {t("dashboard.view.upcoming")}
                  {upcoming.length > 0 && <span className="font-mono text-[10.5px] text-subtle-foreground tabular">{upcoming.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History /> {t("dashboard.view.history")}
                </TabsTrigger>
                <TabsTrigger value="calendar">
                  <LayoutGrid /> {t("calendar.view.week")}
                </TabsTrigger>
              </TabsList>
            </div>

            {isError && <ErrorState onRetry={() => refetch()} />}

            <TabsContent value="upcoming" className="flex flex-col gap-5">
              {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-[104px] w-full rounded-md" />)}
              {!isLoading && !isError && upcoming.length === 0 && (
                <EmptyState
                  icon={CalendarPlus}
                  title={t("dashboard.empty.title")}
                  description={t("dashboard.empty.description")}
                  action={
                    <>
                      <Button size="sm" asChild>
                        <Link to="/app/book">{t("nav.book")}</Link>
                      </Button>
                      {otherOpenGames.length > 0 && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/app/games">{t("dashboard.empty.joinGame")}</Link>
                        </Button>
                      )}
                    </>
                  }
                />
              )}
              {groupByDay(upcoming).map((group) => (
                <div key={group.key} className="flex flex-col gap-2">
                  <h3 className="eyebrow sticky top-14 z-10 -mx-1 border-b border-border bg-background px-1 py-1.5 text-foreground lg:top-16">
                    {fmt.dayLabel(group.date)}
                    {fmt.dayLabel(group.date) !== fmt.date(group.date) && <span className="ml-2 normal-case opacity-70">{fmt.date(group.date)}</span>}
                  </h3>
                  <div className="stagger flex flex-col gap-2">
                    {group.items.map((reservation, index) => (
                      <div key={reservation.id} style={{ "--i": index } as React.CSSProperties}>
                        <ReservationCard {...cardHandlers(reservation)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="history" className="flex flex-col gap-2">
              {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-[104px] w-full rounded-md" />)}
              {!isLoading && !isError && history.length === 0 && (
                <EmptyState icon={History} title={t("dashboard.history.empty.title")} description={t("dashboard.history.empty.description")} />
              )}
              <div className="stagger flex flex-col gap-2">
                {history.slice(0, historyLimit).map((reservation, index) => (
                  <div key={reservation.id} style={{ "--i": index } as React.CSSProperties}>
                    <ReservationCard {...cardHandlers(reservation)} />
                  </div>
                ))}
              </div>
              {history.length > historyLimit && (
                <Button variant="outline" size="sm" className="mt-2 w-fit self-center" onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE)}>
                  {t("common.showMoreCount", { count: history.length - historyLimit })}
                </Button>
              )}
            </TabsContent>

            <TabsContent value="calendar">
              <WeekCalendar reservations={reservations ?? []} onSelectReservation={setDetailReservation} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="flex min-w-0 flex-col gap-8">
          <SideCard>
            <SubsectionHeading
              title={t("dashboard.stats.title")}
              action={
                <Button size="xs" variant="ghost" asChild>
                  <Link to="/app/profile">
                    {t("dashboard.stats.profile")} <ArrowRight />
                  </Link>
                </Button>
              }
            />
            {!myStats ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
                  {[
                    { icon: Clock3, label: t("profile.stat.hoursPlayed"), value: fmt.number(myStats.hours_played) },
                    { icon: ListChecks, label: t("profile.stat.completed"), value: myStats.completed_reservations },
                    { icon: Flame, label: t("profile.stat.streak"), value: myStats.current_streak_weeks },
                    { icon: MapPinned, label: t("profile.stat.courtsPlayed"), value: myStats.distinct_courts_played },
                  ].map((stat) => (
                    <div key={stat.label} className="flex flex-col gap-1.5 bg-card p-3">
                      <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <stat.icon className="size-3.5" /> <span className="inline-block first-letter:uppercase">{stat.label}</span>
                      </span>
                      <span className="font-display text-[30px] leading-none font-extrabold tabular">{stat.value}</span>
                    </div>
                  ))}
                </div>
                <Link to="/app/profile?tab=achievements" className="group flex flex-col gap-2 rounded-xs p-1 transition-colors hover:bg-muted">
                  <span className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Award className="size-3.5" /> {t("profile.stat.achievements")}
                    </span>
                    <span className="font-mono text-muted-foreground tabular">
                      {myStats.achievements_unlocked}/{myStats.achievements_total}
                    </span>
                  </span>
                  <Progress
                    tone="brand"
                    value={myStats.achievements_total ? (myStats.achievements_unlocked / myStats.achievements_total) * 100 : 0}
                  />
                </Link>
              </>
            )}
          </SideCard>

          <SideCard>
            <SubsectionHeading
              title={t("dashboard.openGames.title")}
              count={otherOpenGames.length}
              action={
                <Button size="xs" variant="ghost" asChild>
                  <Link to="/app/games">
                    {t("common.viewAll")} <ArrowRight />
                  </Link>
                </Button>
              }
            />
            {!openGames && <Skeleton className="h-24" />}
            {openGames && otherOpenGames.length === 0 && (
              <p className="text-[13px] text-muted-foreground">{t("dashboard.openGames.empty.description")}</p>
            )}
            <div className="flex flex-col gap-1">
              {otherOpenGames.slice(0, 3).map((game) => (
                <Link
                  key={game.id}
                  to="/app/games"
                  className="flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-muted"
                >
                  <UserAvatar name={game.user.name} avatarUrl={game.user.avatar_url} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium">{game.court.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {fmt.dayLabel(game.start_time)} · <span className="font-mono">{fmt.time(game.start_time)}</span>
                    </span>
                  </div>
                  <Badge variant="brand">{t("dashboard.openGames.spotsLeft", { count: game.spots_left })}</Badge>
                </Link>
              ))}
            </div>
          </SideCard>

          {sharedWithMe && sharedWithMe.length > 0 && (
            <SideCard>
              <SubsectionHeading title={t("dashboard.sharedWithYou")} count={sharedWithMe.length} />
              <div className="flex flex-col gap-1">
                {sharedWithMe.map((reservation) => (
                  <button
                    key={reservation.id}
                    type="button"
                    onClick={() => setDetailReservation(reservation)}
                    className="flex items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium">{reservation.court.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {fmt.dayLabel(reservation.start_time)} · <span className="font-mono">{fmt.timeRange(reservation.start_time, reservation.end_time)}</span>
                      </span>
                    </div>
                    <StatusBadge status={reservation.status} />
                  </button>
                ))}
              </div>
            </SideCard>
          )}

          {waiting.length > 0 && (
            <SideCard>
              <SubsectionHeading title={t("dashboard.waitlist.title")} count={waiting.length} />
              <div className="flex flex-col gap-2">
                {waiting.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3">
                    <Hourglass className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium">{entry.court.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {fmt.dayLabel(entry.start_time)} · <span className="font-mono">{fmt.timeRange(entry.start_time, entry.end_time)}</span>
                      </span>
                    </div>
                    <Button size="xs" variant="ghost" onClick={() => setLeaveWaitlistTarget(entry.id)}>
                      {t("waitlist.leave")}
                    </Button>
                  </div>
                ))}
              </div>
            </SideCard>
          )}

          {teammates && teammates.length > 0 && (
            <SideCard>
              <SubsectionHeading title={t("dashboard.teammates.title")} />
              <div className="flex flex-col gap-1">
                {teammates.map((teammate) => (
                  <Link
                    key={teammate.user.id}
                    to={`/app/players/${teammate.user.id}`}
                    className="flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-muted"
                  >
                    <UserAvatar name={teammate.user.name} avatarUrl={teammate.user.avatar_url} size="sm" />
                    <span className="flex-1 truncate text-[13px] font-medium">{teammate.user.name}</span>
                    <span className="font-mono text-xs text-muted-foreground tabular">
                      {t("dashboard.teammates.gamesTogether", { count: teammate.games_together })}
                    </span>
                  </Link>
                ))}
              </div>
            </SideCard>
          )}

          <SideCard>
            <SubsectionHeading
              title={t("dashboard.feed.title")}
              action={
                <Button size="xs" variant="ghost" asChild>
                  <Link to="/app/players">
                    {t("common.viewAll")} <ArrowRight />
                  </Link>
                </Button>
              }
            />
            {isLoadingFeed && <Skeleton className="h-28" />}
            {activityFeed?.length === 0 && <p className="text-[13px] text-muted-foreground">{t("dashboard.feed.empty.description")}</p>}
            <div className="flex flex-col gap-3.5">
              {activityFeed?.map((event) => <ActivityFeedItem key={event.id} event={event} dense />)}
            </div>
          </SideCard>
        </aside>
      </div>

      <ReservationDetailDialog reservation={detailReservation} onClose={() => setDetailReservation(null)} />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title={t("confirmDialog.cancelReservation.title")}
        description={
          cancelTarget
            ? t("confirmDialog.cancelReservation.descriptionWith", {
                court: cancelTarget.court.name,
                when: fmt.dateRange(cancelTarget.start_time, cancelTarget.end_time),
              })
            : undefined
        }
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
    </PageContainer>
  )
}

export { DashboardPage }
