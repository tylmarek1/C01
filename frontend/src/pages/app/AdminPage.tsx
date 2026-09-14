import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Camera, CalendarClock, Clock3, LayoutGrid, Pencil, Plus, Users } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { Badge, type BadgeProps } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shared/card"
import { CourtArt } from "@/components/shared/court-art"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shared/dialog"
import { Input } from "@/components/shared/input"
import { Label } from "@/components/shared/label"
import { SectionHeader } from "@/components/shared/section-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select"
import { Skeleton } from "@/components/shared/skeleton"
import { SPORT_LABELS } from "@/components/shared/sport-icon"
import { StatTile } from "@/components/shared/stat-tile"
import { Switch } from "@/components/shared/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/tabs"
import { Textarea } from "@/components/shared/textarea"
import { ApiError, api } from "@/lib/api"
import { ALL_AMENITIES, AMENITY_LABELS } from "@/lib/amenities"
import { useAuth } from "@/lib/auth-context"
import { formatDateRange } from "@/lib/format"
import { compressImageFile } from "@/lib/image"
import { cn } from "@/lib/utils"
import type { Amenity, Court, ReservationAdmin, ReservationStatus, SportType, UserRole } from "@/types"

const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]
const STATUS_VARIANT: Record<ReservationStatus, BadgeProps["variant"]> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CHECKED_IN: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  EXPIRED: "secondary",
  NO_SHOW: "destructive",
}

interface CourtFormValues {
  name: string
  sport_type: SportType
  indoor: boolean
  description: string
  amenities: Amenity[]
}

const EMPTY_FORM: CourtFormValues = { name: "", sport_type: "TENNIS", indoor: false, description: "", amenities: [] }

function formValuesFromCourt(court?: Court): CourtFormValues {
  if (!court) return EMPTY_FORM
  return {
    name: court.name,
    sport_type: court.sport_type,
    indoor: court.indoor,
    description: court.description ?? "",
    amenities: court.amenities,
  }
}

