import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2, Clock3, MapPin, MoreHorizontal, Pencil, Plus, UserMinus, UserPlus, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { TimeOfDaySelect } from "@/components/shared/time-of-day-select"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { useManagedVenues } from "@/lib/queries"
import { toMinute } from "@/lib/time-of-day"
import { cn } from "@/lib/utils"
import type { OpeningHoursDay, Venue } from "@/types"

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

function useInvalidateVenues() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin-venues"] })
    queryClient.invalidateQueries({ queryKey: ["venues"] })
  }
}

/** "Mon–Fri 07:00–22:00 · Sat closed …" — consecutive days with the same hours collapse into one range. */
function useHoursSummary() {
  const { t } = useTranslation()
  const fmt = useFormatters()
  return (days: OpeningHoursDay[]): string => {
    const byDay = new Map(days.map((day) => [day.weekday, `${day.opens_at}–${day.closes_at}`]))
    const parts: string[] = []
    let start = 0
    for (let day = 1; day <= 7; day++) {
      if (day < 7 && byDay.get(day) === byDay.get(start)) continue
      const label = start === day - 1 ? fmt.weekdayName(start, "short") : `${fmt.weekdayName(start, "short")}–${fmt.weekdayName(day - 1, "short")}`
      parts.push(`${label} ${byDay.get(start) ?? t("admin.venues.hours.closed")}`)
      start = day
    }
    return parts.join(" · ")
  }
}

