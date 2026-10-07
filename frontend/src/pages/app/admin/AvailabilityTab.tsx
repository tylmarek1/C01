import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarOff, Repeat, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { SportIcon } from "@/components/shared/sport-icon"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useNow } from "@/lib/use-now"
import type { FacilityBlock } from "@/types"

const REASON_PRESETS = ["maintenance", "tournament", "event", "weather"] as const

function AvailabilityTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const queryClient = useQueryClient()

  const { data: courts } = useQuery({ queryKey: ["admin-courts"], queryFn: () => api.listCourts({ includeInactive: true }, token) })
  const [filterCourtId, setFilterCourtId] = useState("ALL")
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming")
  const { data: blocks, isLoading, isError, refetch } = useQuery({
    queryKey: ["facility-blocks", filterCourtId],
    queryFn: () => api.listFacilityBlocks(filterCourtId === "ALL" ? undefined : filterCourtId),
  })

  const [courtId, setCourtId] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [reason, setReason] = useState("")
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [weeks, setWeeks] = useState("4")
  const [deleteTarget, setDeleteTarget] = useState<FacilityBlock | null>(null)
  const [deleteSeriesTarget, setDeleteSeriesTarget] = useState<FacilityBlock | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["facility-blocks"] })
    queryClient.invalidateQueries({ queryKey: ["court-availability"] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.createFacilityBlock(token!, {
        court_id: courtId,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        reason: reason.trim(),
        weeks: repeatWeekly ? Number(weeks) : undefined,
      }),
    onSuccess: () => {
      toast.success(t("admin.toast.blockCreated"))
      setReason("")
      setStart("")
      setEnd("")
      setRepeatWeekly(false)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.blockCreate")),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFacilityBlock(token!, id),
    onSuccess: () => {
      toast.success(t("admin.toast.blockRemoved"))
      setDeleteTarget(null)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.blockRemove")),
  })
  const deleteSeriesMutation = useMutation({
    mutationFn: (seriesId: string) => api.deleteFacilityBlockSeries(token!, seriesId),
    onSuccess: () => {
      toast.success(t("admin.toast.blockSeriesRemoved"))
      setDeleteSeriesTarget(null)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.blockRemove")),
  })

  const weeksNumber = Number(weeks)
  const rangeInvalid = Boolean(start && end && new Date(end) <= new Date(start))
  const canSubmit =
    Boolean(courtId && start && end && reason.trim()) && !rangeInvalid && (!repeatWeekly || (weeksNumber >= 2 && weeksNumber <= 26))

  const now = useNow(60_000)
  const visible = useMemo(
    () =>
      (blocks ?? [])
        .filter((block) => (when === "upcoming" ? new Date(block.end_time).getTime() >= now : new Date(block.end_time).getTime() < now))
        .sort((a, b) =>
          when === "upcoming"
            ? new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            : new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
        ),
    [blocks, when, now],
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="h-fit gap-5 lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="size-4 text-muted-foreground" /> {t("admin.availability.blockTitle")}
          </CardTitle>
          <CardDescription>{t("admin.availability.blockDescription")}</CardDescription>
        </CardHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSubmit) createMutation.mutate()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label>{t("admin.availability.court")}</Label>
            <Select value={courtId} onValueChange={setCourtId}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.availability.choosePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {courts?.map((court) => (
                  <SelectItem key={court.id} value={court.id}>
                    {court.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-start">{t("admin.availability.from")}</Label>
              <Input id="block-start" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-end">{t("admin.availability.to")}</Label>
              <Input id="block-end" type="datetime-local" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} aria-invalid={rangeInvalid} />
            </div>
          </div>
          {rangeInvalid && <p className="-mt-2 text-xs text-danger">{t("admin.availability.rangeInvalid")}</p>}
          <div className="flex flex-col gap-2">
            <Label htmlFor="block-reason">{t("admin.availability.reason")}</Label>
            <Input id="block-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("admin.availability.reasonPlaceholder")} maxLength={200} />
            <div className="flex flex-wrap gap-1">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(t(`admin.availability.preset.${preset}`))}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  {t(`admin.availability.preset.${preset}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border p-3">
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-[13px] font-medium">
                <Repeat className="size-3.5" /> {t("admin.availability.repeatWeekly")}
              </span>
              <span className="text-xs text-muted-foreground">{t("admin.availability.repeatWeeklyHint")}</span>
            </span>
            <Switch checked={repeatWeekly} onCheckedChange={setRepeatWeekly} aria-label={t("admin.availability.repeatWeekly")} />
          </label>
          {repeatWeekly && (
            <div className="flex animate-fade-in flex-col gap-2">
              <Label htmlFor="block-weeks">{t("admin.availability.weeks")}</Label>
              <Input id="block-weeks" type="number" min={2} max={26} value={weeks} onChange={(event) => setWeeks(event.target.value)} />
            </div>
          )}
          <Button type="submit" disabled={!canSubmit} isLoading={createMutation.isPending}>
            {createMutation.isPending ? t("admin.availability.submitting") : t("admin.availability.submit")}
          </Button>
        </form>
      </Card>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={when} onValueChange={(value) => setWhen(value as "upcoming" | "past")} className="gap-0">
            <TabsList>
              <TabsTrigger value="upcoming">{t("admin.availability.upcoming")}</TabsTrigger>
              <TabsTrigger value="past">{t("admin.availability.past")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={filterCourtId} onValueChange={setFilterCourtId}>
            <SelectTrigger className="w-52" aria-label={t("admin.availability.filterCourt")}>
              <SelectValue placeholder={t("admin.availability.filterCourt")} />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="ALL">{t("admin.availability.allCourts")}</SelectItem>
              {courts?.map((court) => (
                <SelectItem key={court.id} value={court.id}>
                  {court.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 w-full rounded-xl" />)}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && visible.length === 0 && (
          <EmptyState icon={CalendarOff} title={t("admin.availability.empty.title")} description={t("admin.availability.empty.description")} />
        )}
        <div className="stagger flex flex-col gap-2">
          {visible.map((block, index) => {
            const ongoing = new Date(block.start_time).getTime() <= now && new Date(block.end_time).getTime() >= now
            return (
              <article
                key={block.id}
                style={{ "--i": index } as React.CSSProperties}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center",
                  ongoing ? "border-danger/30" : "border-border",
                  when === "past" && "opacity-75",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger">
                  <SportIcon sport={block.court.sport_type} className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold">{block.court.name}</span>
                    {ongoing && <Badge variant="destructive" dot>{t("admin.availability.ongoing")}</Badge>}
                    {block.series_id && (
                      <Badge variant="outline">
                        <Repeat /> {t("admin.availability.recurring")}
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono text-[12.5px] text-foreground/85 tabular">{fmt.dateRange(block.start_time, block.end_time)}</span>
                  <span className="text-[13px] text-muted-foreground">{block.reason}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  {block.series_id && (
                    <Button size="sm" variant="outline" onClick={() => setDeleteSeriesTarget(block)}>
                      {t("admin.availability.removeSeries")}
                    </Button>
                  )}
                  <Button size="sm" variant="destructive-ghost" onClick={() => setDeleteTarget(block)}>
                    <Trash2 /> {t("admin.availability.remove")}
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("confirmDialog.deleteBlock.title")}
        description={t("confirmDialog.deleteBlock.description")}
        confirmLabel={t("admin.availability.remove")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
      <ConfirmDialog
        open={Boolean(deleteSeriesTarget)}
        onOpenChange={(open) => !open && setDeleteSeriesTarget(null)}
        title={t("confirmDialog.deleteBlockSeries.title")}
        description={t("confirmDialog.deleteBlockSeries.description")}
        confirmLabel={t("admin.availability.removeSeries")}
        isLoading={deleteSeriesMutation.isPending}
        onConfirm={() => deleteSeriesTarget?.series_id && deleteSeriesMutation.mutate(deleteSeriesTarget.series_id)}
      />
    </div>
  )
}

export { AvailabilityTab }
