import { CalendarClock, Clock3, Star, UserPlus } from "lucide-react"
import { useState } from "react"

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
import { SportIcon } from "@/components/shared/sport-icon"
import { StarRatingInput } from "@/components/shared/star-rating"
import { Textarea } from "@/components/shared/textarea"
import { formatDateRange } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { STATUS_VARIANT, useStatusLabels } from "@/lib/reservation-status"
import type { Reservation } from "@/types"

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })

interface ReservationCardProps {
  reservation: Reservation
  onConfirm?: (reservation: Reservation) => void
  onCancel?: (reservation: Reservation) => void
  onCheckIn?: (reservation: Reservation) => void
  onReschedule?: (reservation: Reservation, startTime: string, endTime: string) => void
  onOpenDetail?: (reservation: Reservation) => void
  onInviteGuest?: (reservation: Reservation, email: string) => void
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
  hasReview = false,
  onSubmitReview,
  isBusy = false,
}: ReservationCardProps) {
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

  const canReschedule = (status === "PENDING" || status === "CONFIRMED") && Boolean(onReschedule)
  const canCancel = (status === "PENDING" || status === "CONFIRMED" || status === "CHECKED_IN") && Boolean(onCancel)
  const canInviteGuest =
    (status === "PENDING" || status === "CONFIRMED" || status === "CHECKED_IN") && Boolean(onInviteGuest)
  const canReview = status === "COMPLETED" && !hasReview && Boolean(onSubmitReview)

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
        </div>
      </button>

      <div className="flex flex-wrap items-center gap-2.5">
        <Badge variant={STATUS_VARIANT[status]}>{statusLabels[status]}</Badge>

        {status === "PENDING" && onConfirm && (
          <Button size="sm" disabled={isBusy} onClick={() => onConfirm(reservation)}>
            {t("reservationCard.confirm")}
          </Button>
        )}

        {status === "CONFIRMED" && onCheckIn && (
          <Button size="sm" variant="dark" disabled={isBusy} onClick={() => onCheckIn(reservation)}>
            {t("reservationCard.checkIn")}
          </Button>
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
