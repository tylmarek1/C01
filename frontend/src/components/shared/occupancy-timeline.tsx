import { useMemo, useState, type MouseEvent } from "react"

import { Tooltip } from "@/components/ui/tooltip"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { buildSlots, slotAt, type Slot } from "@/lib/slots"
import { cn } from "@/lib/utils"
import { useNow } from "@/lib/use-now"
import type { BusySlot } from "@/types"

interface TimelinePick {
  durationMinutes: number
  /** Start of the currently chosen slot (ISO), drawn on the strip. */
  selected?: string | null
  onSelect: (slot: Slot) => void
  /** A click on a booked/held stretch — e.g. to offer the waitlist. */
  onTakenSelect?: (slot: Slot) => void
}

interface OccupancyTimelineProps {
  opensAt: string
  closesAt: string
  busy: BusySlot[]
  className?: string
  /** Hide the legend + summary line (when shown next to a slot grid that explains itself). */
  compact?: boolean
  /** Makes the strip clickable: a click picks the nearest free slot of this
   * duration, hovering previews it, and the selection is drawn on the strip.
   * Pointer-only on purpose — the SlotGrid next to it is the keyboard path. */
  pick?: TimelinePick
}

/** One-day strip from opening to closing time with every busy interval drawn on it. */
function OccupancyTimeline({ opensAt, closesAt, busy, className, compact = false, pick }: OccupancyTimelineProps) {
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

  const durationMinutes = pick?.durationMinutes
  const slots = useMemo(
    () => (durationMinutes ? buildSlots({ opens_at: opensAt, closes_at: closesAt, busy }, durationMinutes, now) : []),
    [opensAt, closesAt, busy, durationMinutes, now],
  )
  const [hovered, setHovered] = useState<Slot | null>(null)

  function slotFromPointer(event: MouseEvent<HTMLDivElement>): Slot | undefined {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    return slotAt(slots, new Date(start + ratio * span))
  }

  const selectedSlot = pick?.selected ? slots.find((slot) => slot.start.toISOString() === pick.selected && slot.state === "free") : undefined
  const preview = hovered?.state === "free" && hovered.start.getTime() !== selectedSlot?.start.getTime() ? hovered : null
  const labelSlot = preview ?? selectedSlot

  function rangeStyle(slot: Slot) {
    const left = toPercent(slot.start.toISOString())
    return { left: `${left}%`, width: `${toPercent(slot.end.toISOString()) - left}%` }
  }

  // A closed day has no hours to draw (opens_at === closes_at); SlotGrid says so.
  if (span <= 0) return null

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {pick && (
        <div aria-hidden className="relative h-4 font-mono text-[10.5px] leading-4 tabular">
          {labelSlot ? (
            <span
              key={labelSlot.start.getTime()}
              className={cn(
                "absolute top-0 -translate-x-1/2 animate-fade-in whitespace-nowrap",
                labelSlot === preview ? "text-muted-foreground" : "font-semibold text-brand-ink",
              )}
              style={{
                left: `clamp(2.75rem, ${(toPercent(labelSlot.start.toISOString()) + toPercent(labelSlot.end.toISOString())) / 2}%, calc(100% - 2.75rem))`,
              }}
            >
              {fmt.timeRange(labelSlot.start.toISOString(), labelSlot.end.toISOString())}
            </span>
          ) : (
            <span className="text-subtle-foreground">{t("occupancy.pickHint")}</span>
          )}
        </div>
      )}
      <div
        className={cn("relative h-8 w-full overflow-hidden border border-foreground/30 bg-card", pick && "cursor-pointer")}
        onMouseMove={pick ? (event) => setHovered(slotFromPointer(event) ?? null) : undefined}
        onMouseLeave={pick ? () => setHovered(null) : undefined}
        onClick={
          pick
            ? (event) => {
                const slot = slotFromPointer(event)
                if (slot?.state === "free") pick.onSelect(slot)
                else if (slot && (slot.state === "booked" || slot.state === "held")) pick.onTakenSelect?.(slot)
              }
            : undefined
        }
      >
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
                  "absolute inset-y-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
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
        {preview && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 border-2 border-dashed border-brand bg-brand/15" style={rangeStyle(preview)} />
        )}
        {selectedSlot && (
          <div
            key={selectedSlot.start.getTime()}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 animate-fade-in border-2 border-brand bg-brand/70"
            style={rangeStyle(selectedSlot)}
          />
        )}
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
              <span className="size-2.5 shrink-0 bg-primary" /> {t("occupancy.booked")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 bg-warning" /> {t("occupancy.held")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 bg-danger" /> {t("occupancy.blockedLegend")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 border border-border-strong bg-card" /> {t("occupancy.free")}
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
