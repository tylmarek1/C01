import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUpRight, Check, Clock3, MessageCircle, Repeat, Sparkles, UserMinus, X } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogDescription, DialogTitle, SheetContent } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CourtArt } from "@/components/shared/court-art"
import { Countdown } from "@/components/shared/countdown"
import { StatusBadge } from "@/components/shared/status-badge"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency, useFormatters } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Reservation, ReservationEventType, ReservationGuest } from "@/types"

const EVENT_KEYS: Record<ReservationEventType, TranslationKey> = {
  CREATED: "event.CREATED",
  SUBMITTED: "event.SUBMITTED",
  CONFIRMED: "event.CONFIRMED",
  CHECKED_IN: "event.CHECKED_IN",
  COMPLETED: "event.COMPLETED",
  CANCELLED: "event.CANCELLED",
  EXPIRED: "event.EXPIRED",
  REJECTED: "event.REJECTED",
  NO_SHOW: "event.NO_SHOW",
  TIME_CHANGED: "event.TIME_CHANGED",
} as const

const EVENT_TONE: Partial<Record<ReservationEventType, string>> = {
  CONFIRMED: "bg-success",
  CHECKED_IN: "bg-brand",
  COMPLETED: "bg-foreground",
  CANCELLED: "bg-muted-foreground",
  EXPIRED: "bg-muted-foreground",
  REJECTED: "bg-danger",
  NO_SHOW: "bg-danger",
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold">
        {title}
        {count !== undefined && <span className="font-mono text-[11px] font-medium text-muted-foreground tabular">{count}</span>}
      </h3>
      {children}
    </section>
  )
}

/** Shared timeline used by the reservation sheet and the admin history dialog. */
function ReservationTimeline({ reservationId, enabled = true }: { reservationId: string; enabled?: boolean }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const { data: history, isLoading } = useQuery({
    queryKey: ["reservation-history", reservationId],
    queryFn: () => api.getReservationHistory(token!, reservationId),
    enabled: Boolean(token) && enabled,
  })

  if (isLoading) return <Skeleton className="h-28 w-full" />
  if (!history || history.length === 0) return <p className="text-[13px] text-muted-foreground">{t("reservationDetail.history.empty")}</p>

  return (
    <ol className="relative flex flex-col gap-4 pl-5 before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-px before:bg-border">
      {history.map((event) => (
        <li key={event.id} className="relative flex flex-col gap-0.5">
          <span
            aria-hidden
            className={cn("absolute top-1.5 -left-5 size-[11px] rounded-full ring-4 ring-card", EVENT_TONE[event.event_type] ?? "bg-info")}
          />
          <span className="text-[13px] font-medium">{t(EVENT_KEYS[event.event_type])}</span>
          <span className="text-xs text-muted-foreground">
            <span className="font-mono tabular">{fmt.dateTime(event.created_at)}</span> ·{" "}
            {event.actor ? event.actor.name : t("admin.reservations.historyDialog.systemActor")}
          </span>
          {event.note && <span className="text-xs text-muted-foreground italic">“{event.note}”</span>}
        </li>
      ))}
    </ol>
  )
}

interface ReservationDetailDialogProps {
  reservation: Reservation | null
  onClose: () => void
}

/** Side sheet with everything about one reservation: when/where, who's
 * playing, join requests, cost, and the full status timeline. */
