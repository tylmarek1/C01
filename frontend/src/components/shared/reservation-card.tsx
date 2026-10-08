import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CalendarClock,
  CalendarPlus,
  Clock3,
  Coins,
  ImagePlus,
  LogIn,
  MoreHorizontal,
  Repeat,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
  PanelRightOpen,
  X,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Countdown } from "@/components/shared/countdown"
import { OccupancyTimeline } from "@/components/shared/occupancy-timeline"
import { PlayerSearch } from "@/components/shared/player-search"
import { DayStrip, SlotGrid } from "@/components/shared/slot-picker"
import { StarRatingInput } from "@/components/shared/star-rating"
import { StatusBadge } from "@/components/shared/status-badge"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency, toDateString, useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { useNow } from "@/lib/use-now"
import { cn } from "@/lib/utils"
import type { PlayerSearchResult, Reservation } from "@/types"

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
        {data && data.total_cost === null && (
          <p className="rounded-lg bg-muted p-3 text-[13px] text-muted-foreground">{t("split.noPrice")}</p>
        )}
        {data && data.total_cost !== null && (
          <div className="flex flex-col gap-4">
            <div className="flex items-end justify-between rounded-lg border border-border p-4">
              <div className="flex flex-col gap-1">
                <span className="eyebrow">{t("split.perPersonLabel")}</span>
                <span className="font-display text-[34px] leading-none font-extrabold tabular">
                  {data.per_person !== null ? formatCurrency(data.per_person) : "—"}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="eyebrow">{t("split.total")}</span>
                <span className="text-[15px] font-medium tabular">{formatCurrency(data.total_cost)}</span>
              </div>
            </div>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {data.participants.map((participant) => (
                <li key={participant.user.id} className="flex items-center gap-3 px-3 py-2.5">
                  <UserAvatar name={participant.user.name} avatarUrl={participant.user.avatar_url} size="sm" />
                  <span className="flex-1 truncate text-[13px] font-medium">{participant.user.name}</span>
                  <span className="font-mono text-[13px] tabular">{formatCurrency(participant.share)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{data.currency_note}</p>
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
      queryClient.invalidateQueries({ queryKey: ["ratings-mine"] })
      queryClient.invalidateQueries({ queryKey: ["ratings-leaderboard"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("reservationCard.result.error")),
  })

  const options = opponent
    ? ([
        { value: "me", label: t("reservationCard.result.iWon") },
        { value: "opponent", label: t("reservationCard.result.theyWon", { name: opponent.user.name }) },
        { value: "draw", label: t("reservationCard.result.draw") },
      ] as const)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reservationCard.result.title")}</DialogTitle>
          <DialogDescription>{t("reservationCard.result.description")}</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-28 w-full" />}
        {!isLoading && !opponent && (
          <p className="rounded-lg bg-muted p-3 text-[13px] text-muted-foreground">{t("reservationCard.result.notEligible")}</p>
        )}
        {!isLoading && opponent && (
          <div role="radiogroup" className="grid gap-2">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3.5 py-3 text-[14px] transition-colors hover:bg-muted has-[:checked]:border-foreground has-[:checked]:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"
              >
                <input
                  type="radio"
                  name={`winner-${reservation.id}`}
                  checked={winner === option.value}
                  onChange={() => setWinner(option.value)}
                  className="size-4 accent-[var(--primary)]"
                />
                {option.label}
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {opponent && (
            <Button isLoading={reportMutation.isPending} onClick={() => reportMutation.mutate()}>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reservationCard.openToJoin.title")}</DialogTitle>
          <DialogDescription>{t("reservationCard.openToJoin.description")}</DialogDescription>
        </DialogHeader>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium">{t("reservationCard.openToJoin.label")}</span>
            <span className="text-xs text-muted-foreground">{t("reservationCard.openToJoin.hint")}</span>
          </span>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={t("reservationCard.openToJoin.label")} />
        </label>
        {enabled && (
          <div className="flex animate-fade-in flex-col gap-2">
            <Label htmlFor={`open-note-${reservation.id}`}>{t("reservationCard.openToJoin.noteLabel")}</Label>
            <Input
              id={`open-note-${reservation.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("reservationCard.openToJoin.notePlaceholder")}
              maxLength={200}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={isSaving}
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

function ReviewDialog({
  reservation,
  open,
  onOpenChange,
  onSubmit,
}: {
  reservation: Reservation
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (rating: number, comment: string, photos: File[]) => void
}) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const previews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])

  function close() {
    onOpenChange(false)
    setPhotos([])
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reservationCard.review.title", { court: reservation.court.name })}</DialogTitle>
          <DialogDescription>{t("reservationCard.review.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <StarRatingInput value={rating} onChange={setRating} className="-ml-1.5" />
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("reservationCard.review.commentPlaceholder")}
            maxLength={1000}
            rows={4}
          />
          <div className="flex flex-col gap-2">
            <Label>{t("reservationCard.review.photos")}</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((file, index) => (
                <div key={`${file.name}-${index}`} className="group relative size-16 shrink-0 overflow-hidden rounded-md border border-border">
                  <img src={previews[index]} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((files) => files.filter((_, i) => i !== index))}
                    aria-label={t("profile.reviews.removePhoto")}
                    className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary/80 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_REVIEW_IMAGES && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  aria-label={t("profile.reviews.addPhoto")}
                  className="flex size-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  <ImagePlus className="size-4" />
                </button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) setPhotos((files) => [...files, file])
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              onSubmit(rating, comment.trim(), photos)
              close()
              setComment("")
              setRating(5)
            }}
          >
            {t("reservationCard.review.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RescheduleDialog({
  reservation,
  open,
  onOpenChange,
  onSubmit,
}: {
  reservation: Reservation
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (startTime: string, endTime: string) => void
}) {
  const { t } = useTranslation()
  const fmt = useFormatters()
  const currentStart = new Date(reservation.start_time).toISOString()
  const durationMinutes = Math.round((new Date(reservation.end_time).getTime() - new Date(reservation.start_time).getTime()) / 60_000)
  const [date, setDate] = useState(() => toDateString(new Date(reservation.start_time)))
  const [selectedStart, setSelectedStart] = useState<string | null>(currentStart)

  const { data: availability, isLoading } = useQuery({
    queryKey: ["court-availability", reservation.court.id, date],
    queryFn: () => api.getCourtAvailability(reservation.court.id, date),
    enabled: open,
  })
  // The reservation being moved occupies its own slot — it mustn't block itself.
  const ownAvailability = useMemo(
    () =>
      availability && {
        ...availability,
        busy: availability.busy.filter(
          (slot) =>
            !(
              slot.source === "RESERVATION" &&
              new Date(slot.start_time).getTime() === new Date(reservation.start_time).getTime() &&
              new Date(slot.end_time).getTime() === new Date(reservation.end_time).getTime()
            ),
        ),
      },
    [availability, reservation.start_time, reservation.end_time],
  )

  const newStart = selectedStart ? new Date(selectedStart) : null
  const newEnd = newStart ? new Date(newStart.getTime() + durationMinutes * 60_000) : null
  const changed = Boolean(selectedStart) && selectedStart !== currentStart

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("reservationCard.reschedule.title")}</DialogTitle>
          <DialogDescription>{t("reservationCard.reschedule.description", { court: reservation.court.name })}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] min-w-0 flex-col gap-4 overflow-y-auto">
          <DayStrip
            value={date}
            onChange={(next) => {
              setDate(next)
              setSelectedStart(null)
            }}
          />
          {isLoading && <Skeleton className="h-40 w-full" />}
          {ownAvailability && (
            <>
              <OccupancyTimeline
                opensAt={ownAvailability.opens_at}
                closesAt={ownAvailability.closes_at}
                busy={ownAvailability.busy}
                compact
                pick={{ durationMinutes, selected: selectedStart, onSelect: (slot) => setSelectedStart(slot.start.toISOString()) }}
              />
              <SlotGrid
                availability={ownAvailability}
                durationMinutes={durationMinutes}
                selected={selectedStart}
                onSelect={(slot) => setSelectedStart(slot.start.toISOString())}
              />
            </>
          )}
        </div>
        <dl className="grid gap-1.5 border-t-2 border-foreground pt-3 text-[13px] sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">{t("reservationCard.reschedule.current")}</dt>
            <dd className="tabular line-through decoration-1 opacity-70">{fmt.dateRange(reservation.start_time, reservation.end_time)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock className="size-4" /> {t("reservationCard.reschedule.preview")}
            </dt>
            <dd className="font-semibold tabular">
              {changed && newStart && newEnd ? fmt.dateRange(newStart.toISOString(), newEnd.toISOString()) : "—"}
            </dd>
          </div>
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!changed || !newStart || !newEnd}
            onClick={() => {
              if (!newStart || !newEnd) return
              onSubmit(newStart.toISOString(), newEnd.toISOString())
              onOpenChange(false)
            }}
          >
            {t("reservationCard.reschedule.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Date block — the scannable anchor on the left of every reservation row. */
function DateBlock({ iso, muted = false }: { iso: string; muted?: boolean }) {
  const fmt = useFormatters()
  const date = new Date(iso)
  return (
    <span
      className={cn(
        "flex size-12 shrink-0 flex-col items-center justify-center rounded-xs border leading-none",
        muted ? "border-border bg-muted text-muted-foreground" : "border-foreground bg-card text-foreground",
      )}
    >
      <span className="font-mono text-[9.5px] font-medium tracking-wider uppercase opacity-70">{fmt.weekday(date)}</span>
      <span className="mt-0.5 font-display text-[22px] font-extrabold tabular">{date.getDate()}</span>
    </span>
  )
}

const STUB_SURFACE: Record<string, string> = {
  TENNIS: "bg-court-tennis",
  VOLLEYBALL: "bg-court-volleyball",
  BADMINTON: "bg-court-badminton",
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
  onHoldExpired?: () => void
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
  onHoldExpired,
  isSettingOpen = false,
  hasReview = false,
  onSubmitReview,
  isBusy = false,
}: ReservationCardProps) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const { court, status } = reservation
  const [dialog, setDialog] = useState<null | "reschedule" | "guest" | "review" | "split" | "result" | "open">(null)
  const start = new Date(reservation.start_time)
  const now = useNow(30_000)
  const isPast = new Date(reservation.end_time).getTime() < now
  const ended = ["COMPLETED", "CANCELLED", "EXPIRED", "REJECTED", "NO_SHOW"].includes(status)

  const icsMutation = useMutation({
    mutationFn: () => api.downloadReservationIcs(token!, reservation.id, `${court.name}.ics`),
    onSuccess: () => toast.success(t("reservationCard.toast.icsDownloaded")),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("reservationCard.error.icsDownload")),
  })

  // BR-11: an approved booking on an approval-required court can't be moved without a new request.
  const canReschedule = (status === "PENDING" || (status === "CONFIRMED" && !court.requires_approval)) && Boolean(onReschedule)
  // Mirrors BR-03: only a pending/confirmed reservation that has not started yet can be cancelled.
  const canCancel =
    (status === "PENDING" || status === "PENDING_APPROVAL" || status === "CONFIRMED") && start.getTime() > now && Boolean(onCancel)
  const canInviteGuest = (status === "PENDING" || status === "CONFIRMED" || status === "CHECKED_IN") && Boolean(onInviteGuest)
  const canReview = status === "COMPLETED" && !hasReview && Boolean(onSubmitReview)
  const canBookAgain = ended && court.active
  const canOpenToJoin = status === "CONFIRMED" && Boolean(onSetOpen)
  const canSplit = status !== "CANCELLED" && status !== "EXPIRED" && status !== "REJECTED"
  const canReportResult = status === "COMPLETED"
  const canExportCalendar = status === "CONFIRMED" || status === "CHECKED_IN" || status === "COMPLETED"
  const isToday = new Date().toDateString() === start.toDateString()

  const primary = (() => {
    if (status === "PENDING" && onConfirm)
      return (
        <Button size="sm" variant="brand" disabled={isBusy} onClick={() => onConfirm(reservation)}>
          {court.requires_approval ? t("reservationCard.requestApproval") : t("reservationCard.confirm")}
        </Button>
      )
    if (status === "CONFIRMED" && onCheckIn && isToday)
      return (
        <Button size="sm" disabled={isBusy} onClick={() => onCheckIn(reservation)}>
          <LogIn /> {t("reservationCard.checkIn")}
        </Button>
      )
    if (canReview)
      return (
        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => setDialog("review")}>
          <Star /> {t("reservationCard.rateIt")}
        </Button>
      )
    if (canBookAgain)
      return (
        <Button size="sm" variant="ghost" asChild>
          <Link to={`/app/book?court=${court.id}`}>
            <Repeat /> {t("reservationCard.bookAgain")}
          </Link>
        </Button>
      )
    return null
  })()

  const hasMenu =
    canExportCalendar || canSplit || canOpenToJoin || canInviteGuest || canReschedule || canReportResult || canCancel || Boolean(onOpenDetail)

  return (
    <article
      className={cn(
        // A ticket: a sport-coloured date stub, a perforation, then the booking.
        "group/res ticket relative grid grid-cols-[5.25rem_minmax(0,1fr)] rounded-md border bg-card transition-colors duration-150 [--perf:5.25rem] sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:[--perf:6.5rem]",
        status === "PENDING" ? "border-warning" : "border-border hover:border-foreground",
      )}
    >
      <div
        aria-hidden
        onClick={() => onOpenDetail?.(reservation)}
        className={cn(
          "row-span-2 flex flex-col items-center justify-center gap-1 rounded-l-[inherit] border-r-2 border-dashed border-card px-2 py-4 leading-none sm:row-span-1",
          ended || isPast ? "bg-muted text-muted-foreground" : cn(STUB_SURFACE[court.sport_type], "text-court-line"),
          onOpenDetail && "cursor-pointer",
        )}
      >
        <span className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase opacity-85">{fmt.weekday(start)}</span>
        <span className="font-display text-[40px] font-extrabold tabular">{start.getDate()}</span>
        <span className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase opacity-85">{fmt.monthShort(start)}</span>
      </div>
      <button
        type="button"
        disabled={!onOpenDetail}
        onClick={() => onOpenDetail?.(reservation)}
        className="flex min-w-0 flex-col justify-center gap-1.5 px-4 pt-3.5 pb-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset disabled:cursor-default sm:py-4"
        aria-label={onOpenDetail ? t("reservationCard.openDetail", { court: court.name }) : undefined}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span
            className={cn(
              "truncate font-display text-[23px] leading-none font-extrabold uppercase decoration-2 underline-offset-4",
              ended ? "text-muted-foreground" : "text-foreground",
              onOpenDetail && "group-hover/res:underline",
            )}
          >
            {court.name}
          </span>
          <StatusBadge status={status} />
          {reservation.series_id && (
            <Badge variant="outline">
              <Repeat /> {t("reservationCard.recurring")}
            </Badge>
          )}
          {reservation.open_to_join && (
            <Badge variant="brand">
              <Sparkles /> {t("reservationCard.openBadge")}
            </Badge>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <span className="font-mono text-[15px] font-semibold text-foreground tabular">{fmt.timeRange(reservation.start_time, reservation.end_time)}</span>
          <span>{fmt.dayLabel(reservation.start_time)}</span>
          <span className="hidden sm:inline">{fmt.durationBetween(reservation.start_time, reservation.end_time)}</span>
          {court.requires_approval && status !== "COMPLETED" && (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> {t("courts.requiresApproval")}
            </span>
          )}
        </span>
        {status === "PENDING" && reservation.hold_expires_at && (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-warning uppercase">
            <Clock3 className="size-3.5" />
            {t("reservationCard.holdCountdown")} <Countdown to={reservation.hold_expires_at} onExpire={onHoldExpired} />
          </span>
        )}
        {status === "PENDING_APPROVAL" && reservation.approval_expires_at && (
          <span className="inline-flex items-center gap-1.5 text-xs text-info">
            <Clock3 className="size-3.5" />
            {t("reservationCard.approvalExpires", { time: fmt.dateTime(reservation.approval_expires_at) })}
          </span>
        )}
      </button>

      <div className="col-start-2 flex shrink-0 items-center justify-end gap-1.5 px-3 pb-3 sm:col-start-3 sm:px-4 sm:pb-0">
        {primary}
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" disabled={isBusy} aria-label={t("reservationCard.moreActions")}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {onOpenDetail && (
                <DropdownMenuItem onSelect={() => onOpenDetail(reservation)}>
                  <PanelRightOpen /> {t("reservationCard.viewDetails")}
                </DropdownMenuItem>
              )}
              {status === "CONFIRMED" && onCheckIn && !isToday && (
                <DropdownMenuItem onSelect={() => onCheckIn(reservation)}>
                  <LogIn /> {t("reservationCard.checkIn")}
                </DropdownMenuItem>
              )}
              {canInviteGuest && (
                <DropdownMenuItem onSelect={() => setDialog("guest")}>
                  <UserPlus /> {t("reservationCard.invite")}
                </DropdownMenuItem>
              )}
              {canOpenToJoin && (
                <DropdownMenuItem onSelect={() => setDialog("open")}>
                  <Sparkles /> {t("reservationCard.openToJoin.button")}
                </DropdownMenuItem>
              )}
              {canReschedule && (
                <DropdownMenuItem onSelect={() => setDialog("reschedule")}>
                  <CalendarClock /> {t("reservationCard.reschedule")}
                </DropdownMenuItem>
              )}
              {canExportCalendar && (
                <DropdownMenuItem disabled={icsMutation.isPending} onSelect={() => icsMutation.mutate()}>
                  <CalendarPlus /> {t("reservationCard.calendar.button")}
                </DropdownMenuItem>
              )}
              {canSplit && (
                <DropdownMenuItem onSelect={() => setDialog("split")}>
                  <Coins /> {t("reservationCard.split.button")}
                </DropdownMenuItem>
              )}
              {canReportResult && (
                <DropdownMenuItem onSelect={() => setDialog("result")}>
                  <Trophy /> {t("reservationCard.result.button")}
                </DropdownMenuItem>
              )}
              {canBookAgain && primary === null && (
                <DropdownMenuItem asChild>
                  <Link to={`/app/book?court=${court.id}`}>
                    <Repeat /> {t("reservationCard.bookAgain")}
                  </Link>
                </DropdownMenuItem>
              )}
              {canCancel && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => onCancel?.(reservation)}>
                    <XCircle /> {t("reservationCard.cancel")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {canSplit && <SplitCostDialog reservation={reservation} open={dialog === "split"} onOpenChange={(o) => setDialog(o ? "split" : null)} />}
      {canReportResult && (
        <ReportResultDialog reservation={reservation} open={dialog === "result"} onOpenChange={(o) => setDialog(o ? "result" : null)} />
      )}
      {canOpenToJoin && dialog === "open" && (
        <OpenToJoinDialog
          reservation={reservation}
          isSaving={isSettingOpen}
          onSave={(openToJoin, note) => onSetOpen?.(reservation, openToJoin, note)}
          open={dialog === "open"}
          onOpenChange={(o) => setDialog(o ? "open" : null)}
        />
      )}
      {canInviteGuest && (
        <Dialog open={dialog === "guest"} onOpenChange={(o) => setDialog(o ? "guest" : null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("reservationCard.guest.title")}</DialogTitle>
              <DialogDescription>{t("reservationCard.guest.description", { court: court.name })}</DialogDescription>
            </DialogHeader>
            <PlayerSearch
              autoFocus
              onSelect={(player) => {
                onInviteGuest?.(reservation, player)
                setDialog(null)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
      {canReview && (
        <ReviewDialog
          reservation={reservation}
          open={dialog === "review"}
          onOpenChange={(o) => setDialog(o ? "review" : null)}
          onSubmit={(rating, comment, photos) => onSubmitReview?.(reservation, rating, comment, photos)}
        />
      )}
      {canReschedule && dialog === "reschedule" && (
        <RescheduleDialog
          reservation={reservation}
          open={dialog === "reschedule"}
          onOpenChange={(o) => setDialog(o ? "reschedule" : null)}
          onSubmit={(startTime, endTime) => onReschedule?.(reservation, startTime, endTime)}
        />
      )}
    </article>
  )
}

export { DateBlock, ReservationCard }
