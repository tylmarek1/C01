import { CalendarDays, Moon, Sun, Sunrise } from "lucide-react"
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
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium">{fmt.monthYear(selected)}</span>
        <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
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
      <div ref={scrollRef} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none" role="group" aria-label={t("book.date")}>
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
                "flex h-16 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-md border text-center transition-[background-color,border-color,color,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-95",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:border-border-strong",
              )}
            >
              <span className={cn("font-mono text-[10px] uppercase", active ? "opacity-80" : weekend ? "text-foreground" : "text-muted-foreground")}>
                {index === 0 ? t("time.todayShort") : fmt.weekday(day)}
              </span>
              <span className="text-[16px] leading-none font-semibold tabular">{day.getDate()}</span>
              {active && <span className="size-1 rounded-full bg-brand" />}
            </button>
          )
        })}
        {!inRange && (
          <span className="flex h-16 shrink-0 items-center rounded-md border border-primary bg-primary px-3 text-[13px] font-medium text-primary-foreground">
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
    { key: "morning", label: t("book.slots.morning"), icon: Sunrise, test: (h: number) => h < 12 },
    { key: "afternoon", label: t("book.slots.afternoon"), icon: Sun, test: (h: number) => h >= 12 && h < 17 },
    { key: "evening", label: t("book.slots.evening"), icon: Moon, test: (h: number) => h >= 17 },
  ]

  const stateLabel: Record<SlotState, string> = {
    free: t("book.slot.free"),
    booked: t("book.slot.booked"),
    held: t("book.slot.held"),
    blocked: t("book.slot.unavailable"),
    past: t("book.slot.tooSoon"),
  }

  if (slots.length === 0 || freeCount === 0) {
    const allPast = slots.every((slot) => slot.state === "past")
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-[13px] text-muted-foreground">
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
      <>
        {groups.map((group) => {
          const items = slots.filter((slot) => group.test(slot.start.getHours()))
          if (items.length === 0) return null
          return (
            <div key={group.key} className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <group.icon className="size-3.5" /> {group.label}
              </span>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5">
                {items.map((slot) => {
                  const iso = slot.start.toISOString()
                  const active = selected === iso
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
                        "h-9 rounded-sm border font-mono text-[12.5px] font-medium tabular transition-[background-color,border-color,color,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-95",
                        slot.state === "free" &&
                          (active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card text-foreground hover:border-foreground/50 hover:bg-muted"),
                        taken && "border-transparent bg-muted text-subtle-foreground line-through decoration-subtle-foreground/60 hover:bg-wash-strong",
                        slot.state === "blocked" &&
                          "cursor-not-allowed border-transparent bg-[repeating-linear-gradient(-45deg,var(--muted)_0_4px,transparent_4px_8px)] text-subtle-foreground",
                        slot.state === "past" && "cursor-not-allowed border-transparent text-subtle-foreground/60",
                      )}
                    >
                      {fmt.time(slot.start)}
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
      </>
    )
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {renderSlotButtons()}
      <p className="text-xs text-muted-foreground">{t("book.slots.freeCount", { count: freeCount })}</p>
    </div>
  )
}

export { DayStrip, SlotGrid }
export type { Slot }