function ReservationDetailDialog({ reservation, onClose }: ReservationDetailDialogProps) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: guests, isLoading: isLoadingGuests } = useQuery({
    queryKey: ["reservation-guests", reservation?.id],
    queryFn: () => api.listGuests(token!, reservation!.id),
    enabled: Boolean(token && reservation),
  })

  const [removeGuestTarget, setRemoveGuestTarget] = useState<ReservationGuest | null>(null)

  const removeGuestMutation = useMutation({
    mutationFn: (userId: string) => api.removeGuest(token!, reservation!.id, userId),
    onSuccess: () => {
      setRemoveGuestTarget(null)
      toast.success(t("reservationDetail.toast.guestRemoved"))
      queryClient.invalidateQueries({ queryKey: ["reservation-guests", reservation?.id] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("reservationDetail.error.removeGuest")),
  })

  const { data: joinRequests, isLoading: isLoadingJoinRequests } = useQuery({
    queryKey: ["reservation-join-requests", reservation?.id],
    queryFn: () => api.listJoinRequests(token!, reservation!.id),
    enabled: Boolean(token && reservation && reservation.open_to_join),
  })
  const pendingJoinRequests = joinRequests?.filter((request) => request.status === "PENDING") ?? []

  const acceptJoinMutation = useMutation({
    mutationFn: (requestId: string) => api.acceptJoinRequest(token!, reservation!.id, requestId),
    onSuccess: () => {
      toast.success(t("reservationDetail.toast.joinAccepted"))
      queryClient.invalidateQueries({ queryKey: ["reservation-join-requests", reservation?.id] })
      queryClient.invalidateQueries({ queryKey: ["reservation-guests", reservation?.id] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("reservationDetail.error.joinAccept")),
  })

  const declineJoinMutation = useMutation({
    mutationFn: (requestId: string) => api.declineJoinRequest(token!, reservation!.id, requestId),
    onSuccess: () => {
      toast.success(t("reservationDetail.toast.joinDeclined"))
      queryClient.invalidateQueries({ queryKey: ["reservation-join-requests", reservation?.id] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("reservationDetail.error.joinDecline")),
  })

  const canManageGuests =
    reservation && (reservation.status === "PENDING" || reservation.status === "CONFIRMED" || reservation.status === "CHECKED_IN")
  const canChat =
    reservation && reservation.status !== "CANCELLED" && reservation.status !== "EXPIRED" && reservation.status !== "REJECTED"

  const openChatMutation = useMutation({
    mutationFn: () => api.openReservationChat(token!, reservation!.id),
    onSuccess: (conversation) => {
      onClose()
      navigate(`/app/chat?conversation=${conversation.id}`)
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("reservationDetail.error.chat")),
  })

  const hours = reservation ? (new Date(reservation.end_time).getTime() - new Date(reservation.start_time).getTime()) / 3_600_000 : 0
  const estimatedCost = reservation?.court.price_per_hour != null ? reservation.court.price_per_hour * hours : null

  return (
    <>
      <Dialog open={Boolean(reservation)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-[440px]">
          {reservation && (
            <>
              <div className="flex flex-col gap-4 border-b border-border p-5 pt-6">
                <div className="flex items-start gap-3.5 pr-8">
                  <CourtArt
                    sport={reservation.court.sport_type}
                    imageUrl={reservation.court.image_url}
                    compact
                    className="aspect-square size-14 shrink-0 rounded-lg"
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <DialogTitle className="truncate text-[17px] font-semibold tracking-[-0.015em]">{reservation.court.name}</DialogTitle>
                    <DialogDescription className="text-[13px] text-muted-foreground">
                      {fmt.dateLong(reservation.start_time)}
                    </DialogDescription>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={reservation.status} />
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
                    </div>
                  </div>
                </div>

                <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-muted/40">
                  <div className="flex flex-col gap-1 p-3">
                    <dt className="eyebrow text-[10px]">{t("reservationDetail.time")}</dt>
                    <dd className="font-mono text-[13px] font-medium tabular">{fmt.timeRange(reservation.start_time, reservation.end_time)}</dd>
                  </div>
                  <div className="flex flex-col gap-1 p-3">
                    <dt className="eyebrow text-[10px]">{t("reservationDetail.duration")}</dt>
                    <dd className="text-[13px] font-medium">{fmt.durationBetween(reservation.start_time, reservation.end_time)}</dd>
                  </div>
                  <div className="flex flex-col gap-1 p-3">
                    <dt className="eyebrow text-[10px]">{t("reservationDetail.cost")}</dt>
                    <dd className="text-[13px] font-medium tabular">{estimatedCost !== null ? formatCurrency(estimatedCost) : "—"}</dd>
                  </div>
                </dl>

                {reservation.status === "PENDING" && reservation.hold_expires_at && (
                  <p className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
                    <Clock3 className="size-4 shrink-0" />
                    {t("reservationCard.holdCountdown")} <Countdown to={reservation.hold_expires_at} className="font-semibold" />
                  </p>
                )}
                {reservation.status === "PENDING_APPROVAL" && reservation.approval_expires_at && (
                  <p className="flex items-center gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-[13px] text-info">
                    <Clock3 className="size-4 shrink-0" />
                    {t("reservationCard.approvalExpires", { time: fmt.dateTime(reservation.approval_expires_at) })}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {canChat && (
                    <Button size="sm" isLoading={openChatMutation.isPending} onClick={() => openChatMutation.mutate()}>
                      {!openChatMutation.isPending && <MessageCircle />} {t("reservationDetail.chat")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/courts/${reservation.court.id}`} onClick={onClose}>
                      {t("reservationDetail.viewCourt")} <ArrowUpRight />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-7 p-5">
                <Section title={t("reservationDetail.guests.title")} count={guests?.length}>
                  {isLoadingGuests && <Skeleton className="h-12 w-full" />}
                  {!isLoadingGuests && guests?.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border-strong px-3 py-4 text-center text-[13px] text-muted-foreground">
                      {t("reservationDetail.guests.empty")}
                    </p>
                  )}
                  {guests && guests.length > 0 && (
                    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                      {guests.map((guest) => (
                        <li key={guest.id} className="flex items-center gap-3 px-3 py-2.5">
                          <UserAvatar name={guest.user.name} avatarUrl={guest.user.avatar_url} size="sm" />
                          <Link to={`/app/players/${guest.user.id}`} onClick={onClose} className="flex min-w-0 flex-1 flex-col hover:underline">
                            <span className="truncate text-[13px] font-medium">{guest.user.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{guest.user.email}</span>
                          </Link>
                          {canManageGuests && (
                            <Tooltip content={t("reservationDetail.guests.remove")}>
                              <Button
                                variant="subtle"
                                size="icon-xs"
                                onClick={() => setRemoveGuestTarget(guest)}
                                aria-label={t("reservationDetail.guests.remove")}
                              >
                                <UserMinus />
                              </Button>
                            </Tooltip>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {reservation.open_to_join && (
                  <Section title={t("reservationDetail.joinRequests.title")} count={pendingJoinRequests.length}>
                    {reservation.open_note && (
                      <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand-ink">
                        {t("reservationDetail.openNote", { note: reservation.open_note })}
                      </p>
                    )}
                    {isLoadingJoinRequests && <Skeleton className="h-12 w-full" />}
                    {!isLoadingJoinRequests && pendingJoinRequests.length === 0 && (
                      <p className="text-[13px] text-muted-foreground">{t("reservationDetail.joinRequests.empty")}</p>
                    )}
                    {pendingJoinRequests.map((request) => (
                      <div key={request.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                        <UserAvatar name={request.user.name} avatarUrl={request.user.avatar_url} size="sm" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[13px] font-medium">{request.user.name}</span>
                          {request.note && <span className="line-clamp-2 text-xs text-muted-foreground">{request.note}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon-xs"
                            variant="outline"
                            onClick={() => declineJoinMutation.mutate(request.id)}
                            disabled={acceptJoinMutation.isPending || declineJoinMutation.isPending}
                            aria-label={t("reservationDetail.joinRequests.decline")}
                          >
                            <X />
                          </Button>
                          <Button
                            size="icon-xs"
                            onClick={() => acceptJoinMutation.mutate(request.id)}
                            disabled={acceptJoinMutation.isPending || declineJoinMutation.isPending}
                            aria-label={t("reservationDetail.joinRequests.accept")}
                          >
                            <Check />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </Section>
                )}

                <Section title={t("reservationDetail.history.title")}>
                  <ReservationTimeline reservationId={reservation.id} />
                </Section>
              </div>
            </>
          )}
        </SheetContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removeGuestTarget)}
        onOpenChange={(open) => !open && setRemoveGuestTarget(null)}
        title={t("confirmDialog.removeGuest.title", { name: removeGuestTarget?.user.name ?? "" })}
        description={t("confirmDialog.removeGuest.description")}
        confirmLabel={t("reservationDetail.guests.remove")}
        isLoading={removeGuestMutation.isPending}
        onConfirm={() => removeGuestTarget && removeGuestMutation.mutate(removeGuestTarget.user.id)}
      />
    </>
  )
}

export { ReservationDetailDialog, ReservationTimeline }
