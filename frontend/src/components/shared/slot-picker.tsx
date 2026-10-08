import { CalendarDays } from "lucide-react"
import { useEffect, useMemo, useRef } from "react"

import { Tooltip } from "@/components/ui/tooltip"
import { addDays, parseDateString, toDateString, useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { MAX_ADVANCE_DAYS, buildSlots, type Slot, type SlotState } from "@/lib/slots"
import type { CourtAvailability } from "@/types"

/** Horizontal strip of bookable days (today + MAX_ADVANCE_DAYS). */
function DayStrip({
  value,
  onChange,
  days = MAX_ADVANCE_DAYS + 1,
  className,
}: {
  value: string
  onChange: (value: string) => void
  days?: number
  className?: string
}) {
  const { t } = useTranslation()
  const fmt = useFormatters()
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayKey = toDateString(new Date())
  const today = useMemo(() => parseDateString(todayKey), [todayKey])
  const list = useMemo(() => Array.from({ length: days }, (_, i) => addDays(today, i)), [days, today])

  useEffect(() => {
    scrollRef.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [value])

  const selected = parseDateString(value)
  const inRange = list.some((day) => toDateString(day) === value)

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center justify-between">
        <span className="eyebrow">{fmt.monthYear(selected)}</span>
        <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-xs px-1.5 py-0.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          <CalendarDays className="size-3.5" /> {t("book.pickDate")}
          <input
            type="date"
            className="absolute inset-0 cursor-pointer opacity-0"
            min={toDateString(today)}
            max={toDateString(addDays(today, MAX_ADVANCE_DAYS))}
            value={value}
            onChange={(event) => event.target.value && onChange(event.target.value)}
            aria-label={t("book.date")}
          />
        </label>
      </div>
      {/* A fixture list: cells share their rules (gap-px over a line-coloured track). */}
      <div
        ref={scrollRef}
        className="flex w-fit max-w-full gap-px overflow-x-auto border border-border bg-border scrollbar-none"
        role="group"
        aria-label={t("book.date")}
      >
        {list.map((day, index) => {
          const key = toDateString(day)
          const active = key === value
          const weekend = day.getDay() === 0 || day.getDay() === 6
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(key)}
              className={cn(
                "relative flex h-[4.5rem] w-14 shrink-0 flex-col items-center justify-center gap-1 text-center transition-colors duration-150 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                active ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "font-mono text-[10px] tracking-[0.06em] uppercase",
                  active ? "opacity-75" : weekend ? "text-brand-ink" : "text-muted-foreground",
                )}
              >
                {index === 0 ? t("time.todayShort") : fmt.weekday(day)}
              </span>
              <span className="font-display text-[26px] leading-none font-extrabold tabular">{day.getDate()}</span>
              {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" />}
            </button>
          )
        })}
        {!inRange && (
          <span className="flex h-[4.5rem] shrink-0 items-center bg-primary px-4 font-display text-[20px] font-extrabold text-primary-foreground uppercase">
            {fmt.date(selected)}
          </span>
        )}
      </div>
    </div>
  )
}

/** Grid of start times grouped by part of day. Free slots select; taken ones
 * can still be clicked (when `onTakenSelect` is given) to offer the waitlist. */
