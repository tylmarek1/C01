import { useInfiniteQuery, useMutation } from "@tanstack/react-query"
import { Check, ClipboardList, Download, History, LogIn, MoreHorizontal, Sparkles, Users, X, XCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { FilterChip } from "@/components/shared/filter-chip"
import { ReservationTimeline } from "@/components/shared/reservation-detail-dialog"
import { SearchInput } from "@/components/shared/search-input"
import { SportIcon } from "@/components/shared/sport-icon"
import { StatusBadge } from "@/components/shared/status-badge"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { useAdminStats } from "@/lib/queries"
import { useStatusLabels } from "@/lib/reservation-status"
import type { ReservationAdmin, ReservationStatus } from "@/types"
import { useReservationActions } from "@/pages/app/admin/use-reservation-actions"

const PAGE_SIZE = 50
const STATUS_FILTERS: ReservationStatus[] = [
  "PENDING_APPROVAL",
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "REJECTED",
  "NO_SHOW",
]
const CANCELLABLE_STATUSES: ReservationStatus[] = ["PENDING", "PENDING_APPROVAL", "CONFIRMED"]

function RowActions({
  reservation,
  actions,
  onCancel,
  onReject,
}: {
  reservation: ReservationAdmin
  actions: ReturnType<typeof useReservationActions>
  onCancel: () => void
  onReject: () => void
}) {
  const { t } = useTranslation()
  const [historyOpen, setHistoryOpen] = useState(false)
  const canCancel = CANCELLABLE_STATUSES.includes(reservation.status) && new Date(reservation.start_time) > new Date()

  return (
    <div className="flex items-center justify-end gap-1.5">
      {reservation.status === "PENDING_APPROVAL" && (
        <>
          <Tooltip content={t("admin.reservations.reject")}>
            <Button size="icon-sm" variant="outline" disabled={actions.isBusy} onClick={onReject} aria-label={t("admin.reservations.reject")}>
              <X />
            </Button>
          </Tooltip>
          <Button size="sm" disabled={actions.isBusy} onClick={() => actions.approve.mutate(reservation)}>
            <Check /> {t("admin.reservations.approve")}
          </Button>
        </>
      )}
      {reservation.status === "PENDING" && (
        <Button size="sm" variant="outline" disabled={actions.isBusy} onClick={() => actions.confirm.mutate(reservation)}>
          {t("admin.reservations.confirm")}
        </Button>
      )}
      {reservation.status === "CONFIRMED" && (
        <Button size="sm" variant="outline" disabled={actions.isBusy} onClick={() => actions.checkIn.mutate(reservation)}>
          <LogIn /> {t("admin.reservations.checkIn")}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={t("reservationCard.moreActions")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
            <History /> {t("admin.reservations.history")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={`/app/players/${reservation.user.id}`}>
              <Users /> {t("admin.reservations.viewPlayer")}
            </Link>
          </DropdownMenuItem>
          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onCancel}>
                <XCircle /> {t("admin.reservations.cancel")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {historyOpen && (
        <Dialog open onOpenChange={(open) => !open && setHistoryOpen(false)}>
          <HistoryDialogBody reservation={reservation} />
        </Dialog>
      )}
    </div>
  )
}

function HistoryDialogBody({ reservation }: { reservation: ReservationAdmin }) {
  const { t } = useTranslation()
  const fmt = useFormatters()
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("admin.reservations.historyDialog.title")}</DialogTitle>
        <DialogDescription>
          {reservation.court.name} · {fmt.dateRange(reservation.start_time, reservation.end_time)}
        </DialogDescription>
      </DialogHeader>
      <ReservationTimeline reservationId={reservation.id} />
    </DialogContent>
  )
}

function ReservationsTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const statusLabels = useStatusLabels()
  const [searchParams, setSearchParams] = useSearchParams()
  const linkedStatus = searchParams.get("status") as ReservationStatus | null
  const statusFilter = linkedStatus && STATUS_FILTERS.includes(linkedStatus) ? linkedStatus : null
  const [query, setQuery] = useState("")
  const [cancelTarget, setCancelTarget] = useState<ReservationAdmin | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ReservationAdmin | null>(null)
  const actions = useReservationActions()
  const { data: stats } = useAdminStats(30)

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["admin-reservations", statusFilter ?? "ALL"],
    queryFn: ({ pageParam }) => api.listAllReservations(token!, statusFilter ?? undefined, { limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined),
    enabled: Boolean(token),
  })
  const loaded = useMemo(() => data?.pages.flat() ?? [], [data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return loaded
    return loaded.filter((r) =>
      [r.court.name, r.user.name, r.user.email, ...r.guests.map((g) => g.user.name)].some((value) => value.toLowerCase().includes(q)),
    )
  }, [loaded, query])

  const exportMutation = useMutation({
    mutationFn: () => api.exportReservationsCsv(token!, statusFilter ?? undefined),
    onSuccess: () => toast.success(t("admin.reservations.exported")),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.export")),
  })

  function setStatus(next: ReservationStatus | null) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next) params.set("status", next)
        else params.delete("status")
        return params
      },
      { replace: true },
    )
  }

  const totalAll = stats ? Object.values(stats.status_breakdown).reduce((a, b) => a + b, 0) : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("admin.reservations.searchPlaceholder")}
          className="lg:w-80"
          aria-label={t("admin.reservations.searchPlaceholder")}
        />
        <Button size="sm" variant="outline" isLoading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
          {!exportMutation.isPending && <Download />} {statusFilter ? t("admin.reservations.exportFiltered") : t("admin.reservations.exportCsv")}
        </Button>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
        <FilterChip active={statusFilter === null} onClick={() => setStatus(null)} count={totalAll}>
          {t("admin.reservations.allStatuses")}
        </FilterChip>
        {STATUS_FILTERS.map((status) => (
          <FilterChip key={status} active={statusFilter === status} onClick={() => setStatus(statusFilter === status ? null : status)} count={stats?.status_breakdown[status] ?? 0}>
            {statusLabels[status]}
          </FilterChip>
        ))}
      </div>

      {isError && <ErrorState onRetry={() => refetch()} />}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {/* Desktop table */}
        <table className="hidden w-full text-left text-[13px] md:table">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="eyebrow px-4 py-2.5 font-medium">{t("admin.table.when")}</th>
              <th className="eyebrow px-4 py-2.5 font-medium">{t("admin.table.court")}</th>
              <th className="eyebrow px-4 py-2.5 font-medium">{t("admin.table.player")}</th>
              <th className="eyebrow px-4 py-2.5 font-medium">{t("admin.table.status")}</th>
              <th className="eyebrow px-4 py-2.5 text-right font-medium">
                <span className="sr-only">{t("admin.table.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-3">
                    <Skeleton className="h-9" />
                  </td>
                </tr>
              ))}
            {filtered.map((reservation) => (
              <tr key={reservation.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 align-middle">
                  <div className="flex flex-col">
                    <span className="font-medium">{fmt.dayLabel(reservation.start_time)}</span>
                    <span className="font-mono text-xs text-muted-foreground tabular">{fmt.timeRange(reservation.start_time, reservation.end_time)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    <SportIcon sport={reservation.court.sport_type} className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{reservation.court.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {reservation.open_to_join && (
                      <Badge variant="brand">
                        <Sparkles /> {t("admin.reservations.openBadge")}
                      </Badge>
                    )}
                    {reservation.guests.length > 0 && (
                      <Tooltip content={reservation.guests.map((g) => g.user.name).join(", ")}>
                        <Badge variant="secondary" tabIndex={0}>
                          <Users /> +{reservation.guests.length}
                        </Badge>
                      </Tooltip>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={reservation.user.name} avatarUrl={reservation.user.avatar_url} size="sm" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{reservation.user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{reservation.user.email}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <StatusBadge status={reservation.status} />
                  {reservation.status === "PENDING_APPROVAL" && reservation.approval_expires_at && (
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {t("admin.reservations.due", { time: fmt.dateTime(reservation.approval_expires_at) })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  <RowActions reservation={reservation} actions={actions} onCancel={() => setCancelTarget(reservation)} onReject={() => setRejectTarget(reservation)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <ul className="divide-y divide-border md:hidden">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="p-4">
                <Skeleton className="h-20" />
              </li>
            ))}
          {filtered.map((reservation) => (
            <li key={reservation.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[14px] font-semibold">{reservation.court.name}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular">{fmt.dateRange(reservation.start_time, reservation.end_time)}</span>
                </div>
                <StatusBadge status={reservation.status} />
              </div>
              <div className="flex items-center gap-2.5">
                <UserAvatar name={reservation.user.name} avatarUrl={reservation.user.avatar_url} size="xs" />
                <span className="truncate text-xs text-muted-foreground">
                  {reservation.user.name} · {reservation.user.email}
                </span>
              </div>
              <RowActions reservation={reservation} actions={actions} onCancel={() => setCancelTarget(reservation)} onReject={() => setRejectTarget(reservation)} />
            </li>
          ))}
        </ul>

        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState
            className="m-4 border-0"
            icon={ClipboardList}
            title={query ? t("admin.reservations.noMatches") : t("admin.reservations.empty.title")}
            description={query ? t("admin.reservations.noMatchesHint") : t("admin.reservations.empty.description")}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{t("admin.reservations.showing", { shown: filtered.length, loaded: loaded.length })}</span>
        {hasNextPage && (
          <Button size="sm" variant="outline" isLoading={isFetchingNextPage} onClick={() => fetchNextPage()}>
            {t("common.loadMore")}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title={t("confirmDialog.cancelReservation.title")}
        description={
          cancelTarget
            ? t("admin.reservations.cancelDescription", { name: cancelTarget.user.name, court: cancelTarget.court.name, when: fmt.dateRange(cancelTarget.start_time, cancelTarget.end_time) })
            : undefined
        }
        confirmLabel={t("confirmDialog.cancelReservation.confirm")}
        isLoading={actions.cancel.isPending}
        onConfirm={() => cancelTarget && actions.cancel.mutate(cancelTarget, { onSuccess: () => setCancelTarget(null) })}
      />
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title={t("confirmDialog.rejectReservation.title")}
        description={t("confirmDialog.rejectReservation.description")}
        confirmLabel={t("confirmDialog.rejectReservation.confirm")}
        isLoading={actions.reject.isPending}
        onConfirm={() => rejectTarget && actions.reject.mutate(rejectTarget, { onSuccess: () => setRejectTarget(null) })}
      />
    </div>
  )
}

export { ReservationsTab }
