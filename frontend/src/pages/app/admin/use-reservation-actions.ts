import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import type { ReservationAdmin } from "@/types"

/** Manager-side reservation transitions, shared by the overview approval
 * queue and the reservations table so both invalidate the same caches. */
export function useReservationActions(onDone?: () => void) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-reservations"] })
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] })
    onDone?.()
  }

  const fail = (fallback: Parameters<typeof t>[0]) => (error: Error) =>
    toast.error(error instanceof ApiError ? error.message : t(fallback))

  const cancel = useMutation({
    mutationFn: (r: ReservationAdmin) => api.cancelReservation(token!, r.id),
    onSuccess: () => {
      toast.success(t("admin.toast.reservationCancelled"))
      invalidate()
    },
    onError: fail("admin.error.reservationCancel"),
  })
  const confirm = useMutation({
    mutationFn: (r: ReservationAdmin) => api.confirmReservation(token!, r.id),
    onSuccess: (confirmed) => {
      toast.success(t(confirmed.status === "PENDING_APPROVAL" ? "admin.toast.reservationSubmitted" : "admin.toast.reservationConfirmed"))
      invalidate()
    },
    onError: fail("admin.error.reservationConfirm"),
  })
  const approve = useMutation({
    mutationFn: (r: ReservationAdmin) => api.approveReservation(token!, r.id),
    onSuccess: (_res, r) => {
      toast.success(t("admin.toast.reservationApprovedFor", { name: r.user.name }))
      invalidate()
    },
    onError: fail("admin.error.reservationApprove"),
  })
  const reject = useMutation({
    mutationFn: (r: ReservationAdmin) => api.rejectReservation(token!, r.id),
    onSuccess: () => {
      toast.success(t("admin.toast.reservationRejected"))
      invalidate()
    },
    onError: fail("admin.error.reservationReject"),
  })
  const checkIn = useMutation({
    mutationFn: (r: ReservationAdmin) => api.checkInReservation(token!, r.id),
    onSuccess: () => {
      toast.success(t("admin.toast.reservationCheckedIn"))
      invalidate()
    },
    onError: fail("admin.error.reservationCheckIn"),
  })

  const isBusy = cancel.isPending || confirm.isPending || approve.isPending || reject.isPending || checkIn.isPending
  return { cancel, confirm, approve, reject, checkIn, isBusy }
}