function SlotGrid({
  availability,
  durationMinutes,
  selected,
  onSelect,
  onTakenSelect,
  className,
}: {
  availability: CourtAvailability
  durationMinutes: number
  selected?: string | null
  onSelect: (slot: Slot) => void
  onTakenSelect?: (slot: Slot) => void
  className?: string
}) {
  const { t } = useTranslation()
  const fmt = useFormatters()
  const slots = useMemo(() => buildSlots(availability, durationMinutes), [availability, durationMinutes])
  const freeCount = slots.filter((slot) => slot.state === "free").length

  const groups = [
    { key: "morning", label: t("book.slots.morning"), test: (h: number) => h < 12 },
    { key: "afternoon", label: t("book.slots.afternoon"), test: (h: number) => h >= 12 && h < 17 },
    { key: "evening", label: t("book.slots.evening"), test: (h: number) => h >= 17 },
  ]

  const stateLabel: Record<SlotState, string> = {
    free: t("book.slot.free"),
    booked: t("book.slot.booked"),
    held: t("book.slot.held"),
    blocked: t("book.slot.unavailable"),
    past: t("book.slot.tooSoon"),
  }

  // The venue's opening hours have no row for this weekday (ADR-009).
  if (availability.closed) {
    return (
      <p className={cn("border border-dashed border-foreground/25 px-4 py-6 text-center text-[13px] text-muted-foreground", className)}>
        {t("book.slots.closedDay")}
      </p>
    )
  }

  if (slots.length === 0 || freeCount === 0) {
    const allPast = slots.every((slot) => slot.state === "past")
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <p className="border border-dashed border-foreground/25 px-4 py-6 text-center text-[13px] text-muted-foreground">
          {allPast ? t("book.slots.dayOver") : t("book.slots.noneFree")}
        </p>
        {!allPast && onTakenSelect && slots.length > 0 && renderSlotButtons()}
      </div>
    )
  }

  // A render function, not a nested component, so React doesn't remount the
  // whole grid (and drop keyboard focus) on every parent render.
  function renderSlotButtons() {
    return (
      <div className="@container flex flex-col">
        {groups.map((group) => {
          const items = slots.filter((slot) => group.test(slot.start.getHours()))
          if (items.length === 0) return null
          const groupFree = items.filter((slot) => slot.state === "free").length
          return (
            <div key={group.key} className="grid gap-2 border-t border-foreground/80 py-3 @lg:grid-cols-[7.5rem_minmax(0,1fr)] @lg:gap-4">
              <div className="flex items-baseline justify-between gap-2 @lg:flex-col @lg:justify-start @lg:gap-1">
                <span className="font-display text-[20px] leading-none font-extrabold uppercase">{group.label}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground tabular">
                  {t("book.slots.groupFree", { count: groupFree })}
                </span>
              </div>
              {/* The board: one ruled grid, cells share their borders. */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] border-t border-l border-border">
                {items.map((slot) => {
                  const iso = slot.start.toISOString()
                  const active = selected === iso && slot.state === "free"
                  const taken = slot.state === "booked" || slot.state === "held"
                  const clickable = slot.state === "free" || (taken && Boolean(onTakenSelect))
                  const button = (
                    <button
                      key={iso}
                      type="button"
                      disabled={!clickable}
                      aria-pressed={active}
                      aria-label={`${fmt.time(slot.start)} · ${stateLabel[slot.state]}`}
                      onClick={() => (slot.state === "free" ? onSelect(slot) : onTakenSelect?.(slot))}
                      className={cn(
                        "relative flex h-12 flex-col items-center justify-center gap-0.5 border-r border-b border-border font-mono tabular transition-colors duration-150 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                        slot.state === "free" &&
                          (active
                            ? "animate-pop bg-brand text-brand-foreground"
                            : "bg-card text-foreground hover:bg-primary hover:text-primary-foreground"),
                        taken && "bg-hatch bg-muted text-subtle-foreground hover:text-foreground",
                        slot.state === "blocked" && "bg-hatch cursor-not-allowed bg-danger-soft text-danger/70",
                        slot.state === "past" && "cursor-not-allowed bg-background text-subtle-foreground/50",
                      )}
                    >
                      <span className={cn("text-[13.5px] font-semibold", taken && "line-through decoration-1")}>{fmt.time(slot.start)}</span>
                      {active && (
                        <span className="text-[9.5px] leading-none opacity-85">
                          –{fmt.time(slot.end)}
                        </span>
                      )}
                      {!active && slot.state !== "free" && slot.state !== "past" && (
                        <span className="text-[8.5px] leading-none tracking-[0.06em] uppercase">
                          {slot.state === "held" ? t("book.slot.heldShort") : stateLabel[slot.state]}
                        </span>
                      )}
                    </button>
                  )
                  return slot.state === "free" ? (
                    button
                  ) : (
                    <Tooltip
                      key={iso}
                      content={
                        taken && onTakenSelect ? `${stateLabel[slot.state]} · ${t("book.slot.waitlistHint")}` : stateLabel[slot.state]
                      }
                    >
                      <span className="contents">{button}</span>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {renderSlotButtons()}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-foreground/80 pt-3 font-mono text-[10.5px] tracking-[0.04em] text-muted-foreground uppercase">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 border border-border bg-card" /> {t("book.slot.free")}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 bg-brand" /> {t("book.slot.selected")}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-hatch size-3 bg-muted" /> {t("book.slot.booked")} / {t("book.slot.held")}
        </span>
        <span className="ml-auto text-foreground">{t("book.slots.freeCount", { count: freeCount })}</span>
      </div>
    </div>
  )
}

export { DayStrip, SlotGrid }
export type { Slot }
