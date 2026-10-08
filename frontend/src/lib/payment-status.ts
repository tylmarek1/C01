import type { BadgeProps } from "@/components/ui/badge"
import { useTranslation } from "@/lib/i18n"
import type { PaymentMethod, PaymentStatus, ReservationStatus } from "@/types"

/** Badge tone per payment status — purely visual. */
export const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, BadgeProps["variant"]> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "destructive",
  REFUND_PENDING: "info",
  REFUNDED: "secondary",
  REFUND_FAILED: "destructive",
}

// Mirror backend payments.PAYABLE_STATUSES / CASH_PAYABLE_STATUSES — the UI
// only offers what the API would accept; the backend enforces it.
export const ONLINE_PAYABLE: ReservationStatus[] = ["PENDING", "PENDING_APPROVAL", "CONFIRMED", "CHECKED_IN"]
export const CASH_PAYABLE: ReservationStatus[] = ["CONFIRMED", "CHECKED_IN", "COMPLETED"]
/** A reservation with one of these latest payments is paid (or being paid/refunded) — no new payment. */
export const SETTLED: PaymentStatus[] = ["PENDING", "PAID", "REFUND_PENDING", "REFUNDED", "REFUND_FAILED"]

export function usePaymentStatusLabels(): Record<PaymentStatus, string> {
  const { t } = useTranslation()
  return {
    PENDING: t("payment.status.PENDING"),
    PAID: t("payment.status.PAID"),
    FAILED: t("payment.status.FAILED"),
    REFUND_PENDING: t("payment.status.REFUND_PENDING"),
    REFUNDED: t("payment.status.REFUNDED"),
    REFUND_FAILED: t("payment.status.REFUND_FAILED"),
  }
}

export function usePaymentMethodLabels(): Record<PaymentMethod, string> {
  const { t } = useTranslation()
  return { ONLINE: t("payment.method.ONLINE"), CASH: t("payment.method.CASH") }
}
