import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarCheck2, CalendarClock, Clock3, Hourglass, Info, Repeat, ShieldCheck, Sparkles, Timer } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Countdown } from "@/components/shared/countdown"
import { CourtArt } from "@/components/shared/court-art"
import { CourtCard } from "@/components/shared/court-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { FilterChip } from "@/components/shared/filter-chip"
import { OccupancyTimeline } from "@/components/shared/occupancy-timeline"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { DayStrip, SlotGrid, type Slot } from "@/components/shared/slot-picker"
import { useSportLabels } from "@/components/shared/sport-icon"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { addDays, formatCurrency, todayDateString, useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { useCourts } from "@/lib/queries"
import { firstBookableDate } from "@/lib/slots"
import { cn } from "@/lib/utils"
import type { Court, Reservation, SportType } from "@/types"

const DURATIONS = [60, 90, 120]
const SERIES_WEEK_OPTIONS = [2, 4, 6, 8, 10, 12]
const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]

function Step({ index, title, done, children }: { index: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em]">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold transition-colors",
            done ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {index}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function BookCourtPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const sportLabels = useSportLabels()

  const { data: courts, isLoading, isError, refetch } = useCourts()
  const { data: recommendedCourts } = useQuery({
    queryKey: ["courts-recommended"],
    queryFn: () => api.listRecommendedCourts(token!),
    enabled: Boolean(token),
  })
  const { data: favorites } = useQuery({
    queryKey: ["favorites-mine"],
    queryFn: () => api.listMyFavorites(token!),
    enabled: Boolean(token),
  })

  const [courtQuery, setCourtQuery] = useState("")
  const [sportFilter, setSportFilter] = useState<SportType | null>(null)
  const [courtPickerOpen, setCourtPickerOpen] = useState(true)
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null)
  const [date, setDate] = useState(() => {
    const param = searchParams.get("date")
    return param && /^\d{4}-\d{2}-\d{2}$/.test(param) && param >= todayDateString() ? param : firstBookableDate()
  })
  const [duration, setDuration] = useState(60)
  const [selectedStart, setSelectedStart] = useState<string | null>(searchParams.get("start"))
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [weeks, setWeeks] = useState("4")
  const [heldReservation, setHeldReservation] = useState<Reservation | null>(null)
  const [waitlistSlot, setWaitlistSlot] = useState<Slot | null>(null)

  // Prefill from ?court= (court detail "Book", "Book again", command menu).
  const prefillCourtId = searchParams.get("court")
  useEffect(() => {
    if (!prefillCourtId || !courts || selectedCourt) return
    const match = courts.find((court) => court.id === prefillCourtId)
    if (match) {
      setSelectedCourt(match)
      setCourtPickerOpen(false)
    }
  }, [prefillCourtId, courts, selectedCourt])

  const { data: availability, isLoading: isLoadingAvailability } = useQuery({
    queryKey: ["court-availability", selectedCourt?.id, date],
    queryFn: () => api.getCourtAvailability(selectedCourt!.id, date),
    enabled: Boolean(selectedCourt),
  })

  function chooseCourt(court: Court) {
    setSelectedCourt(court)
    setSelectedStart(null)
    setCourtPickerOpen(false)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set("court", court.id)
        next.delete("start")
        return next
      },
      { replace: true },
    )
  }

  const favoriteIds = new Set(favorites?.map((c) => c.id) ?? [])
  const recommendedIds = new Set(recommendedCourts?.map((c) => c.id) ?? [])
  const visibleCourts = useMemo(() => {
    const q = courtQuery.trim().toLowerCase()
    return (courts ?? [])
      .filter((court) => (sportFilter ? court.sport_type === sportFilter : true))
      .filter((court) => (q ? court.name.toLowerCase().includes(q) : true))
      .sort((a, b) => Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id)) || Number(recommendedIds.has(b.id)) - Number(recommendedIds.has(a.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courts, courtQuery, sportFilter, favorites, recommendedCourts])

  const start = selectedStart ? new Date(selectedStart) : null
  const end = start ? new Date(start.getTime() + duration * 60_000) : null
  const estimatedCost = selectedCourt?.price_per_hour != null ? (selectedCourt.price_per_hour * duration) / 60 : null
  const seriesLastDate = start && repeatWeekly ? addDays(start, (Number(weeks) - 1) * 7) : null

  const joinWaitlistMutation = useMutation({
    mutationFn: (slot: { start: Date; end: Date }) =>
      api.joinWaitlist(token!, selectedCourt!.id, slot.start.toISOString(), slot.end.toISOString()),
    onSuccess: () => {
      setWaitlistSlot(null)
      toast.success(t("book.toast.waitlistJoined"))
      queryClient.invalidateQueries({ queryKey: ["waitlist-mine"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("book.error.waitlistJoin")),
  })

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourt || !start || !end) throw new Error(t("book.error.incomplete"))
      if (repeatWeekly) {
        return api.createReservationSeries(token!, {
          court_id: selectedCourt.id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          weeks: Number(weeks),
        })
      }
      return api.createReservation(token!, selectedCourt.id, start.toISOString(), end.toISOString())
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] })
      queryClient.invalidateQueries({ queryKey: ["court-availability", selectedCourt?.id] })
      if (result && "booked" in result) {
        const { booked, failed_weeks: failedWeeks, requested_occurrences: requested } = result
        toast.success(
          failedWeeks.length === 0
            ? t("book.toast.seriesBookedAll", { booked: booked.length, requested })
            : t("book.toast.seriesBookedPartial", { booked: booked.length, requested, weeks: failedWeeks.join(", ") }),
        )
        navigate("/app")
      } else if (result) {
        setHeldReservation(result)
      }
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : t("book.error.create")
      const canWaitlist = error instanceof ApiError && error.status === 409 && message.toLowerCase().includes("waitlist")
      toast.error(
        message,
        canWaitlist && start && end
          ? { action: { label: t("book.waitlistAction"), onClick: () => joinWaitlistMutation.mutate({ start, end }) } }
          : undefined,
      )
      queryClient.invalidateQueries({ queryKey: ["court-availability", selectedCourt?.id] })
    },
  })

  const confirmHeldMutation = useMutation({
    mutationFn: (reservation: Reservation) => api.confirmReservation(token!, reservation.id),
    onSuccess: (confirmed) => {
      toast.success(t(confirmed.status === "PENDING_APPROVAL" ? "dashboard.toast.submitted" : "dashboard.toast.confirmed"))
      queryClient.invalidateQueries({ queryKey: ["reservations"] })
      setHeldReservation(null)
      navigate("/app")
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.confirm")),
  })

  const canSubmit = Boolean(selectedCourt && start) && !bookMutation.isPending

  return (
    <PageContainer size="wide">
      <PageHeader title={t("book.title")} description={t("book.description")} />

      <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0">
        <div className="flex min-w-0 flex-col gap-4">
          <Step index={1} title={t("book.step1")} done={Boolean(selectedCourt)}>
            {selectedCourt && !courtPickerOpen ? (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <CourtCard court={selectedCourt} selected />
                </div>
                <Button variant="outline" size="sm" onClick={() => setCourtPickerOpen(true)}>
                  {t("book.changeCourt")}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <SearchInput
                    value={courtQuery}
                    onValueChange={setCourtQuery}
                    placeholder={t("courts.search.placeholder")}
                    className="sm:max-w-xs sm:flex-1"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {SPORTS.map((sport) => (
                      <FilterChip key={sport} active={sportFilter === sport} onClick={() => setSportFilter((s) => (s === sport ? null : sport))}>
                        {sportLabels[sport]}
                      </FilterChip>
                    ))}
                  </div>
                </div>
                {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[66px] w-full" />)}
                {isError && <ErrorState size="compact" onRetry={() => refetch()} />}
                {!isLoading && visibleCourts.length === 0 && (
                  <EmptyState size="compact" title={t("courts.empty.title")} description={t("courts.empty.description")} />
                )}
                <div className="stagger grid gap-2 sm:grid-cols-2">
                  {visibleCourts.map((court, index) => (
                    <div key={court.id} style={{ "--i": index } as React.CSSProperties} className="relative">
                      <CourtCard court={court} selected={selectedCourt?.id === court.id} onSelect={chooseCourt} />
                      {(favoriteIds.has(court.id) || recommendedIds.has(court.id)) && (
                        <span className="pointer-events-none absolute -top-2 right-3">
                          <Badge variant={favoriteIds.has(court.id) ? "solid" : "brand"} className="shadow-xs">
                            {favoriteIds.has(court.id) ? t("book.badge.favorite") : t("book.suggestions.recommended")}
                          </Badge>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Step>

          <Step index={2} title={t("book.step2")} done={Boolean(start)}>
            {!selectedCourt ? (
              <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-3 text-[13px] text-muted-foreground">
                <Info className="size-4 shrink-0" /> {t("book.pickCourtFirst")}
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                <DayStrip
                  value={date}
                  onChange={(next) => {
                    setDate(next)
                    setSelectedStart(null)
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[13px] font-medium">{t("book.duration")}</span>
                  <Tabs
                    value={String(duration)}
                    onValueChange={(value) => {
                      setDuration(Number(value))
                      setSelectedStart(null)
                    }}
                  >
                    <TabsList>
                      {DURATIONS.map((option) => (
                        <TabsTrigger key={option} value={String(option)}>
                          {fmt.duration(option)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {isLoadingAvailability && (
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-9 w-full" />
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <Skeleton key={i} className="h-9" />
                      ))}
                    </div>
                  </div>
                )}
                {availability && (
                  <>
                    <OccupancyTimeline opensAt={availability.opens_at} closesAt={availability.closes_at} busy={availability.busy} />
                    <SlotGrid
                      availability={availability}
                      durationMinutes={duration}
                      selected={selectedStart}
                      onSelect={(slot) => setSelectedStart(slot.start.toISOString())}
                      onTakenSelect={(slot) => setWaitlistSlot(slot)}
                    />
                  </>
                )}
              </div>
            )}
          </Step>
        </div>

        {/* Summary — sticky on desktop, a bottom bar on mobile. */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="hidden flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:flex">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("book.summary.title")}</h2>
            {selectedCourt ? (
              <div className="flex items-center gap-3">
                <CourtArt sport={selectedCourt.sport_type} imageUrl={selectedCourt.image_url} compact className="size-12 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] font-semibold">{selectedCourt.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {sportLabels[selectedCourt.sport_type]} · {selectedCourt.indoor ? t("courts.indoor") : t("courts.outdoor")}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">{t("book.summary.empty")}</p>
            )}

            <dl className="flex flex-col divide-y divide-border rounded-lg border border-border text-[13px]">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <CalendarClock className="size-3.5" /> {t("book.date")}
                </dt>
                <dd className="font-medium">{fmt.date(new Date(`${date}T12:00:00`))}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Clock3 className="size-3.5" /> {t("book.time")}
                </dt>
                <dd className={cn("font-mono font-medium tabular", !start && "text-subtle-foreground")}>
                  {start && end ? fmt.timeRange(start.toISOString(), end.toISOString()) : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="size-3.5" /> {t("book.duration")}
                </dt>
                <dd className="font-medium">{fmt.duration(duration)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 bg-muted/50 px-3 py-2.5">
                <dt className="font-medium">{t("book.summary.estimate")}</dt>
                <dd className="text-[15px] font-semibold tabular">
                  {estimatedCost !== null ? formatCurrency(estimatedCost * (repeatWeekly ? Number(weeks) : 1)) : t("courts.priceUnset")}
                </dd>
              </div>
            </dl>

            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border p-3">
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  <Repeat className="size-3.5" /> {t("book.repeatWeekly.label")}
                </span>
                <span className="text-xs text-muted-foreground">{t("book.repeatWeekly.description")}</span>
              </span>
              <Switch checked={repeatWeekly} onCheckedChange={setRepeatWeekly} aria-label={t("book.repeatWeekly.label")} />
            </label>
            {repeatWeekly && (
              <div className="flex animate-fade-in items-center justify-between gap-3">
                <Select value={weeks} onValueChange={setWeeks}>
                  <SelectTrigger className="w-36" aria-label={t("book.repeatWeekly.weeksLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERIES_WEEK_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {t("book.repeatWeekly.weeksOption", { count: option })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {seriesLastDate && (
                  <span className="text-right text-xs text-muted-foreground">{t("book.repeatWeekly.until", { date: fmt.dayMonth(seriesLastDate) })}</span>
                )}
              </div>
            )}

            {selectedCourt?.requires_approval && (
              <p className="flex gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-xs leading-relaxed text-info">
                <ShieldCheck className="mt-px size-4 shrink-0" /> {t("book.requiresApprovalNote")}
              </p>
            )}

            <Button variant="brand" size="lg" className="w-full" disabled={!canSubmit} isLoading={bookMutation.isPending} onClick={() => bookMutation.mutate()}>
              {bookMutation.isPending ? t("book.submitting") : t("book.submit")}
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Hourglass className="size-3.5 shrink-0" /> {t("book.holdHint")}
            </p>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-semibold">{selectedCourt?.name ?? t("book.summary.empty")}</span>
              <span className="truncate font-mono text-xs text-muted-foreground tabular">
                {start && end ? `${fmt.date(start)} · ${fmt.timeRange(start.toISOString(), end.toISOString())}` : t("book.summary.pickTime")}
                {estimatedCost !== null && start ? ` · ${formatCurrency(estimatedCost)}` : ""}
              </span>
            </div>
            <Button variant="brand" disabled={!canSubmit} isLoading={bookMutation.isPending} onClick={() => bookMutation.mutate()}>
              {t("book.submit")}
            </Button>
          </div>
        </aside>
      </div>

      {/* After a single booking: the hold is live — confirming right here beats a detour to the dashboard. */}
      <Dialog open={Boolean(heldReservation)} onOpenChange={(open) => {
          if (open) return
          setHeldReservation(null)
          navigate("/app")
        }}>
        <DialogContent className="sm:max-w-sm">
          {heldReservation && (
            <>
              <div className="flex size-11 items-center justify-center rounded-xl bg-brand text-brand-foreground">
                <CalendarCheck2 className="size-5" />
              </div>
              <DialogHeader>
                <DialogTitle>{t("book.held.title")}</DialogTitle>
                <DialogDescription>
                  {t("book.held.description", {
                    court: heldReservation.court.name,
                    when: fmt.dateRange(heldReservation.start_time, heldReservation.end_time),
                  })}
                </DialogDescription>
              </DialogHeader>
              {heldReservation.hold_expires_at && (
                <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
                  <span className="text-[13px] font-medium text-warning">{t("book.held.expiresIn")}</span>
                  <Countdown
                    to={heldReservation.hold_expires_at}
                    className="text-xl font-semibold text-warning"
                    onExpire={() => {
                      toast.error(t("book.held.expired"))
                      setHeldReservation(null)
                      queryClient.invalidateQueries({ queryKey: ["reservations"] })
                    }}
                  />
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" asChild>
                  <Link to="/app">{t("book.held.later")}</Link>
                </Button>
                <Button
                  variant="brand"
                  isLoading={confirmHeldMutation.isPending}
                  onClick={() => confirmHeldMutation.mutate(heldReservation)}
                >
                  {heldReservation.court.requires_approval ? t("reservationCard.requestApproval") : t("book.held.confirm")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(waitlistSlot)}
        onOpenChange={(open) => !open && setWaitlistSlot(null)}
        destructive={false}
        title={t("book.waitlist.title")}
        description={
          waitlistSlot && selectedCourt
            ? t("book.waitlist.description", {
                court: selectedCourt.name,
                when: fmt.dateRange(waitlistSlot.start.toISOString(), waitlistSlot.end.toISOString()),
              })
            : undefined
        }
        confirmLabel={t("book.waitlistAction")}
        isLoading={joinWaitlistMutation.isPending}
        onConfirm={() => waitlistSlot && joinWaitlistMutation.mutate(waitlistSlot)}
      />

      {!selectedCourt && !isLoading && courts && courts.length > 0 && (
        <p className="mt-2 hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
          <Sparkles className="size-3.5" /> {t("book.tip")}{" "}
          <Link to="/courts" className="font-medium text-foreground underline underline-offset-2">
            {t("book.tipLink")}
          </Link>
        </p>
      )}
    </PageContainer>
  )
}

export { BookCourtPage }

