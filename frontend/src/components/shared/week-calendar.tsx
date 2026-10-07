import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { addDays, isSameDay, useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { useNow } from "@/lib/use-now"
import { cn } from "@/lib/utils"
import type { Reservation } from "@/types"

const OPEN_HOUR = 7
const CLOSE_HOUR = 22
const HOUR_HEIGHT = 44 // px

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function blockStyle(status: Reservation["status"]): string {
  switch (status) {
    case "PENDING":
      return "bg-warning-soft text-warning border-warning"
    case "PENDING_APPROVAL":
      return "bg-info-soft text-info border-info"
    case "CONFIRMED":
    case "CHECKED_IN":
      return "bg-primary text-primary-foreground border-brand"
    case "COMPLETED":
      return "bg-muted text-muted-foreground border-border-strong"
    default:
      return "bg-muted/60 text-subtle-foreground border-border line-through"
  }
}

interface PositionedReservation {
  reservation: Reservation
  top: number
  height: number
  lane: number
  lanes: number
}

function layoutDay(reservations: Reservation[]): PositionedReservation[] {
  const dayStart = OPEN_HOUR * 60
  const dayEnd = CLOSE_HOUR * 60

  const items = reservations
    .map((reservation) => {
      const start = new Date(reservation.start_time)
      const end = new Date(reservation.end_time)
      const startMin = Math.max(dayStart, start.getHours() * 60 + start.getMinutes())
      const endMin = Math.min(dayEnd, end.getHours() * 60 + end.getMinutes())
      return { reservation, startMin, endMin }
    })
    .filter((item) => item.endMin > item.startMin)
    .sort((a, b) => a.startMin - b.startMin)

  const laneEnds: number[] = []
  const withLanes = items.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(item.endMin)
    } else {
      laneEnds[lane] = item.endMin
    }
    return { ...item, lane }
  })

  const lanes = Math.max(1, laneEnds.length)
  const totalMinutes = dayEnd - dayStart

  return withLanes.map(({ reservation, startMin, endMin, lane }) => ({
    reservation,
    top: ((startMin - dayStart) / totalMinutes) * 100,
    height: Math.max(3, ((endMin - startMin) / totalMinutes) * 100),
    lane,
    lanes,
  }))
}

interface WeekCalendarProps {
  reservations: Reservation[]
  onSelectReservation?: (reservation: Reservation) => void
}

