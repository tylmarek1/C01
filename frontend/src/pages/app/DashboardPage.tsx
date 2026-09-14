import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, CalendarPlus, CheckCircle2, Clock3, ListChecks } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shared/dialog"
import { ReservationCard } from "@/components/shared/reservation-card"
import { SectionHeader } from "@/components/shared/section-header"
import { Skeleton } from "@/components/shared/skeleton"
import { StatTile } from "@/components/shared/stat-tile"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatDateRange } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import type { Reservation } from "@/types"

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Reservation created",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Hold expired",
  NO_SHOW: "Marked as no-show",
  TIME_CHANGED: "Rescheduled",
}

function DashboardPage() {
  const { user, token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [historyReservation, setHistoryReservation] = useState<Reservation | null>(null)

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

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["reservation-history", historyReservation?.id],
    queryFn: () => api.getReservationHistory(token!, historyReservation!.id),
    enabled: Boolean(token && historyReservation),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reservations"] })
    queryClient.invalidateQueries({ queryKey: ["waitlist-mine"] })
  }

  const inviteGuestMutation = useMutation({
    mutationFn: ({ reservation, email }: { reservation: Reservation; email: string }) =>
      api.inviteGuest(token!, reservation.id, email),
    onSuccess: () => toast.success("Invite sent"),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not send the invite"),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ reservation, rating, comment }: { reservation: Reservation; rating: number; comment: string }) =>
      api.createReview(token!, reservation.id, rating, comment || undefined),
    onSuccess: () => {
      toast.success("Thanks for the review!")
      queryClient.invalidateQueries({ queryKey: ["reviews-mine"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not submit your review"),
  })

  const confirmMutation = useMutation({
    mutationFn: (reservation: Reservation) => api.confirmReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success("Reservation confirmed")
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not confirm reservation"),
  })

  const cancelMutation = useMutation({
    mutationFn: (reservation: Reservation) => api.cancelReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success("Reservation cancelled")
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not cancel reservation"),
  })

  const checkInMutation = useMutation({
    mutationFn: (reservation: Reservation) => api.checkInReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success("Checked in — have a great game")
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not check in"),
  })

  const rescheduleMutation = useMutation({
    mutationFn: ({ reservation, startTime, endTime }: { reservation: Reservation; startTime: string; endTime: string }) =>
      api.rescheduleReservation(token!, reservation.id, startTime, endTime),
    onSuccess: () => {
      toast.success("Reservation moved")
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not reschedule"),
  })

  const acceptWaitlistMutation = useMutation({
    mutationFn: (entryId: string) => api.acceptWaitlistOffer(token!, entryId),
    onSuccess: () => {
      toast.success("Booked from the waitlist")
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not accept the offer"),
  })

  const cancelWaitlistMutation = useMutation({
    mutationFn: (entryId: string) => api.cancelWaitlistEntry(token!, entryId),
    onSuccess: () => {
      toast.success("Left the waitlist")
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not leave the waitlist"),
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
                  {entry.status === "OFFERED" ? "Offered to you!" : "Waiting"}
                </Badge>
                {entry.status === "OFFERED" && (
                  <Button size="sm" onClick={() => acceptWaitlistMutation.mutate(entry.id)}>
                    Book it
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => cancelWaitlistMutation.mutate(entry.id)}>
                  Leave
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 flex flex-col gap-4">
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
            onViewHistory={setHistoryReservation}
            onInviteGuest={(reservation, email) => inviteGuestMutation.mutate({ reservation, email })}
            hasReview={reviewedReservationIds.has(reservation.id)}
            onSubmitReview={(reservation, rating, comment) => reviewMutation.mutate({ reservation, rating, comment })}
          />
        ))}
      </div>

      {sharedWithMe && sharedWithMe.length > 0 && (
        <div className="mt-10 flex flex-col gap-3">
          <span className="text-sm font-semibold text-ink-navy">Shared with you</span>
          {sharedWithMe.map((reservation) => (
            <div
              key={reservation.id}
              className="flex flex-col gap-2 rounded-2xl border border-dashed border-hairline bg-cloud p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-ink-navy">{reservation.court.name}</span>
                <span className="text-sm text-slate-gray">{formatDateRange(reservation.start_time, reservation.end_time)}</span>
              </div>
              <Badge variant="secondary">{reservation.status}</Badge>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(historyReservation)} onOpenChange={(open) => !open && setHistoryReservation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{historyReservation?.court.name} history</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {isLoadingHistory && <Skeleton className="h-24 w-full" />}
            {history?.map((event) => (
              <div key={event.id} className="flex items-start gap-3 border-b border-hairline pb-3 last:border-b-0">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-signal-blue" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink-navy">
                    {EVENT_LABEL[event.event_type] ?? event.event_type}
                  </span>
                  <span className="text-xs text-slate-gray">{new Date(event.created_at).toLocaleString()}</span>
                  {event.note && <span className="text-xs text-slate-gray">{event.note}</span>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { DashboardPage }
