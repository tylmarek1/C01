import { useMutation, useQuery } from "@tanstack/react-query"
import { CalendarClock, CalendarPlus, Clock3, Coins, Star, UserPlus, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shared/dialog"
import { Input } from "@/components/shared/input"
import { Label } from "@/components/shared/label"
import { Skeleton } from "@/components/shared/skeleton"
import { SportIcon } from "@/components/shared/sport-icon"
import { StarRatingInput } from "@/components/shared/star-rating"
import { Switch } from "@/components/shared/switch"
import { Textarea } from "@/components/shared/textarea"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency, formatDateRange } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { STATUS_VARIANT, useStatusLabels } from "@/lib/reservation-status"
import type { Reservation } from "@/types"

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })

function SplitCostDialog({ reservation }: { reservation: Reservation }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["reservation-split", reservation.id],
    queryFn: () => api.splitReservationCost(token!, reservation.id),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Coins className="size-3.5" /> {t("reservationCard.split.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("split.dialog.title")}</DialogTitle>
          {data && (
            <DialogDescription>
              {t("split.dialog.description", { court: reservation.court.name, hours: data.duration_hours })}
            </DialogDescription>
          )}
        </DialogHeader>
        {isLoading && <Skeleton className="h-32 w-full" />}
        {data && data.total_cost === null && <p className="text-sm text-slate-gray">{t("split.noPrice")}</p>}
        {data && data.total_cost !== null && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
              <span className="text-sm font-medium text-ink-navy">{t("split.total")}</span>
              <span className="text-sm font-semibold text-ink-navy">{formatCurrency(data.total_cost)}</span>
            </div>
            <div className="flex flex-col gap-2">
              {data.participants.map((participant) => (
                <div key={participant.user.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                  <span className="text-sm text-ink-navy">{participant.user.name}</span>
                  <span className="text-sm text-slate-gray">
                    {formatCurrency(participant.share)} <span className="text-xs">{t("split.perPerson")}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OpenToJoinDialog({
  reservation,
  onSave,
  isSaving,
}: {
  reservation: Reservation
  onSave: (openToJoin: boolean, note: string) => void
  isSaving: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(reservation.open_to_join)
  const [note, setNote] = useState(reservation.open_note ?? "")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setEnabled(reservation.open_to_join)
          setNote(reservation.open_note ?? "")
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant={reservation.open_to_join ? "dark" : "outline"}>
          <Users className="size-3.5" /> {t("reservationCard.openToJoin.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reservationCard.openToJoin.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink-navy">{t("reservationCard.openToJoin.label")}</span>
            <span className="text-xs text-slate-gray">{t("reservationCard.openToJoin.description")}</span>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        {enabled && (
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("reservationCard.openToJoin.notePlaceholder")}
            maxLength={200}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => {
              onSave(enabled, note.trim())
              setOpen(false)
            }}
          >
            {t("reservationCard.openToJoin.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ReservationCardProps {
  reservation: Reservation
  onConfirm?: (reservation: Reservation) => void
  onCancel?: (reservation: Reservation) => void
  onCheckIn?: (reservation: Reservation) => void
  onReschedule?: (reservation: Reservation, startTime: string, endTime: string) => void
  onOpenDetail?: (reservation: Reservation) => void
  onInviteGuest?: (reservation: Reservation, email: string) => void
  onSetOpen?: (reservation: Reservation, openToJoin: boolean, note: string) => void
  isSettingOpen?: boolean
  hasReview?: boolean
  onSubmitReview?: (reservation: Reservation, rating: number, comment: string) => void
  isBusy?: boolean
}

function ReservationCard({
  reservation,
  onConfirm,
  onCancel,
  onCheckIn,
  onReschedule,
  onOpenDetail,
  onInviteGuest,
  onSetOpen,
  isSettingOpen = false,
  hasReview = false,
  onSubmitReview,
  isBusy = false,
}: ReservationCardProps) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const statusLabels = useStatusLabels()
  const { court, status } = reservation
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [guestOpen, setGuestOpen] = useState(false)
  const [guestEmail, setGuestEmail] = useState("")
  const [reviewOpen, setReviewOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const start = new Date(reservation.start_time)
  const end = new Date(reservation.end_time)
  const durationMs = end.getTime() - start.getTime()
  const [date, setDate] = useState(() => start.toISOString().slice(0, 10))
  const [time, setTime] = useState(() => start.toTimeString().slice(0, 5))

  const icsMutation = useMutation({
    mutationFn: () => api.downloadReservationIcs(token!, reservation.id, `${court.name}.ics`),
    onSuccess: () => toast.success(t("reservationCard.toast.icsDownloaded")),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("reservationCard.error.icsDownload")),
  })

  // BR-11: an approved booking on an approval-required court can't be moved without a new request.
  const canReschedule =
    (status === "PENDING" || (status === "CONFIRMED" && !court.requires_approval)) && Boolean(onReschedule)
  // Mirrors BR-03: only a pending/confirmed reservation that has not started yet can be cancelled.
  const canCancel =
    (status === "PENDING" || status === "PENDING_APPROVAL" || status === "CONFIRMED") &&
    start.getTime() > new Date().getTime() &&
    Boolean(onCancel)
  const canInviteGuest =
    (status === "PENDING" || status === "CONFIRMED" || status === "CHECKED_IN") && Boolean(onInviteGuest)
  const canReview = status === "COMPLETED" && !hasReview && Boolean(onSubmitReview)
  const canOpenToJoin = status === "CONFIRMED" && Boolean(onSetOpen)
  const canSplit = status !== "CANCELLED" && status !== "EXPIRED" && status !== "REJECTED"

  function submitReschedule() {
    const newStart = new Date(`${date}T${time}:00`)
    const newEnd = new Date(newStart.getTime() + durationMs)
    onReschedule?.(reservation, newStart.toISOString(), newEnd.toISOString())
    setRescheduleOpen(false)
  }

  function submitGuest() {
    if (!guestEmail.trim()) return
    onInviteGuest?.(reservation, guestEmail.trim())
    setGuestEmail("")
    setGuestOpen(false)
  }

  function submitReview() {
    onSubmitReview?.(reservation, rating, comment.trim())
    setReviewOpen(false)
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        disabled={!onOpenDetail}
        onClick={() => onOpenDetail?.(reservation)}
        className={onOpenDetail ? "flex items-center gap-4 text-left" : "flex cursor-default items-center gap-4 text-left"}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-pebble text-ink-navy">
          <SportIcon sport={court.sport_type} className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <span className={onOpenDetail ? "font-semibold text-ink-navy hover:underline" : "font-semibold text-ink-navy"}>
            {court.name}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-slate-gray">
            <CalendarClock className="size-3.5" />
            {formatDateRange(reservation.start_time, reservation.end_time)}
          </span>
          {status === "PENDING" && reservation.hold_expires_at && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <Clock3 className="size-3.5" />
              {t("reservationCard.holdExpires", { time: timeFormatter.format(new Date(reservation.hold_expires_at)) })}
            </span>
          )}
          {status === "PENDING_APPROVAL" && reservation.approval_expires_at && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <Clock3 className="size-3.5" />
              {t("reservationCard.approvalExpires", {
                time: new Date(reservation.approval_expires_at).toLocaleString([], {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-wrap items-center gap-2.5">
        <Badge variant={STATUS_VARIANT[status]}>{statusLabels[status]}</Badge>

        {status === "PENDING" && onConfirm && (
          <Button size="sm" disabled={isBusy} onClick={() => onConfirm(reservation)}>
            {court.requires_approval ? t("reservationCard.requestApproval") : t("reservationCard.confirm")}
          </Button>
        )}

        {status === "CONFIRMED" && onCheckIn && (
          <Button size="sm" variant="dark" disabled={isBusy} onClick={() => onCheckIn(reservation)}>
            {t("reservationCard.checkIn")}
          </Button>
        )}

        {(status === "CONFIRMED" || status === "CHECKED_IN" || status === "COMPLETED") && (
          <Button size="sm" variant="outline" disabled={icsMutation.isPending} onClick={() => icsMutation.mutate()}>
            <CalendarPlus className="size-3.5" /> {t("reservationCard.calendar.button")}
          </Button>
        )}

        {canSplit && <SplitCostDialog reservation={reservation} />}

        {canOpenToJoin && (
          <OpenToJoinDialog
            reservation={reservation}
            isSaving={isSettingOpen}
            onSave={(openToJoin, note) => onSetOpen?.(reservation, openToJoin, note)}
          />
        )}

        {canInviteGuest && (
          <Dialog open={guestOpen} onOpenChange={setGuestOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={isBusy}>
                <UserPlus className="size-3.5" /> {t("reservationCard.invite")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("reservationCard.guest.title")}</DialogTitle>
                <DialogDescription>{t("reservationCard.guest.description", { court: court.name })}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`guest-email-${reservation.id}`}>{t("reservationCard.guest.email")}</Label>
                <Input
                  id={`guest-email-${reservation.id}`}
                  type="email"
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                  placeholder="teammate@example.com"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGuestOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={submitGuest} disabled={!guestEmail.trim()}>
                  {t("reservationCard.guest.send")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {canReview && (
          <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={isBusy}>
                <Star className="size-3.5" /> {t("reservationCard.rateIt")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("reservationCard.review.title", { court: court.name })}</DialogTitle>
                <DialogDescription>{t("reservationCard.review.description")}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <StarRatingInput value={rating} onChange={setRating} />
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={t("reservationCard.review.commentPlaceholder")}
                  maxLength={1000}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={submitReview}>{t("reservationCard.review.submit")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {canReschedule && (
          <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={isBusy}>
                {t("reservationCard.reschedule")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("reservationCard.reschedule.title")}</DialogTitle>
                <DialogDescription>{t("reservationCard.reschedule.description", { court: court.name })}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`reschedule-date-${reservation.id}`}>{t("reservationCard.reschedule.date")}</Label>
                  <Input
                    id={`reschedule-date-${reservation.id}`}
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`reschedule-time-${reservation.id}`}>{t("reservationCard.reschedule.startTime")}</Label>
                  <Input
                    id={`reschedule-time-${reservation.id}`}
                    type="time"
                    step={1800}
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRescheduleOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={submitReschedule}>{t("reservationCard.reschedule.save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {canCancel && (
          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onCancel?.(reservation)}>
            {t("reservationCard.cancel")}
          </Button>
        )}
      </div>
    </div>
  )
}

export { ReservationCard }