function WeekCalendar({ reservations, onSelectReservation }: WeekCalendarProps) {
  const { t } = useTranslation()
  const fmt = useFormatters()
  const now = useNow(60_000)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const today = new Date(now)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const hours = useMemo(() => Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i), [])

  const byDay = useMemo(
    () => days.map((day) => layoutDay(reservations.filter((r) => isSameDay(new Date(r.start_time), day)))),
    [days, reservations],
  )

  // Below `sm`, a 7-column grid needs horizontal scroll to be usable at
  // all — this shows one day at a time instead. Defaults to today if it
  // falls in the visible week, otherwise the first day shown.
  const todayIndex = days.findIndex((day) => isSameDay(day, today))
  const [mobileDayIndex, setMobileDayIndex] = useState(Math.max(0, todayIndex))

  const weekCount = byDay.reduce((sum, d) => sum + d.length, 0)
  const gridHeight = (CLOSE_HOUR - OPEN_HOUR) * HOUR_HEIGHT
  const nowMinutes = today.getHours() * 60 + today.getMinutes()
  const nowTop = ((nowMinutes - OPEN_HOUR * 60) / ((CLOSE_HOUR - OPEN_HOUR) * 60)) * 100
  const showNow = nowTop >= 0 && nowTop <= 100

  function renderDayColumn(day: Date, dayIndex: number) {
    const isToday = isSameDay(day, today)
    return (
      <div key={dayIndex} className="flex-1 border-r border-border last:border-r-0">
        <div className="flex h-12 flex-col items-center justify-center gap-0.5 border-b border-border">
          <span className={cn("font-mono text-[10px] tracking-wider uppercase", isToday ? "text-foreground" : "text-muted-foreground")}>
            {fmt.weekday(day)}
          </span>
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-[13px] font-semibold tabular",
              isToday ? "bg-brand text-brand-foreground" : "text-foreground",
            )}
          >
            {day.getDate()}
          </span>
        </div>
        <div className={cn("relative", isToday && "bg-brand-soft/30")} style={{ height: gridHeight }}>
          {hours.map((hour) => (
            <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-b border-border/60 last:border-b-0" />
          ))}
          {isToday && showNow && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: `${nowTop}%` }}>
              <span className="-ml-1 size-2 rounded-full bg-danger" />
              <span className="h-px flex-1 bg-danger" />
            </div>
          )}
          {byDay[dayIndex].map(({ reservation, top, height, lane, lanes }) => (
            <button
              key={reservation.id}
              type="button"
              onClick={() => onSelectReservation?.(reservation)}
              title={`${reservation.court.name} · ${fmt.timeRange(reservation.start_time, reservation.end_time)}`}
              className={cn(
                "absolute overflow-hidden rounded-sm border-l-2 px-1.5 py-1 text-left text-[11px] leading-tight transition-[filter,transform] outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98]",
                blockStyle(reservation.status),
              )}
              style={{
                top: `calc(${top}% + 1px)`,
                height: `calc(${height}% - 2px)`,
                left: `calc(${(lane / lanes) * 100}% + 2px)`,
                width: `calc(${100 / lanes}% - 4px)`,
              }}
            >
              <span className="block truncate font-semibold">{reservation.court.name}</span>
              <span className="block truncate font-mono opacity-80 tabular">{fmt.time(reservation.start_time)}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const hourGutter = (
    <div className="w-12 shrink-0 border-r border-border">
      <div className="h-12 border-b border-border" />
      {hours.map((hour) => (
        <div key={hour} style={{ height: HOUR_HEIGHT }} className="relative">
          <span className="absolute -top-2 right-1.5 font-mono text-[10px] text-subtle-foreground tabular">
            {String(hour).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setWeekStart((d) => addDays(d, -7))} aria-label={t("calendar.previousWeek")}>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const current = new Date()
              setWeekStart(startOfWeek(current))
              // Monday-starting index for "now", independent of whichever
              // week is currently displayed.
              setMobileDayIndex(current.getDay() === 0 ? 6 : current.getDay() - 1)
            }}
          >
            {t("calendar.today")}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setWeekStart((d) => addDays(d, 7))} aria-label={t("calendar.nextWeek")}>
            <ChevronRight />
          </Button>
          <span className="ml-2 text-[13px] font-semibold tabular">
            {fmt.dayMonth(weekStart)} – {fmt.dayMonth(addDays(weekStart, 6))}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {weekCount === 0 ? t("calendar.empty") : t("calendar.weekCount", { count: weekCount })}
        </span>
      </div>

      {/* Mobile: one day at a time, no horizontal scroll needed. */}
      <div className="sm:hidden">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border p-2 scrollbar-none">
          {days.map((day, dayIndex) => {
            const count = byDay[dayIndex].length
            return (
              <button
                key={dayIndex}
                type="button"
                onClick={() => setMobileDayIndex(dayIndex)}
                aria-pressed={dayIndex === mobileDayIndex}
                className={cn(
                  "relative flex min-w-11 shrink-0 flex-col items-center rounded-md px-2 py-1.5 text-xs transition-colors",
                  dayIndex === mobileDayIndex ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="font-mono text-[10px] uppercase">{fmt.weekday(day)}</span>
                <span className="font-semibold tabular">{day.getDate()}</span>
                {count > 0 && (
                  <span className={cn("absolute top-1 right-1 size-1.5 rounded-full", dayIndex === mobileDayIndex ? "bg-brand" : "bg-foreground")} />
                )}
              </button>
            )
          })}
        </div>
        <div className="flex max-h-[60vh] overflow-y-auto">
          {hourGutter}
          {renderDayColumn(days[mobileDayIndex], mobileDayIndex)}
        </div>
      </div>

      {/* Desktop/tablet: full 7-day grid. */}
      <div className="hidden overflow-x-auto sm:block">
        <div className="flex min-w-[720px]">
          {hourGutter}
          {days.map((day, dayIndex) => renderDayColumn(day, dayIndex))}
        </div>
      </div>
    </div>
  )
}

export { WeekCalendar }
