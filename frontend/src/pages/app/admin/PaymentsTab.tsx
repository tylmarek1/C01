import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HandCoins, RotateCcw, Wallet } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { FilterChip } from "@/components/shared/filter-chip"
import { PaymentBadge } from "@/components/shared/status-badge"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency, useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { usePaymentMethodLabels, usePaymentStatusLabels } from "@/lib/payment-status"
import type { PaymentAdmin, PaymentStatus } from "@/types"

// The statuses a manager acts on first, then the rest.
const FILTERS: PaymentStatus[] = ["REFUND_PENDING", "REFUND_FAILED", "PAID", "REFUNDED", "FAILED", "PENDING"]

function PaymentsTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const queryClient = useQueryClient()
  const statusLabels = usePaymentStatusLabels()
  const methodLabels = usePaymentMethodLabels()
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get("status") as PaymentStatus | null
  const status = statusParam && FILTERS.includes(statusParam) ? statusParam : null

  const { data: payments, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-payments", status],
    queryFn: () => api.listPayments(token!, status ?? undefined, { limit: 200 }),
  })

  function setStatus(next: PaymentStatus | null) {
    setSearchParams(next ? { tab: "payments", status: next } : { tab: "payments" }, { replace: true })
  }

  const onSettled = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-payments"] })
    queryClient.invalidateQueries({ queryKey: ["admin-reservations"] })
  }
  const cashMutation = useMutation({
    mutationFn: (payment: PaymentAdmin) => api.handBackCash(token!, payment.id),
    onSuccess: () => {
      toast.success(t("admin.payments.toast.cashReturned"))
      onSettled()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.payments.error.action")),
  })
  const retryMutation = useMutation({
    mutationFn: (payment: PaymentAdmin) => api.retryRefund(token!, payment.id),
    onSuccess: () => {
      toast.success(t("admin.payments.toast.retryQueued"))
      onSettled()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.payments.error.action")),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={status === null} onClick={() => setStatus(null)}>
          {t("admin.payments.filter.all")}
        </FilterChip>
        {FILTERS.map((value) => (
          <FilterChip key={value} active={status === value} onClick={() => setStatus(status === value ? null : value)}>
            {statusLabels[value]}
          </FilterChip>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("admin.payments.mockNote")}</p>

      {isError && <ErrorState onRetry={() => refetch()} />}
      {isLoading && <Skeleton className="h-48" />}
      {payments && payments.length === 0 && (
        <EmptyState
          icon={Wallet}
          title={status ? t("admin.payments.empty.filteredTitle") : t("admin.payments.empty.title")}
          description={t("admin.payments.empty.description")}
        />
      )}
      {payments && payments.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-t-2 border-foreground">
          {payments.map((payment) => {
            const { reservation } = payment
            const cashToReturn = payment.status === "REFUND_PENDING" && payment.method === "CASH"
            return (
              <li key={payment.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar name={reservation.user.name} avatarUrl={reservation.user.avatar_url} size="sm" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-medium">
                      {reservation.user.name} · {reservation.court.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {fmt.dateRange(reservation.start_time, reservation.end_time)} · {methodLabels[payment.method]} ·{" "}
                      {fmt.dateTime(payment.created_at)}
                    </span>
                    {payment.failure_reason && <span className="text-xs text-danger">{payment.failure_reason}</span>}
                    {payment.status === "REFUND_PENDING" && payment.method === "ONLINE" && (
                      <span className="text-xs text-muted-foreground">{t("admin.payments.refundQueued")}</span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-[14px] font-semibold tabular">{formatCurrency(payment.amount)}</span>
                  <PaymentBadge status={payment.status} />
                  {cashToReturn && (
                    <Button size="sm" variant="outline" isLoading={cashMutation.isPending && cashMutation.variables?.id === payment.id} onClick={() => cashMutation.mutate(payment)}>
                      <HandCoins /> {t("admin.payments.handBack")}
                    </Button>
                  )}
                  {payment.status === "REFUND_FAILED" && (
                    <Button size="sm" variant="outline" isLoading={retryMutation.isPending && retryMutation.variables?.id === payment.id} onClick={() => retryMutation.mutate(payment)}>
                      <RotateCcw /> {t("admin.payments.retry")}
                    </Button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export { PaymentsTab }
