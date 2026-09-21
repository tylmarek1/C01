import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shared/dialog"
import { Skeleton } from "@/components/shared/skeleton"
import { SportIcon } from "@/components/shared/sport-icon"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatDateRange } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { STATUS_VARIANT, useStatusLabels } from "@/lib/reservation-status"
import type { Reservation, ReservationEventType, ReservationGuest } from "@/types"

const EVENT_KEYS: Record<ReservationEventType, TranslationKey> = {
  CREATED: "event.CREATED",
  CONFIRMED: "event.CONFIRMED",
  CHECKED_IN: "event.CHECKED_IN",
  COMPLETED: "event.COMPLETED",
  CANCELLED: "event.CANCELLED",
  EXPIRED: "event.EXPIRED",
  NO_SHOW: "event.NO_SHOW",
  TIME_CHANGED: "event.TIME_CHANGED",
} as const

interface ReservationDetailDialogProps {
  reservation: Reservation | null
  onClose: () => void
}

function ReservationDetailDialog({ reservation, onClose }: ReservationDetailDialogProps) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const statusLabels = useStatusLabels()
  const queryClient = useQueryClient()

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["reservation-history", reservation?.id],
    queryFn: () => api.getReservationHistory(token!, reservation!.id),
    enabled: Boolean(token && reservation),
  })

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

  return (
    <>
      <Dialog open={Boolean(reservation)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
        {reservation && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pebble text-ink-navy">
                  <SportIcon sport={reservation.court.sport_type} className="size-4" />
                </span>
                {reservation.court.name}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-xl border border-hairline p-3">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-gray">{t("reservationDetail.when")}</span>
                  <span className="text-sm font-medium text-ink-navy">
                    {formatDateRange(reservation.start_time, reservation.end_time)}
                  </span>
                </div>
                <Badge variant={STATUS_VARIANT[reservation.status]}>{statusLabels[reservation.status]}</Badge>
              </div>

              {reservation.status === "PENDING" && reservation.hold_expires_at && (
                <p className="text-xs font-medium text-amber-600">
                  {t("reservationCard.holdExpires", {
                    time: new Date(reservation.hold_expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  })}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-ink-navy">{t("reservationDetail.guests.title")}</span>
                {isLoadingGuests && <Skeleton className="h-10 w-full" />}
                {!isLoadingGuests && guests?.length === 0 && (
                  <p className="text-sm text-slate-gray">{t("reservationDetail.guests.empty")}</p>
                )}
                {guests?.map((guest) => (
                  <div key={guest.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-ink-navy">{guest.user.name}</span>
                      <span className="text-xs text-slate-gray">{guest.user.email}</span>
                    </div>
                    {canManageGuests && (
                      <button
                        type="button"
                        onClick={() => setRemoveGuestTarget(guest)}
                        disabled={removeGuestMutation.isPending}
                        className="text-slate-gray hover:text-destructive"
                        aria-label={t("reservationDetail.guests.remove")}
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {reservation.open_to_join && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-ink-navy">{t("reservationDetail.joinRequests.title")}</span>
                  {reservation.open_note && <p className="text-xs text-slate-gray">{t("reservationDetail.openNote", { note: reservation.open_note })}</p>}
                  {isLoadingJoinRequests && <Skeleton className="h-10 w-full" />}
                  {!isLoadingJoinRequests && pendingJoinRequests.length === 0 && (
                    <p className="text-sm text-slate-gray">{t("reservationDetail.joinRequests.empty")}</p>
                  )}
                  {pendingJoinRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-ink-navy">{request.user.name}</span>
                        {request.note && <span className="text-xs text-slate-gray">{request.note}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => acceptJoinMutation.mutate(request.id)}
                          disabled={acceptJoinMutation.isPending || declineJoinMutation.isPending}
                          className="flex size-7 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-50"
                          aria-label={t("reservationDetail.joinRequests.accept")}
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => declineJoinMutation.mutate(request.id)}
                          disabled={acceptJoinMutation.isPending || declineJoinMutation.isPending}
                          className="flex size-7 items-center justify-center rounded-full text-slate-gray hover:bg-pebble hover:text-destructive"
                          aria-label={t("reservationDetail.joinRequests.decline")}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-ink-navy">{t("reservationDetail.history.title")}</span>
                {isLoadingHistory && <Skeleton className="h-24 w-full" />}
                {!isLoadingHistory && history?.length === 0 && (
                  <p className="text-sm text-slate-gray">{t("reservationDetail.history.empty")}</p>
                )}
                <div className="flex flex-col gap-3">
                  {history?.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 border-b border-hairline pb-3 last:border-b-0">
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-signal-blue" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-ink-navy">{t(EVENT_KEYS[event.event_type])}</span>
                        <span className="text-xs text-slate-gray">{new Date(event.created_at).toLocaleString()}</span>
                        {event.note && <span className="text-xs text-slate-gray">{event.note}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button variant="outline" onClick={onClose} className="mt-2">
              {t("common.close")}
            </Button>
          </>
        )}
        </DialogContent>
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

export { ReservationDetailDialog }
