import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ArrowRight, CalendarClock, Check, Clock3, Inbox, LayoutGrid, Users, X } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarList, ColumnChart } from "@/components/shared/charts"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Countdown } from "@/components/shared/countdown"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { StatTile } from "@/components/shared/stat-tile"
import { StatusBadge } from "@/components/shared/status-badge"
import { UserAvatar } from "@/components/shared/user-avatar"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { useAdminStats } from "@/lib/queries"
import { useStatusLabels } from "@/lib/reservation-status"
import type { ReservationAdmin, ReservationStatus } from "@/types"
import { useReservationActions } from "@/pages/app/admin/use-reservation-actions"

const STATUS_ORDER: ReservationStatus[] = [
  "PENDING",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "REJECTED",
  "NO_SHOW",
]
const STATS_WINDOW_OPTIONS = [7, 30, 90] as const

function ApprovalQueue() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const actions = useReservationActions()
  const [rejectTarget, setRejectTarget] = useState<ReservationAdmin | null>(null)
  const { data: queue, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-reservations", "PENDING_APPROVAL", "queue"],
    queryFn: () => api.listAllReservations(token!, "PENDING_APPROVAL", { limit: 50 }),
    enabled: Boolean(token),
  })
  // Soonest decision deadline first — that's the one that lapses next.
  const sorted = [...(queue ?? [])].sort(
    (a, b) => new Date(a.approval_expires_at ?? a.start_time).getTime() - new Date(b.approval_expires_at ?? b.start_time).getTime(),
  )

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="size-4 text-muted-foreground" /> {t("admin.queue.title")}
          {queue && queue.length > 0 && (
            <span className="rounded-full bg-brand px-1.5 font-mono text-[11px] text-brand-foreground tabular">{queue.length}</span>
          )}
        </CardTitle>
        <CardDescription>{t("admin.queue.description")}</CardDescription>
      </CardHeader>
      {isLoading && <Skeleton className="h-24" />}
      {isError && <ErrorState size="compact" onRetry={() => refetch()} />}
      {queue && queue.length === 0 && <EmptyState size="compact" icon={Check} title={t("admin.queue.empty.title")} description={t("admin.queue.empty.description")} />}
      {sorted.length > 0 && (
        <ul className="stagger -mx-1 flex flex-col divide-y divide-border">
          {sorted.slice(0, 6).map((reservation, index) => (
            <li key={reservation.id} style={{ "--i": index } as React.CSSProperties} className="flex flex-wrap items-center gap-3 px-1 py-3">
              <UserAvatar name={reservation.user.name} avatarUrl={reservation.user.avatar_url} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium">
                  {reservation.user.name} · <span className="text-muted-foreground">{reservation.court.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-mono">{fmt.dateRange(reservation.start_time, reservation.end_time)}</span>
                  {reservation.approval_expires_at && (
                    <>
                      {" · "}
                      {t("admin.queue.decideWithin")} <Countdown to={reservation.approval_expires_at} className="font-medium text-info" />
                    </>
                  )}
                </span>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" disabled={actions.isBusy} onClick={() => setRejectTarget(reservation)}>
                  <X /> {t("admin.reservations.reject")}
                </Button>
                <Button size="sm" disabled={actions.isBusy} onClick={() => actions.approve.mutate(reservation)}>
                  <Check /> {t("admin.reservations.approve")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {queue && queue.length > 6 && (
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link to="/app/admin?tab=reservations&status=PENDING_APPROVAL">
            {t("common.viewAll")} <ArrowRight />
          </Link>
        </Button>
      )}
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title={t("confirmDialog.rejectReservation.title")}
        description={t("confirmDialog.rejectReservation.description")}
        confirmLabel={t("confirmDialog.rejectReservation.confirm")}
        isLoading={actions.reject.isPending}
        onConfirm={() => rejectTarget && actions.reject.mutate(rejectTarget, { onSuccess: () => setRejectTarget(null) })}
      />
    </Card>
  )
}

function OverviewTab() {
  const { t } = useTranslation()
  const fmt = useFormatters()
  const statusLabels = useStatusLabels()
  const [windowDays, setWindowDays] = useState<(typeof STATS_WINDOW_OPTIONS)[number]>(30)
  const { data: stats, isLoading, isError, refetch } = useAdminStats(windowDays)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[104px]" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (isError || !stats) return <ErrorState onRetry={() => refetch()} />

  const pending = stats.status_breakdown["PENDING_APPROVAL"] ?? 0
  const hourly = Array.from({ length: 15 }, (_, i) => 7 + i).map((hour) => ({
    key: String(hour),
    label: String(hour),
    value: stats.busiest_hours.find((h) => h.hour === hour)?.count ?? 0,
    tooltip: t("admin.overview.hourTooltip", { hour: `${String(hour).padStart(2, "0")}:00`, count: stats.busiest_hours.find((h) => h.hour === hour)?.count ?? 0 }),
  }))
  const peak = [...hourly].sort((a, b) => b.value - a.value)[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">{t("admin.overview.windowHint")}</p>
        <Tabs value={String(windowDays)} onValueChange={(value) => setWindowDays(Number(value) as (typeof STATS_WINDOW_OPTIONS)[number])} className="gap-0">
          <TabsList aria-label={t("admin.overview.window")}>
            {STATS_WINDOW_OPTIONS.map((days) => (
              <TabsTrigger key={days} value={String(days)}>
                {t("admin.overview.windowDays", { days })}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          icon={Clock3}
          label={t("status.PENDING_APPROVAL")}
          value={pending}
          tone={pending > 0 ? "attention" : "default"}
          hint={pending > 0 ? t("dashboard.venueSnapshot.reviewRequests") : t("dashboard.venueSnapshot.queueClear")}
          to="/app/admin?tab=reservations&status=PENDING_APPROVAL"
        />
        <StatTile
          icon={CalendarClock}
          label={t("admin.overview.reservationsInWindow", { days: stats.window_days })}
          value={fmt.number(stats.reservations_in_window)}
          hint={t("admin.overview.totalAllTime", { count: fmt.number(stats.total_reservations) })}
        />
        <StatTile icon={AlertTriangle} label={t("admin.overview.noShowRate")} value={fmt.percent(stats.no_show_rate)} hint={t("admin.overview.noShowHint")} />
        <StatTile icon={Users} label={t("admin.overview.players")} value={fmt.number(stats.total_users)} to="/app/admin?tab=users" />
        <StatTile icon={LayoutGrid} label={t("admin.overview.courts")} value={stats.total_courts} to="/app/admin?tab=courts" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <ApprovalQueue />
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.overview.busiestHoursTitle")}</CardTitle>
            <CardDescription>
              {peak && peak.value > 0
                ? t("admin.overview.peakHour", { hour: `${peak.label.padStart(2, "0")}:00` })
                : t("admin.overview.busiestHoursDescription")}
            </CardDescription>
          </CardHeader>
          <ColumnChart data={hourly} tickEvery={2} ariaLabel={t("admin.overview.busiestHoursTitle")} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.overview.statusTitle")}</CardTitle>
            <CardDescription>{t("admin.overview.statusDescription")}</CardDescription>
          </CardHeader>
          <BarList
            ariaLabel={t("admin.overview.statusTitle")}
            data={STATUS_ORDER.map((status) => ({ key: status, label: statusLabels[status], value: stats.status_breakdown[status] ?? 0 }))}
            renderLabel={(datum) => <StatusBadge status={datum.key as ReservationStatus} />}
            formatValue={fmt.number}
          />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.overview.topCourtsTitle")}</CardTitle>
            <CardDescription>{t("admin.overview.topCourtsDescription")}</CardDescription>
          </CardHeader>
          {stats.top_courts.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">{t("admin.overview.topCourtsEmpty")}</p>
          ) : (
            <BarList
              ariaLabel={t("admin.overview.topCourtsTitle")}
              data={stats.top_courts.map((entry) => ({ key: entry.court.id, label: entry.court.name, value: entry.reservation_count }))}
              renderLabel={(datum) => (
                <Link to={`/courts/${datum.key}`} className="hover:underline">
                  {datum.label}
                </Link>
              )}
              formatValue={fmt.number}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

export { OverviewTab }
