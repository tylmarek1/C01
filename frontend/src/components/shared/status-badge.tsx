import { Badge } from "@/components/ui/badge"
import { PAYMENT_STATUS_VARIANT, usePaymentStatusLabels } from "@/lib/payment-status"
import { STATUS_VARIANT, useStatusLabels } from "@/lib/reservation-status"
import type { PaymentStatus, ReservationStatus } from "@/types"

function StatusBadge({ status, className }: { status: ReservationStatus; className?: string }) {
  const labels = useStatusLabels()
  return (
    <Badge variant={STATUS_VARIANT[status]} dot className={className}>
      {labels[status]}
    </Badge>
  )
}

function PaymentBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const labels = usePaymentStatusLabels()
  return (
    <Badge variant={PAYMENT_STATUS_VARIANT[status]} className={className}>
      {labels[status]}
    </Badge>
  )
}

export { PaymentBadge, StatusBadge }
