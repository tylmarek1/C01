import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Hourglass, Info, Repeat, ShieldCheck, Sparkles } from "lucide-react"
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

/** A numbered section of the booking form, set like a programme chapter:
 * heavy rule, a big condensed numeral that turns clay once the step is done. */
function Step({ index, title, done, aside, children }: { index: number; title: string; done?: boolean; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t-2 border-foreground pt-4 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-6">
      <span
        aria-hidden
        className={cn("display hidden text-[56px] transition-colors duration-300 sm:block", done ? "text-brand" : "text-foreground/25")}
      >
        {String(index).padStart(2, "0")}
      </span>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-h-9 items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-[26px] leading-none font-extrabold uppercase">
            <span aria-hidden className={cn("tabular sm:hidden", done ? "text-brand" : "text-foreground/30")}>
              {String(index).padStart(2, "0")}
            </span>
            <span className="sr-only">{index}.</span>
            {title}
            {done && <Check className="size-5 animate-pop text-brand" aria-hidden />}
          </h2>
          {aside}
        </div>
        {children}
      </div>
    </section>
  )
}

/** One label/value line on the court pass. */
function PassRow({ label, children, muted }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-panel-foreground/20 py-2 last:border-b-0">
      <dt className="font-mono text-[10.5px] tracking-[0.08em] text-panel-muted uppercase">{label}</dt>
      <dd className={cn("font-mono text-[14px] font-medium tabular", muted && "text-panel-muted")}>{children}</dd>
    </div>
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
  // Once a time is picked the backend quotes it from the court's rates by day
  // and time (ADR-009); before that, the base rate gives a first idea.
  const { data: quote, isFetching: isQuoting } = useQuery({
    queryKey: ["price-quote", selectedCourt?.id, selectedStart, duration],
    queryFn: () => api.getPriceQuote(selectedCourt!.id, start!.toISOString(), end!.toISOString()),
    enabled: Boolean(selectedCourt && start),
  })
  const basePrice = selectedCourt?.price_per_hour ?? null
  const estimatedCost = start ? (quote?.price_total ?? null) : basePrice !== null ? (basePrice * duration) / 60 : null
  const priceLabel = start ? t("book.summary.price") : t("book.summary.estimate")
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
      <PageHeader eyebrow={t("book.eyebrow")} title={t("book.title")} description={t("book.description")} />

      <div className="grid gap-10 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
        <div className="flex min-w-0 flex-col gap-10">
          <Step
            index={1}
            title={t("book.step1")}
            done={Boolean(selectedCourt) && !courtPickerOpen}
            aside={
              selectedCourt && !courtPickerOpen ? (
                <Button variant="outline" size="sm" onClick={() => setCourtPickerOpen(true)}>
                  {t("book.changeCourt")}
                </Button>
              ) : null
            }
          >
            {selectedCourt && !courtPickerOpen ? (
              <div className="animate-fade-in">
                <CourtCard court={selectedCourt} selected />
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
                <div className="stagger grid gap-2 pt-1 sm:grid-cols-2">
                  {visibleCourts.map((court, index) => (
                    <div key={court.id} style={{ "--i": index } as React.CSSProperties} className="relative">
                      <CourtCard court={court} selected={selectedCourt?.id === court.id} onSelect={chooseCourt} />
                      {(favoriteIds.has(court.id) || recommendedIds.has(court.id)) && (
                        <span className="pointer-events-none absolute -top-2 right-3">
                          <Badge variant={favoriteIds.has(court.id) ? "solid" : "brand"}>
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

          <Step
            index={2}
            title={t("book.step2")}
            done={Boolean(start)}
            aside={
              start && end ? (
                <span key={selectedStart} className="animate-fade-in border-2 border-brand px-2 py-1 font-mono text-[13px] font-semibold text-brand-ink tabular">
                  {fmt.weekday(start)} {fmt.timeRange(start.toISOString(), end.toISOString())}
                </span>
              ) : null
            }
          >
            {!selectedCourt ? (
              <p className="flex items-center gap-2 border border-dashed border-foreground/25 px-3 py-4 text-[13px] text-muted-foreground">
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
                  <span className="eyebrow">{t("book.duration")}</span>
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
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-px">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 rounded-none" />
                      ))}
                    </div>
                  </div>
                )}
                {availability && (
                  <>
                    <OccupancyTimeline
                      opensAt={availability.opens_at}
                      closesAt={availability.closes_at}
                      busy={availability.busy}
                      pick={{
                        durationMinutes: duration,
                        selected: selectedStart,
                        onSelect: (slot) => setSelectedStart(slot.start.toISOString()),
                        onTakenSelect: (slot) => setWaitlistSlot(slot),
                      }}
                    />
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

        {/* Summary — the court pass: sticky on desktop, a bottom bar on mobile. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="ticket-h hidden flex-col rounded-md bg-panel text-panel-foreground lg:flex" style={{ "--perf-y": "calc(100% - 13.5rem)" } as React.CSSProperties}>
            <div className="flex flex-col gap-4 p-6 pb-5">
              <div className="flex items-center justify-between font-mono text-[10.5px] tracking-[0.1em] text-panel-muted uppercase">
                <span>{t("book.summary.pass")}</span>
                <span>Courtly</span>
              </div>
              <div className="flex min-h-[4.5rem] flex-col justify-end gap-1.5">
                {selectedCourt ? (
                  <>
                    <span key={selectedCourt.id} className="display animate-fade-up text-[38px]">
                      {selectedCourt.name}
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.06em] text-panel-muted uppercase">
                      {sportLabels[selectedCourt.sport_type]} · {selectedCourt.indoor ? t("courts.indoor") : t("courts.outdoor")}
                    </span>
                  </>
                ) : (
                  <span className="display text-[38px] text-panel-foreground/30">{t("book.summary.empty")}</span>
                )}
              </div>
              <dl className="flex flex-col">
                <PassRow label={t("book.date")}>{fmt.date(new Date(`${date}T12:00:00`))}</PassRow>
                <PassRow label={t("book.time")} muted={!start}>
                  {start && end ? (
                    <span key={selectedStart} className="inline-block animate-fade-in">
                      {fmt.timeRange(start.toISOString(), end.toISOString())}
                    </span>
                  ) : (
                    "--:--"
                  )}
                </PassRow>
                <PassRow label={t("book.duration")}>{fmt.duration(duration)}</PassRow>
              </dl>
              {selectedCourt?.requires_approval && (
                <p className="flex gap-2 border border-panel-foreground/20 px-3 py-2.5 text-xs leading-relaxed text-panel-foreground">
                  <ShieldCheck className="mt-px size-4 shrink-0" /> {t("book.requiresApprovalNote")}
                </p>
              )}
            </div>

            {/* below the perforation */}
            <div className="flex h-[13.5rem] flex-col gap-3 border-t-2 border-dashed border-panel-foreground/25 px-6 pt-5 pb-6">
              <div className="flex items-end justify-between gap-3">
                <span className="font-mono text-[10.5px] tracking-[0.08em] text-panel-muted uppercase">{priceLabel}</span>
                <span className="display text-[40px] normal-case! tabular">
                  {start && isQuoting
                    ? "…"
                    : estimatedCost !== null
                      ? formatCurrency(estimatedCost * (repeatWeekly ? Number(weeks) : 1))
                      : t("courts.priceUnset")}
                </span>
              </div>
              <Button
                variant="brand"
                size="lg"
                className="w-full"
                disabled={!canSubmit}
                isLoading={bookMutation.isPending}
                onClick={() => bookMutation.mutate()}
              >
                {bookMutation.isPending ? t("book.submitting") : start ? t("book.submit") : t("book.summary.pickTime")}
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-panel-muted">
                <Hourglass className="size-3.5 shrink-0" /> {t("book.holdHint")}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-foreground pt-4">
            <label className="flex cursor-pointer items-start justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
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
          </div>

          {/* Mobile: a pass stub pinned above the tab bar. */}
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 bg-panel px-4 py-3 text-panel-foreground lg:hidden">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-display text-[19px] leading-none font-extrabold uppercase">
                {selectedCourt?.name ?? t("book.summary.empty")}
              </span>
              <span className="truncate font-mono text-[11px] text-panel-muted tabular">
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
              <span
                aria-hidden
                className="absolute top-5 right-12 animate-stamp border-[3px] border-brand px-2.5 py-1 font-display text-[22px] leading-none font-black tracking-[0.06em] text-brand uppercase"
                style={{ "--stamp-rotate": "-8deg" } as React.CSSProperties}
              >
                {t("book.held.stamp")}
              </span>
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
                <div className="flex items-end justify-between border-y-2 border-foreground py-3">
                  <span className="eyebrow pb-1">{t("book.held.expiresIn")}</span>
                  <Countdown
                    to={heldReservation.hold_expires_at}
                    className="display text-[44px] text-foreground"
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
        <p className="mt-8 hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
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

