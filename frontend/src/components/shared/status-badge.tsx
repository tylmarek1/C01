import { Badge } from "@/components/ui/badge"
import { STATUS_VARIANT, useStatusLabels } from "@/lib/reservation-status"
import type { ReservationStatus } from "@/types"

function StatusBadge({ status, className }: { status: ReservationStatus; className?: string }) {
  const labels = useStatusLabels()
  return (
    <Badge variant={STATUS_VARIANT[status]} dot className={className}>
      {labels[status]}
    </Badge>
  )
}

export { StatusBadge }
