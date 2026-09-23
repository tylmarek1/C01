import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, CalendarPlus, Clock3, Coins, MoreHorizontal, Plus, Repeat, Star, Trophy, UserPlus, Users, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlayerSearch } from "@/components/shared/player-search"
import { Skeleton } from "@/components/ui/skeleton"
import { SportIcon } from "@/components/shared/sport-icon"
import { StarRatingInput } from "@/components/shared/star-rating"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency, formatDateRange } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { STATUS_VARIANT, useStatusLabels } from "@/lib/reservation-status"
import type { PlayerSearchResult, Reservation } from "@/types"

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })
// Mirrors the backend's MAX_REVIEW_IMAGES (backend/src/reservations/api/reviews.py) — kept
// in sync by hand since there's no generated client (frontend/CLAUDE.md's "Types are
// hand-maintained" gap); the server rejects a 5th image regardless of this UI cap.
const MAX_REVIEW_IMAGES = 4

function SplitCostDialog({
  reservation,
  open,
  onOpenChange,
}: {
  reservation: Reservation
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { token } = useAuth()
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ["reservation-split", reservation.id],
    queryFn: () => api.splitReservationCost(token!, reservation.id),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

function ReportResultDialog({
  reservation,
  open,
  onOpenChange,
}: {
  reservation: Reservation
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { token, user } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [winner, setWinner] = useState<"me" | "opponent" | "draw">("me")

  const { data: guests, isLoading } = useQuery({
    queryKey: ["reservation-guests", reservation.id],
    queryFn: () => api.listGuests(token!, reservation.id),
    enabled: open,
  })
  const opponent = guests?.length === 1 ? guests[0] : undefined

  const reportMutation = useMutation({
    mutationFn: () => {
      const winnerUserId = winner === "draw" ? null : winner === "me" ? user!.id : opponent!.user.id
      return api.reportMatchResult(token!, reservation.id, winnerUserId)
    },
    onSuccess: () => {
      onOpenChange(false)
      toast.success(t("reservationCard.result.toast.reported"))
      queryClient.invalidateQueries({ queryKey: ["ratings-me"] })
      queryClient.invalidateQueries({ queryKey: ["ratings-leaderboard"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("reservationCard.result.error")),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reservationCard.result.title")}</DialogTitle>
        </DialogHeader>
        {isLoading && <Skeleton className="h-24 w-full" />}
        {!isLoading && !opponent && <p className="text-sm text-slate-gray">{t("reservationCard.result.notEligible")}</p>}
        {!isLoading && opponent && (
          <div className="flex flex-col gap-2">
            {(["me", "opponent", "draw"] as const).map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-hairline px-3 py-2 has-[:checked]:border-signal-blue"
              >
                <input type="radio" name="winner" checked={winner === option} onChange={() => setWinner(option)} />
                <span className="text-sm text-ink-navy">
                  {option === "me" && t("reservationCard.result.iWon")}
                  {option === "opponent" && t("reservationCard.result.theyWon", { name: opponent.user.name })}
                  {option === "draw" && t("reservationCard.result.draw")}
                </span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {opponent && (
            <Button disabled={reportMutation.isPending} onClick={() => reportMutation.mutate()}>
              {t("reservationCard.result.submit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OpenToJoinDialog({
  reservation,
  onSave,
  isSaving,
  open,
  onOpenChange,
}: {
  reservation: Reservation
  onSave: (openToJoin: boolean, note: string) => void
  isSaving: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(reservation.open_to_join)
  const [note, setNote] = useState(reservation.open_note ?? "")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) {
          setEnabled(reservation.open_to_join)
          setNote(reservation.open_note ?? "")
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reservationCard.openToJoin.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink-navy">{t("reservationCard.openToJoin.label")}</span>
            <span className="text-xs text-slate-gray">{t("reservationCard.openToJoin.description")}</span>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={t("reservationCard.openToJoin.label")} />
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => {
              onSave(enabled, note.trim())
              onOpenChange(false)
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
  onInviteGuest?: (reservation: Reservation, player: PlayerSearchResult) => void
  onSetOpen?: (reservation: Reservation, openToJoin: boolean, note: string) => void
  isSettingOpen?: boolean
  hasReview?: boolean
  onSubmitReview?: (reservation: Reservation, rating: number, comment: string, photos: File[]) => void
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
  const [reviewOpen, setReviewOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [openToJoinOpen, setOpenToJoinOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [reviewPhotos, setReviewPhotos] = useState<File[]>([])
  const reviewPhotoInputRef = useRef<HTMLInputElement>(null)
  const reviewPhotoPreviews = useMemo(() => reviewPhotos.map((file) => URL.createObjectURL(file)), [reviewPhotos])
  useEffect(() => {
    return () => reviewPhotoPreviews.forEach((url) => URL.revokeObjectURL(url))
  }, [reviewPhotoPreviews])
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
  const canBookAgain =
    (status === "COMPLETED" || status === "CANCELLED" || status === "EXPIRED" || status === "REJECTED" || status === "NO_SHOW") &&
    court.active
  const canOpenToJoin = status === "CONFIRMED" && Boolean(onSetOpen)
  const canSplit = status !== "CANCELLED" && status !== "EXPIRED" && status !== "REJECTED"
  const canReportResult = status === "COMPLETED"
  const canExportCalendar = status === "CONFIRMED" || status === "CHECKED_IN" || status === "COMPLETED"
  // Lower-frequency utility actions live behind the "more" menu so the primary
  // action (confirm/check-in/review) and cancel stay the clear focal points.
  const hasMoreActions =
    canExportCalendar || canSplit || canOpenToJoin || canInviteGuest || canReschedule || canReportResult

  function submitReschedule() {
    const newStart = new Date(`${date}T${time}:00`)
    const newEnd = new Date(newStart.getTime() + durationMs)
    onReschedule?.(reservation, newStart.toISOString(), newEnd.toISOString())
    setRescheduleOpen(false)
  }

  function submitReview() {
    onSubmitReview?.(reservation, rating, comment.trim(), reviewPhotos)
    setReviewOpen(false)
    setReviewPhotos([])
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
        {reservation.series_id && (
          <Badge variant="secondary">
            <Repeat className="size-3" /> {t("reservationCard.recurring")}
          </Badge>
        )}

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

        {hasMoreActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="px-2.5" disabled={isBusy}>
                <MoreHorizontal className="size-3.5" />
                <span className="sr-only">{t("reservationCard.moreActions")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canExportCalendar && (
                <DropdownMenuItem disabled={icsMutation.isPending} onSelect={() => icsMutation.mutate()}>
                  <CalendarPlus /> {t("reservationCard.calendar.button")}
                </DropdownMenuItem>
              )}
              {canSplit && (
                <DropdownMenuItem onSelect={() => setSplitOpen(true)}>
                  <Coins /> {t("reservationCard.split.button")}
                </DropdownMenuItem>
              )}
              {canReportResult && (
                <DropdownMenuItem onSelect={() => setResultOpen(true)}>
                  <Trophy /> {t("reservationCard.result.button")}
                </DropdownMenuItem>
              )}
              {canOpenToJoin && (
                <DropdownMenuItem onSelect={() => setOpenToJoinOpen(true)}>
                  <Users /> {t("reservationCard.openToJoin.button")}
                </DropdownMenuItem>
              )}
              {canInviteGuest && (
                <DropdownMenuItem onSelect={() => setGuestOpen(true)}>
                  <UserPlus /> {t("reservationCard.invite")}
                </DropdownMenuItem>
              )}
              {canReschedule && (
                <DropdownMenuItem onSelect={() => setRescheduleOpen(true)}>
                  <CalendarClock /> {t("reservationCard.reschedule")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {canSplit && <SplitCostDialog reservation={reservation} open={splitOpen} onOpenChange={setSplitOpen} />}

        {canReportResult && (
          <ReportResultDialog reservation={reservation} open={resultOpen} onOpenChange={setResultOpen} />
        )}

        {canOpenToJoin && (
          <OpenToJoinDialog
            reservation={reservation}
            isSaving={isSettingOpen}
            onSave={(openToJoin, note) => onSetOpen?.(reservation, openToJoin, note)}
            open={openToJoinOpen}
            onOpenChange={setOpenToJoinOpen}
          />
        )}

        {canInviteGuest && (
          <Dialog open={guestOpen} onOpenChange={setGuestOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("reservationCard.guest.title")}</DialogTitle>
                <DialogDescription>{t("reservationCard.guest.description", { court: court.name })}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label>{t("reservationCard.guest.email")}</Label>
                <PlayerSearch
                  autoFocus
                  onSelect={(player) => {
                    onInviteGuest?.(reservation, player)
                    setGuestOpen(false)
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGuestOpen(false)}>
                  {t("common.cancel")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {canBookAgain && (
          <Button size="sm" variant="outline" asChild>
            <Link to={`/app/book?court=${court.id}`}>
              <Repeat className="size-3.5" /> {t("reservationCard.bookAgain")}
            </Link>
          </Button>
        )}

        {canReview && (
          <Dialog
            open={reviewOpen}
            onOpenChange={(open) => {
              setReviewOpen(open)
              if (!open) setReviewPhotos([])
            }}
          >
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
                <div className="flex flex-col gap-2">
                  <Label>{t("reservationCard.review.photos")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {reviewPhotos.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="group relative size-14 shrink-0 overflow-hidden rounded-lg border border-hairline">
                        <img src={reviewPhotoPreviews[index]} alt="" className="size-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setReviewPhotos((files) => files.filter((_, i) => i !== index))}
                          aria-label={t("profile.reviews.removePhoto")}
                          className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-ink-navy/70 text-paper opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                    {reviewPhotos.length < MAX_REVIEW_IMAGES && (
                      <button
                        type="button"
                        onClick={() => reviewPhotoInputRef.current?.click()}
                        aria-label={t("profile.reviews.addPhoto")}
                        className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-hairline text-slate-gray transition-colors hover:border-signal-blue hover:text-signal-blue"
                      >
                        <Plus className="size-4" />
                      </button>
                    )}
                  </div>
                  <input
                    ref={reviewPhotoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      if (file) setReviewPhotos((files) => [...files, file])
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewOpen(false)
                    setReviewPhotos([])
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button onClick={submitReview}>{t("reservationCard.review.submit")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {canReschedule && (
          <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
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
