import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, CalendarPlus, CheckCircle2, Clock3, LayoutGrid, ListChecks, Rows3 } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { ReservationCard } from "@/components/shared/reservation-card"
import { ReservationDetailDialog } from "@/components/shared/reservation-detail-dialog"
import { SectionHeader } from "@/components/shared/section-header"
import { Skeleton } from "@/components/shared/skeleton"
import { StatTile } from "@/components/shared/stat-tile"
import { WeekCalendar } from "@/components/shared/week-calendar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatDateRange } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { STATUS_VARIANT, useStatusLabels } from "@/lib/reservation-status"
import { cn } from "@/lib/utils"
import type { Reservation } from "@/types"

type ViewMode = "list" | "calendar"

function DashboardPage() {
  const { user, token } = useAuth()
  const { t } = useTranslation()
  const statusLabels = useStatusLabels()
  const queryClient = useQueryClient()
  const [detailReservation, setDetailReservation] = useState<Reservation | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  const { data: reservations, isLoading } = useQuery({
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reservations"] })
    queryClient.invalidateQueries({ queryKey: ["waitlist-mine"] })
  }

  const inviteGuestMutation = useMutation({
    mutationFn: ({ reservation, email }: { reservation: Reservation; email: string }) =>
      api.inviteGuest(token!, reservation.id, email),
    onSuccess: () => toast.success(t("dashboard.toast.inviteSent")),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.invite")),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ reservation, rating, comment }: { reservation: Reservation; rating: number; comment: string }) =>
      api.createReview(token!, reservation.id, rating, comment || undefined),
    onSuccess: () => {
      toast.success(t("dashboard.toast.reviewSubmitted"))
      queryClient.invalidateQueries({ queryKey: ["reviews-mine"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.review")),
  })

  const confirmMutation = useMutation({
    mutationFn: (reservation: Reservation) => api.confirmReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success(t("dashboard.toast.confirmed"))
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.confirm")),
  })

  const cancelMutation = useMutation({
    mutationFn: (reservation: Reservation) => api.cancelReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success(t("dashboard.toast.cancelled"))
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
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.waitlistLeave")),
  })

  const confirmedCount = reservations?.filter((r) => r.status === "CONFIRMED").length ?? 0
  const pendingCount = reservations?.filter((r) => r.status === "PENDING").length ?? 0
  const completedCount = reservations?.filter((r) => r.status === "COMPLETED").length ?? 0
  const isBusy = confirmMutation.isPending || cancelMutation.isPending || checkInMutation.isPending || rescheduleMutation.isPending

  const activeWaitlist = waitlist?.filter((entry) => entry.status === "WAITING" || entry.status === "OFFERED") ?? []

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
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

      <div className="mt-10 grid gap-4 sm:grid-cols-4">
        <StatTile icon={CalendarClock} label={t("dashboard.stat.total")} value={reservations?.length ?? 0} />
        <StatTile icon={CheckCircle2} label={t("dashboard.stat.confirmed")} value={confirmedCount} />
        <StatTile icon={Clock3} label={t("dashboard.stat.held")} value={pendingCount} />
        <StatTile icon={ListChecks} label={t("dashboard.stat.completed")} value={completedCount} />
      </div>

      {activeWaitlist.length > 0 && (
        <div className="mt-10 flex flex-col gap-3">
          <span className="text-sm font-semibold text-ink-navy">{t("dashboard.waitlist.title")}</span>
          {activeWaitlist.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-2xl border border-hairline bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-ink-navy">{entry.court.name}</span>
                <span className="text-sm text-slate-gray">{formatDateRange(entry.start_time, entry.end_time)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge variant={entry.status === "OFFERED" ? "success" : "secondary"}>
                  {entry.status === "OFFERED" ? t("waitlist.offered") : t("waitlist.waiting")}
                </Badge>
                {entry.status === "OFFERED" && (
                  <Button size="sm" onClick={() => acceptWaitlistMutation.mutate(entry.id)}>
                    {t("waitlist.bookIt")}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => cancelWaitlistMutation.mutate(entry.id)}>
                  {t("waitlist.leave")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 flex items-center justify-end gap-1 rounded-xl border border-hairline bg-card p-1 shadow-sm w-fit ml-auto">
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
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
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            viewMode === "calendar" ? "bg-ink-navy text-paper" : "text-slate-gray hover:text-ink-navy",
          )}
        >
          <LayoutGrid className="size-3.5" />
          {t("calendar.view.week")}
        </button>
      </div>

      {viewMode === "calendar" ? (
        <div className="mt-4">
          <WeekCalendar reservations={reservations ?? []} onSelectReservation={setDetailReservation} />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}

          {!isLoading && reservations?.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline py-16 text-center">
              <p className="font-medium text-ink-navy">{t("dashboard.empty.title")}</p>
              <p className="max-w-xs text-sm text-slate-gray">{t("dashboard.empty.description")}</p>
              <Button asChild size="sm" className="mt-2">
                <Link to="/app/book">{t("nav.book")}</Link>
              </Button>
            </div>
          )}

          {reservations?.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              isBusy={isBusy}
              onConfirm={(r) => confirmMutation.mutate(r)}
              onCancel={(r) => cancelMutation.mutate(r)}
              onCheckIn={(r) => checkInMutation.mutate(r)}
              onReschedule={(reservation, startTime, endTime) => rescheduleMutation.mutate({ reservation, startTime, endTime })}
              onOpenDetail={setDetailReservation}
              onInviteGuest={(reservation, email) => inviteGuestMutation.mutate({ reservation, email })}
              hasReview={reviewedReservationIds.has(reservation.id)}
              onSubmitReview={(reservation, rating, comment) => reviewMutation.mutate({ reservation, rating, comment })}
            />
          ))}
        </div>
      )}

      {sharedWithMe && sharedWithMe.length > 0 && (
        <div className="mt-10 flex flex-col gap-3">
          <span className="text-sm font-semibold text-ink-navy">{t("dashboard.sharedWithYou")}</span>
          {sharedWithMe.map((reservation) => (
            <button
              key={reservation.id}
              type="button"
              onClick={() => setDetailReservation(reservation)}
              className="flex flex-col gap-2 rounded-2xl border border-dashed border-hairline bg-cloud p-4 text-left transition-colors hover:border-slate-gray/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-ink-navy">{reservation.court.name}</span>
                <span className="text-sm text-slate-gray">{formatDateRange(reservation.start_time, reservation.end_time)}</span>
              </div>
              <Badge variant={STATUS_VARIANT[reservation.status]}>{statusLabels[reservation.status]}</Badge>
            </button>
          ))}
        </div>
      )}

      <ReservationDetailDialog reservation={detailReservation} onClose={() => setDetailReservation(null)} />
    </div>
  )
}

export { DashboardPage }
