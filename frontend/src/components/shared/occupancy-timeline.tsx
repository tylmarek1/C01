import { Tooltip } from "@/components/ui/tooltip"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useNow } from "@/lib/use-now"
import type { BusySlot } from "@/types"

interface OccupancyTimelineProps {
  opensAt: string
  closesAt: string
  busy: BusySlot[]
  className?: string
  /** Hide the legend + summary line (when shown next to a slot grid that explains itself). */
  compact?: boolean
}

/** One-day strip from opening to closing time with every busy interval drawn on it. */
function OccupancyTimeline({ opensAt, closesAt, busy, className, compact = false }: OccupancyTimelineProps) {
  const { t } = useTranslation()
  const fmt = useFormatters()
  const now = useNow(60_000)
  const start = new Date(opensAt).getTime()
  const end = new Date(closesAt).getTime()
  const span = end - start

  function toPercent(iso: string): number {
    const value = new Date(iso).getTime()
    return Math.min(100, Math.max(0, ((value - start) / span) * 100))
  }

  const hourMarks = Math.round(span / (60 * 60 * 1000))
  const occupiedPercent = busy.reduce((sum, slot) => sum + Math.max(0, toPercent(slot.end_time) - toPercent(slot.start_time)), 0)
  const nowPercent = ((now - start) / span) * 100

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative h-9 w-full overflow-hidden rounded-md border border-border bg-card">
        <div className="absolute inset-0 flex">
          {Array.from({ length: hourMarks }).map((_, index) => (
            <div key={index} className="flex-1 border-r border-border/70 last:border-r-0" />
          ))}
        </div>
        {nowPercent > 0 && (
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(-45deg,transparent_0_4px,var(--border)_4px_5px)]"
            style={{ width: `${Math.min(100, nowPercent)}%` }}
          />
        )}
        {busy.map((slot, index) => {
          const left = toPercent(slot.start_time)
          const width = Math.max(1.5, toPercent(slot.end_time) - left)
          const isBlocked = slot.source === "FACILITY_BLOCK"
          const isBooked = slot.status === "CONFIRMED" || slot.status === "CHECKED_IN"
          const label = isBlocked ? t("occupancy.blocked", { reason: slot.reason ?? "" }) : isBooked ? t("occupancy.booked") : t("occupancy.held")
          return (
            <Tooltip key={index} content={`${fmt.timeRange(slot.start_time, slot.end_time)} · ${label}`}>
              <div
                tabIndex={0}
                aria-label={`${fmt.timeRange(slot.start_time, slot.end_time)} · ${label}`}
                className={cn(
                  "absolute top-1 bottom-1 rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  isBlocked
                    ? "bg-[repeating-linear-gradient(-45deg,var(--danger)_0_3px,color-mix(in_oklab,var(--danger)_55%,transparent)_3px_6px)]"
                    : isBooked
                      ? "bg-primary"
                      : "bg-warning",
                )}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            </Tooltip>
          )
        })}
      </div>

      <div className="flex items-center justify-between font-mono text-[10.5px] text-subtle-foreground tabular">
        <span>{fmt.time(opensAt)}</span>
        <span>{fmt.time(new Date((start + end) / 2))}</span>
        <span>{fmt.time(closesAt)}</span>
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-[3px] bg-primary" /> {t("occupancy.booked")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-[3px] bg-warning" /> {t("occupancy.held")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-[3px] bg-danger" /> {t("occupancy.blockedLegend")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-[3px] border border-border-strong bg-card" /> {t("occupancy.free")}
            </span>
          </div>
          <span className="text-xs font-medium text-foreground">
            {nowPercent >= 100
              ? t("occupancy.closedToday")
              : occupiedPercent >= 99
                ? t("occupancy.fullyBooked")
                : t("occupancy.percentFree", { percent: Math.round(100 - occupiedPercent) })}
          </span>
        </div>
      )}
    </div>
  )
}

export { OccupancyTimeline }
