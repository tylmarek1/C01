import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/shared/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/card"
import { CourtCard } from "@/components/shared/court-card"
import { Label } from "@/components/shared/label"
import { Input } from "@/components/shared/input"
import { OccupancyTimeline } from "@/components/shared/occupancy-timeline"
import { SectionHeader } from "@/components/shared/section-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select"
import { Skeleton } from "@/components/shared/skeleton"
import { Switch } from "@/components/shared/switch"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { todayDateString } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import type { BusySlot, Court } from "@/types"

const DURATIONS = [
  { value: "60", label: "60 minutes" },
  { value: "90", label: "90 minutes" },
  { value: "120", label: "120 minutes" },
]

const SERIES_WEEK_OPTIONS = [2, 4, 6, 8, 10, 12]
// Mirrors the backend's MIN_LEAD_MINUTES (reservations/rules.py) so the UI
// disables a slot before the API would reject it with a 409.
const MIN_LEAD_MINUTES = 15

function generateStartTimes(durationMinutes: number): string[] {
  const openMinutes = 7 * 60
  const closeMinutes = 22 * 60
  const times: string[] = []
  for (let minutes = openMinutes; minutes + durationMinutes <= closeMinutes; minutes += 30) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0")
    const minute = String(minutes % 60).padStart(2, "0")
    times.push(`${hour}:${minute}`)
  }
  return times
}

function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  const [hour, minute] = timeStr.split(":").map(Number)
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

function isSlotTaken(start: Date, end: Date, busy: BusySlot[]): boolean {
  return busy.some(
    (slot) => start.getTime() < new Date(slot.end_time).getTime() && end.getTime() > new Date(slot.start_time).getTime(),
  )
}

function BookCourtPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()

  const { data: courts, isLoading } = useQuery({ queryKey: ["courts"], queryFn: () => api.listCourts() })

  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null)
  const [date, setDate] = useState(todayDateString())
  const [duration, setDuration] = useState("60")
  const [startTime, setStartTime] = useState<string | undefined>(undefined)
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [weeks, setWeeks] = useState("4")

  const prefillCourtId = searchParams.get("court")
  useEffect(() => {
    if (!prefillCourtId || !courts || selectedCourt) return
    const match = courts.find((court) => court.id === prefillCourtId)
    if (match) setSelectedCourt(match)
  }, [prefillCourtId, courts, selectedCourt])

  const { data: availability } = useQuery({
    queryKey: ["court-availability", selectedCourt?.id, date],
    queryFn: () => api.getCourtAvailability(selectedCourt!.id, date),
    enabled: Boolean(selectedCourt),
  })

  const startTimeOptions = useMemo(() => generateStartTimes(Number(duration)), [duration])
  const nowMs = Date.now()

  const joinWaitlistMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourt || !startTime) return
      const start = combineDateAndTime(date, startTime)
      const end = new Date(start.getTime() + Number(duration) * 60_000)
      return api.joinWaitlist(token!, selectedCourt.id, start.toISOString(), end.toISOString())
    },
    onSuccess: () => toast.success("Added to the waitlist — check your dashboard for updates"),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not join the waitlist"),
  })

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourt || !startTime) throw new Error("Pick a court and a start time first")
      const start = combineDateAndTime(date, startTime)
      const end = new Date(start.getTime() + Number(duration) * 60_000)

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
      if (result && "booked" in result) {
        const { booked, failed_weeks: failedWeeks, requested_occurrences: requested } = result
        toast.success(
          failedWeeks.length === 0
            ? `Held ${booked.length} of ${requested} weeks — confirm them from your dashboard`
            : `Held ${booked.length} of ${requested} weeks (week ${failedWeeks.join(", ")} conflicted)`,
        )
      } else {
        toast.success("Court held for 5 minutes — confirm it from your dashboard")
      }
      navigate("/app")
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Could not create the reservation"
      const canWaitlist = error instanceof ApiError && error.status === 409 && message.toLowerCase().includes("waitlist")
      toast.error(message, canWaitlist ? { action: { label: "Join waitlist", onClick: () => joinWaitlistMutation.mutate() } } : undefined)
    },
  })

  const canSubmit = Boolean(selectedCourt && startTime) && !bookMutation.isPending

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <SectionHeader align="left" title={t("book.title")} description={t("book.description")} />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-ink-navy">{t("book.step1")}</span>
          {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}
          {courts?.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              selected={selectedCourt?.id === court.id}
              onSelect={(next) => {
                setSelectedCourt(next)
                setStartTime(undefined)
              }}
            />
          ))}
        </div>

        <Card className="h-fit gap-5">
          <CardHeader>
            <CardTitle>{t("book.step2")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">{t("book.date")}</Label>
              <Input
                id="date"
                type="date"
                min={todayDateString()}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                  setStartTime(undefined)
                }}
              />
            </div>

            {selectedCourt && availability && (
              <div className="flex flex-col gap-2">
                <Label>{selectedCourt.name} occupancy</Label>
                <OccupancyTimeline
                  opensAt={availability.opens_at}
                  closesAt={availability.closes_at}
                  busy={availability.busy}
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>{t("book.duration")}</Label>
              <Select
                value={duration}
                onValueChange={(value) => {
                  setDuration(value)
                  setStartTime(undefined)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("book.startTime")}</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <SelectValue placeholder="07:00–22:00, on the hour or half hour" />
                </SelectTrigger>
                <SelectContent>
                  {startTimeOptions.map((option) => {
                    const start = combineDateAndTime(date, option)
                    const end = new Date(start.getTime() + Number(duration) * 60_000)
                    const taken = availability ? isSlotTaken(start, end, availability.busy) : false
                    const tooSoon = start.getTime() < nowMs + MIN_LEAD_MINUTES * 60_000
                    return (
                      <SelectItem key={option} value={option} disabled={taken || tooSoon}>
                        {option}
                        {taken ? " · Booked" : tooSoon ? " · Too soon" : ""}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-ink-navy">Repeat weekly</span>
                <span className="text-xs text-slate-gray">Book the same slot every week for a few weeks</span>
              </div>
              <Switch checked={repeatWeekly} onCheckedChange={setRepeatWeekly} />
            </div>

            {repeatWeekly && (
              <div className="flex flex-col gap-2">
                <Label>Number of weeks</Label>
                <Select value={weeks} onValueChange={setWeeks}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERIES_WEEK_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option} weeks
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button size="lg" className="mt-2 w-full" disabled={!canSubmit} onClick={() => bookMutation.mutate()}>
              {bookMutation.isPending ? t("book.submitting") : t("book.submit")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export { BookCourtPage }
