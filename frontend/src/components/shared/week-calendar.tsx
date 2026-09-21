import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/shared/button"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Reservation } from "@/types"

const OPEN_HOUR = 7
const CLOSE_HOUR = 22
const HOUR_HEIGHT = 44 // px

const dayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "short" })
const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })
const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function blockStyle(status: Reservation["status"]): string {
  switch (status) {
    case "PENDING":
    case "PENDING_APPROVAL":
      return "bg-signal-blue/50 text-ink-navy"
    case "CONFIRMED":
    case "CHECKED_IN":
      return "bg-ink-navy text-paper"
    case "COMPLETED":
      return "bg-slate-gray/40 text-ink-navy"
    default:
      return "bg-hairline text-slate-gray line-through decoration-slate-gray/60"
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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const today = new Date()

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const hours = useMemo(() => Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i), [])

  const byDay = useMemo(
    () => days.map((day) => layoutDay(reservations.filter((r) => isSameDay(new Date(r.start_time), day)))),
    [days, reservations],
  )

  const hasAny = byDay.some((d) => d.length > 0)
  const gridHeight = (CLOSE_HOUR - OPEN_HOUR) * HOUR_HEIGHT

  return (
    <div className="rounded-2xl border border-hairline bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-hairline p-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setWeekStart((d) => addDays(d, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            {t("calendar.today")}
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setWeekStart((d) => addDays(d, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="text-sm font-medium text-ink-navy">
          {dateFormatter.format(weekStart)} – {dateFormatter.format(addDays(weekStart, 6))}
        </span>
      </div>

      {!hasAny && <p className="p-6 text-center text-sm text-slate-gray">{t("calendar.empty")}</p>}

      <div className="overflow-x-auto">
        <div className="flex min-w-[720px]">
          <div className="w-14 shrink-0 border-r border-hairline">
            <div className="h-10 border-b border-hairline" />
            {hours.map((hour) => (
              <div key={hour} style={{ height: HOUR_HEIGHT }} className="relative border-b border-hairline/60 text-right">
                <span className="absolute -top-2 right-1.5 text-[10px] text-slate-gray">{hour}:00</span>
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => (
            <div key={dayIndex} className="flex-1 border-r border-hairline last:border-r-0">
              <div
                className={cn(
                  "flex h-10 flex-col items-center justify-center border-b border-hairline text-xs",
                  isSameDay(day, today) && "bg-[#eaf3ff] font-semibold text-signal-blue",
                )}
              >
                <span>{dayFormatter.format(day)}</span>
                <span className="text-[10px] text-slate-gray">{dateFormatter.format(day)}</span>
              </div>
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((hour) => (
                  <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-b border-hairline/40" />
                ))}
                {byDay[dayIndex].map(({ reservation, top, height, lane, lanes }) => (
                  <button
                    key={reservation.id}
                    type="button"
                    onClick={() => onSelectReservation?.(reservation)}
                    title={reservation.court.name}
                    className={cn(
                      "absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition-opacity hover:opacity-90",
                      blockStyle(reservation.status),
                    )}
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                      left: `${(lane / lanes) * 100}%`,
                      width: `${100 / lanes}%`,
                    }}
                  >
                    <span className="block truncate font-medium">{reservation.court.name}</span>
                    <span className="block truncate opacity-80">{timeFormatter.format(new Date(reservation.start_time))}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { WeekCalendar }