function VenueFormDialog({ venue, open, onOpenChange }: { venue?: Venue; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const invalidate = useInvalidateVenues()
  const [name, setName] = useState(venue?.name ?? "")
  const [address, setAddress] = useState(venue?.address ?? "")
  const [description, setDescription] = useState(venue?.description ?? "")
  const [touched, setTouched] = useState(false)
  const nameError = touched && !name.trim() ? t("admin.venues.form.nameRequired") : null

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), address: address.trim() || null, description: description.trim() || null }
      return venue
        ? api.updateVenue(token!, venue.id, payload)
        : api.createVenue(token!, { name: payload.name, address: payload.address ?? undefined, description: payload.description ?? undefined })
    },
    onSuccess: () => {
      toast.success(venue ? t("admin.venues.toast.updated") : t("admin.venues.toast.created"))
      invalidate()
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.venues.error.save")),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{venue ? t("admin.venues.form.editTitle") : t("admin.venues.form.addTitle")}</DialogTitle>
          <DialogDescription>{venue ? t("admin.venues.form.editDescription") : t("admin.venues.form.addDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            setTouched(true)
            if (name.trim()) mutation.mutate()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="venue-name">{t("admin.venues.form.name")}</Label>
            <Input
              id="venue-name"
              value={name}
              maxLength={100}
              autoFocus={!venue}
              aria-invalid={Boolean(nameError)}
              onBlur={() => setTouched(true)}
              onChange={(event) => setName(event.target.value)}
            />
            {nameError && <span className="text-xs text-danger">{nameError}</span>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="venue-address">{t("admin.venues.form.address")}</Label>
            <Input id="venue-address" value={address} maxLength={200} onChange={(event) => setAddress(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="venue-description">{t("admin.venues.form.description")}</Label>
            <Textarea id="venue-description" value={description} maxLength={500} rows={3} onChange={(event) => setDescription(event.target.value)} />
          </div>
          {!venue && <p className="text-xs text-muted-foreground">{t("admin.venues.form.defaultHours")}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              {venue ? t("admin.venues.form.save") : t("admin.venues.form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type DayDraft = { open: boolean; opens_at: string; closes_at: string }

function OpeningHoursDialog({ venue, open, onOpenChange }: { venue: Venue; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const queryClient = useQueryClient()
  const { data: hours, isLoading } = useQuery({
    queryKey: ["opening-hours", venue.id],
    queryFn: () => api.getOpeningHours(venue.id),
    enabled: open,
  })
  const [draft, setDraft] = useState<DayDraft[] | null>(null)
  const days: DayDraft[] =
    draft ??
    WEEKDAYS.map((weekday) => {
      const day = hours?.find((entry) => entry.weekday === weekday)
      return day ? { open: true, opens_at: day.opens_at, closes_at: day.closes_at } : { open: false, opens_at: "07:00", closes_at: "22:00" }
    })
  const invalidDay = days.findIndex((day) => day.open && toMinute(day.opens_at) >= toMinute(day.closes_at))

  function update(weekday: number, patch: Partial<DayDraft>) {
    setDraft(days.map((day, index) => (index === weekday ? { ...day, ...patch } : day)))
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.setOpeningHours(
        token!,
        venue.id,
        days.flatMap((day, weekday) => (day.open ? [{ weekday, opens_at: day.opens_at, closes_at: day.closes_at }] : [])),
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(["opening-hours", venue.id], saved)
      queryClient.invalidateQueries({ queryKey: ["court-availability"] })
      toast.success(t("admin.venues.toast.hoursSaved"))
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.venues.error.hours")),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDraft(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.venues.hours.title", { venue: venue.name })}</DialogTitle>
          <DialogDescription>{t("admin.venues.hours.description")}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-72" />
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {days.map((day, weekday) => (
              <li key={weekday} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-28 text-[13px] font-medium capitalize">{fmt.weekdayName(weekday)}</span>
                <Switch
                  checked={day.open}
                  onCheckedChange={(checked) => update(weekday, { open: checked })}
                  aria-label={t("admin.venues.hours.openToggle", { day: fmt.weekdayName(weekday) })}
                />
                {day.open ? (
                  <span className="flex items-center gap-1.5">
                    <TimeOfDaySelect
                      value={day.opens_at}
                      onValueChange={(value) => update(weekday, { opens_at: value })}
                      label={t("admin.venues.hours.opensAt", { day: fmt.weekdayName(weekday) })}
                    />
                    <span className="text-muted-foreground">–</span>
                    <TimeOfDaySelect
                      value={day.closes_at}
                      onValueChange={(value) => update(weekday, { closes_at: value })}
                      label={t("admin.venues.hours.closesAt", { day: fmt.weekdayName(weekday) })}
                    />
                  </span>
                ) : (
                  <span className="text-[13px] text-muted-foreground">{t("admin.venues.hours.closed")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {invalidDay >= 0 && <p className="text-xs text-danger">{t("admin.venues.hours.invalid", { day: fmt.weekdayName(invalidDay) })}</p>}
        <p className="text-xs text-muted-foreground">{t("admin.venues.hours.existingKept")}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={isLoading || invalidDay >= 0} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("admin.venues.hours.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ManagersDialog({ venue, open, onOpenChange }: { venue: Venue; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token, user } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === "ADMIN"
  const [candidate, setCandidate] = useState<string>("")
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)
  const { data: managers, isLoading } = useQuery({
    queryKey: ["venue-managers", venue.id],
    queryFn: () => api.listVenueManagers(token!, venue.id),
    enabled: open,
  })
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.listAdminUsers(token!, { limit: 200 }),
    enabled: open && isAdmin,
  })
  const assigned = new Set(managers?.map((entry) => entry.user.id))
  const candidates = (users ?? []).filter((u) => u.role === "VENUE_MANAGER" && !assigned.has(u.id))

  const assignMutation = useMutation({
    mutationFn: (userId: string) => api.assignVenueManager(token!, venue.id, userId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["venue-managers", venue.id], updated)
      setCandidate("")
      toast.success(t("admin.venues.toast.managerAssigned"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.venues.error.managers")),
  })
  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.unassignVenueManager(token!, venue.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-managers", venue.id] })
      setRemoveTarget(null)
      toast.success(t("admin.venues.toast.managerRemoved"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.venues.error.managers")),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.venues.managers.title", { venue: venue.name })}</DialogTitle>
          <DialogDescription>{t("admin.venues.managers.description")}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {isLoading && <Skeleton className="my-2 h-10" />}
          {managers?.length === 0 && <li className="py-3 text-[13px] text-muted-foreground">{t("admin.venues.managers.empty")}</li>}
          {managers?.map((entry) => (
            <li key={entry.user.id} className="flex items-center gap-3 py-2.5">
              <UserAvatar name={entry.user.name} avatarUrl={entry.user.avatar_url} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium">{entry.user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{entry.user.email}</span>
              </span>
              {isAdmin && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("admin.venues.managers.remove", { name: entry.user.name })}
                  onClick={() => setRemoveTarget({ id: entry.user.id, name: entry.user.name })}
                >
                  <UserMinus />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <div className="flex flex-col gap-2">
            <Label>{t("admin.venues.managers.add")}</Label>
            <div className="flex gap-2">
              <Select value={candidate} onValueChange={setCandidate} disabled={candidates.length === 0}>
                <SelectTrigger className="flex-1" aria-label={t("admin.venues.managers.add")}>
                  <SelectValue placeholder={candidates.length ? t("admin.venues.managers.pick") : t("admin.venues.managers.noCandidates")} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} · {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button disabled={!candidate} isLoading={assignMutation.isPending} onClick={() => assignMutation.mutate(candidate)}>
                <UserPlus /> {t("admin.venues.managers.assign")}
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">{t("admin.venues.managers.roleHint")}</span>
          </div>
        )}
        <ConfirmDialog
          open={Boolean(removeTarget)}
          onOpenChange={(next) => !next && setRemoveTarget(null)}
          title={t("admin.venues.managers.confirmRemove.title")}
          description={removeTarget ? t("admin.venues.managers.confirmRemove.description", { name: removeTarget.name, venue: venue.name }) : undefined}
          confirmLabel={t("admin.venues.managers.confirmRemove.confirm")}
          isLoading={removeMutation.isPending}
          onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
        />
      </DialogContent>
    </Dialog>
  )
}

function VenueRow({ venue, onEdit, onHours, onManagers }: { venue: Venue; onEdit: () => void; onHours: () => void; onManagers: () => void }) {
  const { token, user } = useAuth()
  const { t } = useTranslation()
  const summarize = useHoursSummary()
  const invalidate = useInvalidateVenues()
  const isAdmin = user?.role === "ADMIN"
  const { data: hours } = useQuery({ queryKey: ["opening-hours", venue.id], queryFn: () => api.getOpeningHours(venue.id) })
  const activeMutation = useMutation({
    mutationFn: (active: boolean) => api.updateVenue(token!, venue.id, { active }),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.venues.error.save")),
  })

  return (
    <li className={cn("flex flex-col gap-3 py-4 sm:flex-row sm:items-start", !venue.active && "opacity-80")}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[22px] leading-none font-extrabold uppercase">{venue.name}</span>
          <Badge variant="secondary">{t("admin.venues.courtCount", { count: venue.court_count })}</Badge>
          {!venue.active && <Badge variant="outline">{t("admin.venues.inactive")}</Badge>}
        </span>
        {venue.address && (
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <MapPin className="size-3.5" /> {venue.address}
          </span>
        )}
        <span className="flex items-start gap-1.5 font-mono text-xs text-muted-foreground tabular">
          <Clock3 className="mt-0.5 size-3.5 shrink-0" />
          {hours ? (hours.length ? summarize(hours) : t("admin.venues.hours.alwaysClosed")) : "…"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isAdmin && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {venue.active ? t("admin.venues.active") : t("admin.venues.inactive")}
            <Switch
              checked={venue.active}
              onCheckedChange={(checked) => activeMutation.mutate(checked)}
              aria-label={t("admin.venues.activeToggle", { venue: venue.name })}
            />
          </label>
        )}
        <Button size="sm" variant="outline" onClick={onHours}>
          <Clock3 /> {t("admin.venues.hours.button")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={t("reservationCard.moreActions")}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> {t("admin.venues.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onManagers}>
              <Users /> {t("admin.venues.managers.button")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

function VenuesTab() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const isAdmin = user?.role === "ADMIN"
  const { data: venues, isLoading, isError, refetch } = useManagedVenues()
  const [creating, setCreating] = useState(false)
  const [dialog, setDialog] = useState<{ kind: "edit" | "hours" | "managers"; venue: Venue } | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
        <p className="text-[13px] text-muted-foreground">{isAdmin ? t("admin.venues.intro.admin") : t("admin.venues.intro.manager")}</p>
        {isAdmin && (
          <Button size="sm" className="sm:ml-auto" onClick={() => setCreating(true)}>
            <Plus /> {t("admin.venues.add")}
          </Button>
        )}
      </div>

      {isError && <ErrorState onRetry={() => refetch()} />}
      {isLoading && <Skeleton className="h-40" />}
      {venues && venues.length === 0 && (
        <EmptyState
          icon={Building2}
          title={isAdmin ? t("admin.venues.empty.title") : t("admin.venues.emptyManager.title")}
          description={isAdmin ? t("admin.venues.empty.description") : t("admin.venues.emptyManager.description")}
        />
      )}
      {venues && venues.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-t-2 border-foreground">
          {venues.map((venue) => (
            <VenueRow
              key={venue.id}
              venue={venue}
              onEdit={() => setDialog({ kind: "edit", venue })}
              onHours={() => setDialog({ kind: "hours", venue })}
              onManagers={() => setDialog({ kind: "managers", venue })}
            />
          ))}
        </ul>
      )}

      {creating && <VenueFormDialog open onOpenChange={setCreating} />}
      {dialog?.kind === "edit" && <VenueFormDialog venue={dialog.venue} open onOpenChange={(open) => !open && setDialog(null)} />}
      {dialog?.kind === "hours" && <OpeningHoursDialog venue={dialog.venue} open onOpenChange={(open) => !open && setDialog(null)} />}
      {dialog?.kind === "managers" && <ManagersDialog venue={dialog.venue} open onOpenChange={(open) => !open && setDialog(null)} />}
    </div>
  )
}

export { VenuesTab }
