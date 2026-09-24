import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { BusySlot } from "@/types"

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })

interface OccupancyTimelineProps {
  opensAt: string
  closesAt: string
  busy: BusySlot[]
  className?: string
}

function OccupancyTimeline({ opensAt, closesAt, busy, className }: OccupancyTimelineProps) {
  const { t } = useTranslation()
  const start = new Date(opensAt).getTime()
  const end = new Date(closesAt).getTime()
  const span = end - start

  function toPercent(iso: string): number {
    const value = new Date(iso).getTime()
    return Math.min(100, Math.max(0, ((value - start) / span) * 100))
  }

  const hourMarks = Math.round(span / (60 * 60 * 1000))
  const occupiedPercent = busy.reduce((sum, slot) => {
    const width = toPercent(slot.end_time) - toPercent(slot.start_time)
    return sum + Math.max(0, width)
  }, 0)

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="relative h-10 w-full overflow-hidden rounded-lg border border-hairline bg-pebble">
        <div className="absolute inset-0 flex">
          {Array.from({ length: hourMarks }).map((_, index) => (
            <div key={index} className="flex-1 border-r border-hairline/70 last:border-r-0" />
          ))}
        </div>
        {busy.map((slot, index) => {
          const left = toPercent(slot.start_time)
          const width = Math.max(1.5, toPercent(slot.end_time) - left)
          const isBlocked = slot.source === "FACILITY_BLOCK"
          const isBooked = slot.status === "CONFIRMED" || slot.status === "CHECKED_IN"
          const label = isBlocked
            ? t("occupancy.blocked", { reason: slot.reason ?? "" })
            : isBooked
              ? t("occupancy.booked")
              : t("occupancy.held")
          return (
            <div
              key={index}
              title={`${timeFormatter.format(new Date(slot.start_time))}–${timeFormatter.format(new Date(slot.end_time))} · ${label}`}
              className={cn(
                "absolute top-0.5 bottom-0.5 rounded-md",
                isBlocked ? "bg-destructive/70" : isBooked ? "bg-ink-navy" : "bg-signal-blue/45",
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          )
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-gray">
        <span>{timeFormatter.format(new Date(opensAt))}</span>
        <span>{timeFormatter.format(new Date(closesAt))}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-gray">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full bg-ink-navy" /> {t("occupancy.booked")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full bg-signal-blue/45" /> {t("occupancy.held")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full bg-destructive/70" /> {t("occupancy.blockedLegend")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full border border-hairline bg-paper" /> {t("occupancy.free")}
        </span>
      </div>

      <p className="text-xs text-slate-gray">
        {occupiedPercent >= 99 ? t("occupancy.fullyBooked") : t("occupancy.percentFree", { percent: Math.round(100 - occupiedPercent) })}
      </p>
    </div>
  )
}

export { OccupancyTimeline }