function CourtFormDialog({
  court,
  onSaved,
  onImageUploaded,
  trigger,
}: {
  court?: Court
  onSaved: (values: CourtFormValues) => Promise<void>
  onImageUploaded?: () => void
  trigger: ReactNode
}) {
  const { token } = useAuth()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<CourtFormValues>(() => formValuesFromCourt(court))
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const imageMutation = useMutation({
    mutationFn: async (file: File) => api.uploadCourtImage(token!, court!.id, await compressImageFile(file, 1600, 0.85)),
    onSuccess: () => {
      toast.success("Court photo updated")
      onImageUploaded?.()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not upload photo"),
  })

  async function handleSubmit() {
    setIsSaving(true)
    try {
      await onSaved(values)
      setOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setValues(formValuesFromCourt(court))
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{court ? "Edit court" : "Add a court"}</DialogTitle>
          <DialogDescription>
            {court ? "Update the details players see." : "New courts appear immediately in the public list."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {court && (
            <div className="flex items-center gap-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl">
                <CourtArt sport={court.sport_type} imageUrl={court.image_url} compact className="size-full rounded-xl" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={imageMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="size-3.5" /> {imageMutation.isPending ? "Uploading…" : "Upload photo"}
                </Button>
                <span className="text-xs text-slate-gray">Falls back to the illustration when unset.</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (file) imageMutation.mutate(file)
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="court-name">Name</Label>
            <Input
              id="court-name"
              value={values.name}
              onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
              placeholder="Tennis Court 3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Sport</Label>
              <Select
                value={values.sport_type}
                onValueChange={(value) => setValues((v) => ({ ...v, sport_type: value as SportType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((sport) => (
                    <SelectItem key={sport} value={sport}>
                      {SPORT_LABELS[sport]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Indoor</Label>
              <div className="flex h-11 items-center gap-2.5">
                <Switch checked={values.indoor} onCheckedChange={(checked) => setValues((v) => ({ ...v, indoor: checked }))} />
                <span className="text-sm text-slate-gray">{values.indoor ? "Indoor court" : "Outdoor court"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="court-description">Description</Label>
            <Textarea
              id="court-description"
              value={values.description}
              onChange={(event) => setValues((v) => ({ ...v, description: event.target.value }))}
              placeholder="What makes this court worth booking?"
              maxLength={500}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Amenities</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_AMENITIES.map((amenity) => {
                const active = values.amenities.includes(amenity)
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        amenities: active ? v.amenities.filter((a) => a !== amenity) : [...v.amenities, amenity],
                      }))
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-signal-blue bg-[#eaf3ff] text-signal-blue"
                        : "border-hairline bg-paper text-slate-gray hover:text-ink-navy",
                    )}
                  >
                    {AMENITY_LABELS[amenity]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || values.name.trim().length === 0}>
            {isSaving ? "Saving…" : "Save court"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CourtsTab() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const { data: courts, isLoading } = useQuery({
    queryKey: ["admin-courts"],
    queryFn: () => api.listCourts({ includeInactive: true }, token),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-courts"] })

  const createMutation = useMutation({
    mutationFn: (values: CourtFormValues) =>
      api.createCourt(token!, {
        name: values.name,
        sport_type: values.sport_type,
        indoor: values.indoor,
        description: values.description || undefined,
        amenities: values.amenities,
      }),
    onSuccess: () => {
      toast.success("Court created")
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not create court"),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<Court> }) => api.updateCourt(token!, id, values),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update court"),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <CourtFormDialog
          onSaved={async (values) => {
            await createMutation.mutateAsync(values)
          }}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Add court
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-64 w-full rounded-2xl" />)}

        {courts?.map((court) => (
          <div key={court.id} className="flex flex-col overflow-hidden rounded-2xl border border-hairline bg-card shadow-card">
            <CourtArt sport={court.sport_type} indoor={court.indoor} imageUrl={court.image_url} compact className="rounded-none" />
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-semibold text-ink-navy">{court.name}</span>
                  <span className="text-xs text-slate-gray">{SPORT_LABELS[court.sport_type]}</span>
                </div>
                <CourtFormDialog
                  court={court}
                  onSaved={async (values) => {
                    await updateMutation.mutateAsync({
                      id: court.id,
                      values: {
                        name: values.name,
                        sport_type: values.sport_type,
                        indoor: values.indoor,
                        description: values.description || undefined,
                        amenities: values.amenities,
                      },
                    })
                  }}
                  onImageUploaded={invalidate}
                  trigger={
                    <Button variant="ghost" size="icon" className="size-8" aria-label="Edit court">
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
              </div>
              <div className="flex items-center justify-between border-t border-hairline pt-3">
                <span className="text-sm text-slate-gray">{court.active ? "Visible to players" : "Hidden"}</span>
                <Switch
                  checked={court.active}
                  onCheckedChange={(checked) => updateMutation.mutate({ id: court.id, values: { active: checked } })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_FILTERS: (ReservationStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "NO_SHOW",
]

function ReservationsTab() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "ALL">("ALL")

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["admin-reservations", statusFilter],
    queryFn: () => api.listAllReservations(token!, statusFilter === "ALL" ? undefined : statusFilter),
  })

  const cancelMutation = useMutation({
    mutationFn: (reservation: ReservationAdmin) => api.cancelReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success("Reservation cancelled")
      queryClient.invalidateQueries({ queryKey: ["admin-reservations"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not cancel reservation"),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ReservationStatus | "ALL")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((status) => (
              <SelectItem key={status} value={status}>
                {status === "ALL" ? "All statuses" : status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}

        {!isLoading && reservations?.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline py-16 text-center">
            <p className="font-medium text-ink-navy">No reservations here</p>
            <p className="text-sm text-slate-gray">Try a different status filter.</p>
          </div>
        )}

        {reservations?.map((reservation) => (
          <div
            key={reservation.id}
            className="flex flex-col gap-3 rounded-2xl border border-hairline bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-ink-navy">{reservation.court.name}</span>
              <span className="text-sm text-slate-gray">{formatDateRange(reservation.start_time, reservation.end_time)}</span>
              <span className="text-xs text-slate-gray">
                {reservation.user.name} · {reservation.user.email}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={STATUS_VARIANT[reservation.status]}>{reservation.status}</Badge>
              {reservation.status !== "CANCELLED" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(reservation)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AvailabilityTab() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const { data: courts } = useQuery({ queryKey: ["admin-courts"], queryFn: () => api.listCourts({ includeInactive: true }, token) })
  const { data: blocks, isLoading } = useQuery({ queryKey: ["facility-blocks"], queryFn: () => api.listFacilityBlocks() })

  const [courtId, setCourtId] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [reason, setReason] = useState("")

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["facility-blocks"] })

  const createMutation = useMutation({
    mutationFn: () =>
      api.createFacilityBlock(token!, {
        court_id: courtId,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        reason,
      }),
    onSuccess: () => {
      toast.success("Court blocked — overlapping reservations were cancelled and their owners notified")
      setReason("")
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not create the block"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFacilityBlock(token!, id),
    onSuccess: () => {
      toast.success("Block removed")
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not remove the block"),
  })

  const canSubmit = Boolean(courtId && start && end && reason.trim()) && !createMutation.isPending

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="h-fit gap-5">
        <CardHeader>
          <CardTitle>Block a court</CardTitle>
          <CardDescription>New bookings are rejected in this window; existing ones get cancelled.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Court</Label>
            <Select value={courtId} onValueChange={setCourtId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a court" />
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-start">From</Label>
              <Input id="block-start" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-end">To</Label>
              <Input id="block-end" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="block-reason">Reason</Label>
            <Input
              id="block-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Court resurfacing, private event…"
            />
          </div>
          <Button disabled={!canSubmit} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? "Blocking…" : "Block court"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
        {!isLoading && blocks?.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline py-16 text-center">
            <p className="font-medium text-ink-navy">No blocks right now</p>
            <p className="text-sm text-slate-gray">Every court is bookable.</p>
          </div>
        )}
        {blocks?.map((block) => (
          <div
            key={block.id}
            className="flex flex-col gap-2 rounded-2xl border border-hairline bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium text-ink-navy">{block.court.name}</span>
              <span className="text-sm text-slate-gray">{formatDateRange(block.start_time, block.end_time)}</span>
              <span className="text-xs text-slate-gray">{block.reason}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(block.id)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_ORDER: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "EXPIRED", "NO_SHOW"]

function BarRow({ label, value, max, suffix = "" }: { label: string; value: number; max: number; suffix?: string }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-slate-gray">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-pebble">
        <div className="h-full rounded-full bg-signal-blue" style={{ width: `${width}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-medium text-ink-navy">
        {value}
        {suffix}
      </span>
    </div>
  )
}

function OverviewTab() {
  const { token } = useAuth()
  const { data: stats, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => api.getAdminStats(token!) })

  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  const maxStatus = Math.max(1, ...Object.values(stats.status_breakdown))
  const maxCourtCount = Math.max(1, ...stats.top_courts.map((c) => c.reservation_count))
  const hourly = Array.from({ length: 24 }, (_, hour) => stats.busiest_hours.find((h) => h.hour === hour)?.count ?? 0)
  const maxHourly = Math.max(1, ...hourly)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={CalendarClock} label="total reservations" value={stats.total_reservations} />
        <StatTile icon={Clock3} label="last 30 days" value={stats.reservations_last_30_days} />
        <StatTile icon={AlertTriangle} label="no-show rate" value={`${Math.round(stats.no_show_rate * 100)}%`} />
        <StatTile icon={Users} label="players" value={stats.total_users} />
        <StatTile icon={LayoutGrid} label="courts" value={stats.total_courts} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reservation status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {STATUS_ORDER.map((status) => (
              <BarRow key={status} label={status} value={stats.status_breakdown[status] ?? 0} max={maxStatus} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most popular courts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {stats.top_courts.length === 0 && <p className="text-sm text-slate-gray">No bookings yet.</p>}
            {stats.top_courts.map((entry) => (
              <BarRow key={entry.court.id} label={entry.court.name} value={entry.reservation_count} max={maxCourtCount} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Busiest hours</CardTitle>
          <CardDescription>Confirmed, checked-in, completed and no-show bookings by start hour (venue time).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-1">
            {hourly.map((count, hour) => (
              <div key={hour} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t-sm bg-signal-blue"
                  style={{ height: `${Math.max(2, Math.round((count / maxHourly) * 100))}%` }}
                  title={`${hour}:00 — ${count}`}
                />
                {hour % 3 === 0 && <span className="text-[10px] text-slate-gray">{hour}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function UsersTab() {
  const { token, user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const { data: users, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => api.listAdminUsers(token!) })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => api.updateUserRole(token!, userId, role),
    onSuccess: () => {
      toast.success("Role updated")
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update role"),
  })

  return (
    <div className="flex flex-col gap-3">
      {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}

      {users?.map((user) => (
        <div
          key={user.id}
          className="flex flex-col gap-3 rounded-2xl border border-hairline bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col">
            <span className="font-medium text-ink-navy">{user.name}</span>
            <span className="text-sm text-slate-gray">{user.email}</span>
            <span className="text-xs text-slate-gray">
              {user.active_reservation_count} active · {user.no_show_count} no-show{user.no_show_count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={user.role === "VENUE_MANAGER" ? "success" : "secondary"}>
              {user.role === "VENUE_MANAGER" ? "Venue manager" : "Player"}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              disabled={roleMutation.isPending || user.id === currentUser?.id}
              onClick={() =>
                roleMutation.mutate({
                  userId: user.id,
                  role: user.role === "VENUE_MANAGER" ? "PLAYER" : "VENUE_MANAGER",
                })
              }
            >
              {user.id === currentUser?.id
                ? "You"
                : user.role === "VENUE_MANAGER"
                  ? "Demote to player"
                  : "Promote to manager"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeader align="left" eyebrow="Venue management" title="Admin dashboard" description="Manage courts and keep an eye on every reservation." />

      <Tabs defaultValue="overview" className="mt-10">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="courts">Courts</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="availability">Availability blocks</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="courts">
          <CourtsTab />
        </TabsContent>
        <TabsContent value="reservations">
          <ReservationsTab />
        </TabsContent>
        <TabsContent value="availability">
          <AvailabilityTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { AdminPage }
