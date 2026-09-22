import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  BarChart3,
  Camera,
  CalendarClock,
  Clock3,
  Download,
  History,
  LayoutGrid,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { Fragment, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/avatar"
import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shared/card"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CourtArt } from "@/components/shared/court-art"
import { DataRow } from "@/components/shared/data-row"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shared/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { Input } from "@/components/shared/input"
import { Label } from "@/components/shared/label"
import { SectionHeader } from "@/components/shared/section-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select"
import { Skeleton } from "@/components/shared/skeleton"
import { useSportLabels } from "@/components/shared/sport-icon"
import { StatTile } from "@/components/shared/stat-tile"
import { Switch } from "@/components/shared/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/tabs"
import { Textarea } from "@/components/shared/textarea"
import { ApiError, api, assetUrl } from "@/lib/api"
import { ALL_AMENITIES, useAmenityLabels } from "@/lib/amenities"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency, formatDateRange } from "@/lib/format"
import { compressImageFile } from "@/lib/image"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { STATUS_VARIANT, useStatusLabels } from "@/lib/reservation-status"
import { ROLE_VARIANT, useRoleLabels } from "@/lib/user-role"
import { cn } from "@/lib/utils"
import type {
  Amenity,
  ChallengeMetric,
  Court,
  FacilityBlock,
  ReservationAdmin,
  ReservationStatus,
  SportType,
  UserAdmin,
  UserRole,
} from "@/types"

const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]

interface CourtFormValues {
  name: string
  sport_type: SportType
  indoor: boolean
  requires_approval: boolean
  description: string
  amenities: Amenity[]
  price_per_hour: string
}

const EMPTY_FORM: CourtFormValues = {
  name: "",
  sport_type: "TENNIS",
  indoor: false,
  requires_approval: false,
  description: "",
  amenities: [],
  price_per_hour: "",
}

function formValuesFromCourt(court?: Court): CourtFormValues {
  if (!court) return EMPTY_FORM
  return {
    name: court.name,
    sport_type: court.sport_type,
    indoor: court.indoor,
    requires_approval: court.requires_approval,
    description: court.description ?? "",
    amenities: court.amenities,
    price_per_hour: court.price_per_hour !== null ? String(court.price_per_hour) : "",
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
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const amenityLabels = useAmenityLabels()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<CourtFormValues>(() => formValuesFromCourt(court))
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const imageMutation = useMutation({
    mutationFn: async (file: File) => api.uploadCourtImage(token!, court!.id, await compressImageFile(file, 1600, 0.85)),
    onSuccess: () => {
      toast.success(t("admin.toast.photoUpdated"))
      onImageUploaded?.()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.photoUpload")),
  })

  const galleryAddMutation = useMutation({
    mutationFn: async (file: File) => api.addCourtGalleryImage(token!, court!.id, await compressImageFile(file, 1600, 0.85)),
    onSuccess: () => onImageUploaded?.(),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.photoUpload")),
  })

  const galleryRemoveMutation = useMutation({
    mutationFn: (imageId: string) => api.deleteCourtGalleryImage(token!, court!.id, imageId),
    onSuccess: () => onImageUploaded?.(),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.galleryRemove")),
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
          <DialogTitle>{court ? t("admin.court.editTitle") : t("admin.court.addTitle")}</DialogTitle>
          <DialogDescription>
            {court ? t("admin.court.editDescription") : t("admin.court.addDescription")}
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
                  <Camera className="size-3.5" /> {imageMutation.isPending ? t("admin.court.uploading") : t("admin.court.uploadPhoto")}
                </Button>
                <span className="text-xs text-slate-gray">{t("admin.court.photoFallback")}</span>
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

          {court && (
            <div className="flex flex-col gap-2">
              <Label>{t("admin.court.gallery")}</Label>
              <div className="flex flex-wrap gap-2">
                {court.images.map((image) => (
                  <div key={image.id} className="group relative size-16 shrink-0 overflow-hidden rounded-lg border border-hairline">
                    <img src={assetUrl(image.url)} alt="" loading="lazy" className="size-full object-cover" />
                    <button
                      type="button"
                      disabled={galleryRemoveMutation.isPending}
                      onClick={() => galleryRemoveMutation.mutate(image.id)}
                      aria-label={t("admin.court.gallery.remove")}
                      className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-ink-navy/70 text-paper opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {court.images.length < 8 && (
                  <button
                    type="button"
                    disabled={galleryAddMutation.isPending}
                    onClick={() => galleryInputRef.current?.click()}
                    aria-label={t("admin.court.gallery.add")}
                    className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-hairline text-slate-gray transition-colors hover:border-signal-blue hover:text-signal-blue"
                  >
                    <Plus className="size-4" />
                  </button>
                )}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (file) galleryAddMutation.mutate(file)
                  }}
                />
              </div>
              <span className="text-xs text-slate-gray">{t("admin.court.gallery.hint")}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="court-name">{t("admin.court.name")}</Label>
            <Input
              id="court-name"
              value={values.name}
              onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
              placeholder={t("admin.court.namePlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t("admin.court.sport")}</Label>
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
                      {sportLabels[sport]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("admin.court.indoor")}</Label>
              <div className="flex h-11 items-center gap-2.5">
                <Switch
                  checked={values.indoor}
                  onCheckedChange={(checked) => setValues((v) => ({ ...v, indoor: checked }))}
                  aria-label={values.indoor ? t("admin.court.indoorCourt") : t("admin.court.outdoorCourt")}
                />
                <span className="text-sm text-slate-gray">
                  {values.indoor ? t("admin.court.indoorCourt") : t("admin.court.outdoorCourt")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("admin.court.requiresApproval")}</Label>
            <div className="flex items-center gap-2.5">
              <Switch
                checked={values.requires_approval}
                onCheckedChange={(checked) => setValues((v) => ({ ...v, requires_approval: checked }))}
                aria-label={t("admin.court.requiresApproval")}
              />
              <span className="text-sm text-slate-gray">{t("admin.court.requiresApprovalHint")}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="court-price">{t("admin.court.pricePerHour")}</Label>
            <Input
              id="court-price"
              type="number"
              min={0}
              step="1"
              inputMode="decimal"
              value={values.price_per_hour}
              onChange={(event) => setValues((v) => ({ ...v, price_per_hour: event.target.value }))}
              placeholder={t("admin.court.pricePlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="court-description">{t("admin.court.description")}</Label>
            <Textarea
              id="court-description"
              value={values.description}
              onChange={(event) => setValues((v) => ({ ...v, description: event.target.value }))}
              placeholder={t("admin.court.descriptionPlaceholder")}
              maxLength={500}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("admin.court.amenities")}</Label>
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
                    {amenityLabels[amenity]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || values.name.trim().length === 0}>
            {isSaving ? t("admin.court.saving") : t("admin.court.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const UTILIZATION_DAYS = 30
const UTILIZATION_HOURS = Array.from({ length: 15 }, (_, i) => 7 + i) // 07:00–21:00
const UTILIZATION_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

function occupancyColor(occupancy: number): string {
  if (occupancy <= 0) return "bg-pebble"
  if (occupancy < 0.25) return "bg-signal-blue/25"
  if (occupancy < 0.5) return "bg-signal-blue/50"
  if (occupancy < 0.75) return "bg-signal-blue/75"
  return "bg-signal-blue"
}

function CourtUtilizationDialog({ court, trigger }: { court: Court; trigger: ReactNode }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["court-utilization", court.id, UTILIZATION_DAYS],
    queryFn: () => api.getCourtUtilization(token!, court.id, UTILIZATION_DAYS),
    enabled: open,
  })

  const cellByKey = new Map(data?.cells.map((cell) => [`${cell.day_of_week}-${cell.hour}`, cell]) ?? [])
  const hasAnyBookings = (data?.cells ?? []).some((cell) => cell.booked_count > 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.utilization.dialog.title", { court: court.name })}</DialogTitle>
          <DialogDescription>{t("admin.utilization.dialog.description", { days: UTILIZATION_DAYS })}</DialogDescription>
        </DialogHeader>

        {isLoading && <Skeleton className="h-64 w-full" />}

        {!isLoading && !hasAnyBookings && <p className="py-8 text-center text-sm text-slate-gray">{t("admin.utilization.empty")}</p>}

        {!isLoading && hasAnyBookings && (
          <div className="overflow-x-auto pb-2">
            <div
              className="grid min-w-[560px] gap-1"
              style={{ gridTemplateColumns: `32px repeat(${UTILIZATION_HOURS.length}, minmax(0, 1fr))` }}
            >
              <div />
              {UTILIZATION_HOURS.map((hour) => (
                <div key={hour} className="text-center text-[10px] text-slate-gray">
                  {hour}
                </div>
              ))}
              {UTILIZATION_WEEKDAYS.map((day) => (
                <Fragment key={day}>
                  <div className="flex items-center text-xs font-medium text-slate-gray">
                    {t(`weekday.${day}` as TranslationKey)}
                  </div>
                  {UTILIZATION_HOURS.map((hour) => {
                    const cell = cellByKey.get(`${day}-${hour}`)
                    const occupancy = cell?.occupancy ?? 0
                    return (
                      <div
                        key={hour}
                        title={`${t(`weekday.${day}` as TranslationKey)} ${hour}:00 — ${Math.round(occupancy * 100)}%`}
                        className={cn("aspect-square rounded-sm", occupancyColor(occupancy))}
                      />
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CourtsTab() {
  const { token, user: currentUser } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<Court | null>(null)
  const isAdmin = currentUser?.role === "ADMIN"

  const {
    data: courts,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-courts"],
    queryFn: () => api.listCourts({ includeInactive: true }, token),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-courts"] })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCourt(token!, id),
    onSuccess: () => {
      toast.success(t("admin.toast.courtDeleted"))
      setDeleteTarget(null)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.courtDelete")),
  })

  const createMutation = useMutation({
    mutationFn: (values: CourtFormValues) =>
      api.createCourt(token!, {
        name: values.name,
        sport_type: values.sport_type,
        indoor: values.indoor,
        requires_approval: values.requires_approval,
        description: values.description || undefined,
        amenities: values.amenities,
        price_per_hour: values.price_per_hour === "" ? undefined : Number(values.price_per_hour),
      }),
    onSuccess: () => {
      toast.success(t("admin.toast.courtCreated"))
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.courtCreate")),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<Court> }) => api.updateCourt(token!, id, values),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.courtUpdate")),
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
              <Plus className="size-4" /> {t("admin.court.add")}
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-64 w-full rounded-2xl" />)}

        {isError && (
          <ErrorState
            className="col-span-full"
            title={t("common.error.title")}
            description={t("common.error.description")}
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && courts?.length === 0 && (
          <EmptyState
            className="col-span-full"
            title={t("admin.court.empty.title")}
            description={t("admin.court.empty.description")}
            action={
              <CourtFormDialog
                onSaved={async (values) => {
                  await createMutation.mutateAsync(values)
                }}
                trigger={
                  <Button size="sm" className="mt-2">
                    <Plus className="size-4" /> {t("admin.court.add")}
                  </Button>
                }
              />
            }
          />
        )}

        {courts?.map((court) => (
          <div key={court.id} className="flex flex-col overflow-hidden rounded-2xl border border-hairline bg-card shadow-card">
            <CourtArt sport={court.sport_type} indoor={court.indoor} imageUrl={court.image_url} compact className="rounded-none" />
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-semibold text-ink-navy">{court.name}</span>
                  <span className="text-xs text-slate-gray">
                    {sportLabels[court.sport_type]}
                    {" · "}
                    {court.price_per_hour !== null
                      ? t("courts.pricePerHour", { price: formatCurrency(court.price_per_hour) })
                      : t("courts.priceUnset")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CourtUtilizationDialog
                    court={court}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8" aria-label={t("admin.court.utilizationAria")}>
                        <BarChart3 className="size-4" />
                      </Button>
                    }
                  />
                  <CourtFormDialog
                    court={court}
                    onSaved={async (values) => {
                      await updateMutation.mutateAsync({
                        id: court.id,
                        values: {
                          name: values.name,
                          sport_type: values.sport_type,
                          indoor: values.indoor,
                          requires_approval: values.requires_approval,
                          description: values.description || undefined,
                          amenities: values.amenities,
                          price_per_hour: values.price_per_hour === "" ? null : Number(values.price_per_hour),
                        },
                      })
                    }}
                    onImageUploaded={invalidate}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8" aria-label={t("admin.court.editAria")}>
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      aria-label={t("admin.court.deleteAria")}
                      onClick={() => setDeleteTarget(court)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-hairline pt-3">
                <span className="flex flex-wrap items-center gap-2 text-sm text-slate-gray">
                  {court.active ? t("admin.court.visible") : t("admin.court.hidden")}
                  {court.requires_approval && <Badge variant="warning">{t("courts.requiresApproval")}</Badge>}
                </span>
                <Switch
                  checked={court.active}
                  onCheckedChange={(checked) => updateMutation.mutate({ id: court.id, values: { active: checked } })}
                  aria-label={court.active ? t("admin.court.visible") : t("admin.court.hidden")}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("admin.court.confirmDelete.title")}
        description={deleteTarget ? t("admin.court.confirmDelete.description", { name: deleteTarget.name }) : undefined}
        confirmLabel={t("admin.court.delete")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  )
}

const STATUS_FILTERS: (ReservationStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "REJECTED",
  "NO_SHOW",
]

const CANCELLABLE_STATUSES: ReservationStatus[] = ["PENDING", "PENDING_APPROVAL", "CONFIRMED"]

function ReservationHistoryDialog({ reservation, trigger }: { reservation: ReservationAdmin; trigger: ReactNode }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const { data: history, isLoading } = useQuery({
    queryKey: ["reservation-history", reservation.id],
    queryFn: () => api.getReservationHistory(token!, reservation.id),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.reservations.historyDialog.title")}</DialogTitle>
          <DialogDescription>{reservation.court.name}</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-24 w-full" />}
        {!isLoading && history?.length === 0 && <p className="text-sm text-slate-gray">{t("admin.reservations.historyDialog.empty")}</p>}
        <div className="flex flex-col gap-3">
          {history?.map((event) => (
            <div key={event.id} className="flex items-start gap-3 border-b border-hairline pb-3 last:border-b-0">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-signal-blue" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-ink-navy">{t(`event.${event.event_type}` as TranslationKey)}</span>
                <span className="text-xs text-slate-gray">{new Date(event.created_at).toLocaleString()}</span>
                {event.note && <span className="text-xs text-slate-gray">{event.note}</span>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReservationsTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const statusLabels = useStatusLabels()
  const queryClient = useQueryClient()
  // A notification can deep-link here with ?status=PENDING_APPROVAL (the manager's approval queue).
  const [searchParams] = useSearchParams()
  const linkedStatus = searchParams.get("status") as ReservationStatus | null
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "ALL">(
    linkedStatus && STATUS_FILTERS.includes(linkedStatus) ? linkedStatus : "ALL",
  )
  const [cancelTarget, setCancelTarget] = useState<ReservationAdmin | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ReservationAdmin | null>(null)

  const {
    data: reservations,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-reservations", statusFilter],
    queryFn: () => api.listAllReservations(token!, statusFilter === "ALL" ? undefined : statusFilter),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-reservations"] })

  const cancelMutation = useMutation({
    mutationFn: (reservation: ReservationAdmin) => api.cancelReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success(t("admin.toast.reservationCancelled"))
      setCancelTarget(null)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.reservationCancel")),
  })

  const confirmMutation = useMutation({
    mutationFn: (reservation: ReservationAdmin) => api.confirmReservation(token!, reservation.id),
    onSuccess: (confirmed) => {
      toast.success(
        t(confirmed.status === "PENDING_APPROVAL" ? "admin.toast.reservationSubmitted" : "admin.toast.reservationConfirmed"),
      )
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.reservationConfirm")),
  })

  const approveMutation = useMutation({
    mutationFn: (reservation: ReservationAdmin) => api.approveReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success(t("admin.toast.reservationApproved"))
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.reservationApprove")),
  })

  const rejectMutation = useMutation({
    mutationFn: (reservation: ReservationAdmin) => api.rejectReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success(t("admin.toast.reservationRejected"))
      setRejectTarget(null)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.reservationReject")),
  })

  const checkInMutation = useMutation({
    mutationFn: (reservation: ReservationAdmin) => api.checkInReservation(token!, reservation.id),
    onSuccess: () => {
      toast.success(t("admin.toast.reservationCheckedIn"))
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.reservationCheckIn")),
  })

  const isBusy =
    cancelMutation.isPending ||
    confirmMutation.isPending ||
    checkInMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending

  const exportMutation = useMutation({
    mutationFn: () => api.exportReservationsCsv(token!, statusFilter === "ALL" ? undefined : statusFilter),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.reservationCancel")),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="outline" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
          <Download className="size-3.5" /> {t("admin.reservations.exportCsv")}
        </Button>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ReservationStatus | "ALL")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((status) => (
              <SelectItem key={status} value={status}>
                {status === "ALL" ? t("admin.reservations.allStatuses") : statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}

        {isError && (
          <ErrorState title={t("common.error.title")} description={t("common.error.description")} onRetry={() => refetch()} />
        )}

        {!isLoading && !isError && reservations?.length === 0 && (
          <EmptyState title={t("admin.reservations.empty.title")} description={t("admin.reservations.empty.description")} />
        )}

        {reservations?.map((reservation) => (
          <DataRow key={reservation.id} className="p-5">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-ink-navy">{reservation.court.name}</span>
              <span className="text-sm text-slate-gray">{formatDateRange(reservation.start_time, reservation.end_time)}</span>
              <span className="text-xs text-slate-gray">
                {reservation.user.name} · {reservation.user.email}
              </span>
              {reservation.open_to_join && (
                <Badge variant="secondary" className="w-fit">
                  {t("admin.reservations.openBadge")}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[reservation.status]}>{statusLabels[reservation.status]}</Badge>
              {reservation.status === "PENDING" && (
                <Button size="sm" disabled={isBusy} onClick={() => confirmMutation.mutate(reservation)}>
                  {t("admin.reservations.confirm")}
                </Button>
              )}
              {reservation.status === "PENDING_APPROVAL" && (
                <>
                  <Button size="sm" disabled={isBusy} onClick={() => approveMutation.mutate(reservation)}>
                    {t("admin.reservations.approve")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => setRejectTarget(reservation)}>
                    {t("admin.reservations.reject")}
                  </Button>
                </>
              )}
              {reservation.status === "CONFIRMED" && (
                <Button size="sm" variant="dark" disabled={isBusy} onClick={() => checkInMutation.mutate(reservation)}>
                  {t("admin.reservations.checkIn")}
                </Button>
              )}
              <ReservationHistoryDialog
                reservation={reservation}
                trigger={
                  <Button size="sm" variant="ghost" aria-label={t("admin.reservations.history")}>
                    <History className="size-3.5" />
                  </Button>
                }
              />
              {CANCELLABLE_STATUSES.includes(reservation.status) && new Date(reservation.start_time) > new Date() && (
                <Button size="sm" variant="outline" disabled={isBusy} onClick={() => setCancelTarget(reservation)}>
                  {t("admin.reservations.cancel")}
                </Button>
              )}
            </div>
          </DataRow>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title={t("confirmDialog.cancelReservation.title")}
        description={t("confirmDialog.cancelReservation.description")}
        confirmLabel={t("confirmDialog.cancelReservation.confirm")}
        isLoading={cancelMutation.isPending}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget)}
      />

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title={t("confirmDialog.rejectReservation.title")}
        description={t("confirmDialog.rejectReservation.description")}
        confirmLabel={t("confirmDialog.rejectReservation.confirm")}
        isLoading={rejectMutation.isPending}
        onConfirm={() => rejectTarget && rejectMutation.mutate(rejectTarget)}
      />
    </div>
  )
}

function AvailabilityTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: courts } = useQuery({ queryKey: ["admin-courts"], queryFn: () => api.listCourts({ includeInactive: true }, token) })
  const [filterCourtId, setFilterCourtId] = useState("ALL")
  const {
    data: blocks,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["facility-blocks", filterCourtId],
    queryFn: () => api.listFacilityBlocks(filterCourtId === "ALL" ? undefined : filterCourtId),
  })

  const [courtId, setCourtId] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [reason, setReason] = useState("")
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [weeks, setWeeks] = useState("4")
  const [deleteTarget, setDeleteTarget] = useState<FacilityBlock | null>(null)
  const [deleteSeriesTarget, setDeleteSeriesTarget] = useState<FacilityBlock | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["facility-blocks"] })

  const createMutation = useMutation({
    mutationFn: () =>
      api.createFacilityBlock(token!, {
        court_id: courtId,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        reason,
        weeks: repeatWeekly ? Number(weeks) : undefined,
      }),
    onSuccess: () => {
      toast.success(t("admin.toast.blockCreated"))
      setReason("")
      setRepeatWeekly(false)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.blockCreate")),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFacilityBlock(token!, id),
    onSuccess: () => {
      toast.success(t("admin.toast.blockRemoved"))
      setDeleteTarget(null)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.blockRemove")),
  })

  const deleteSeriesMutation = useMutation({
    mutationFn: (seriesId: string) => api.deleteFacilityBlockSeries(token!, seriesId),
    onSuccess: () => {
      toast.success(t("admin.toast.blockSeriesRemoved"))
      setDeleteSeriesTarget(null)
      invalidate()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.blockRemove")),
  })

  const weeksNumber = Number(weeks)
  const canSubmit =
    Boolean(courtId && start && end && reason.trim()) &&
    (!repeatWeekly || (weeksNumber >= 2 && weeksNumber <= 26)) &&
    !createMutation.isPending

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="h-fit gap-5">
        <CardHeader>
          <CardTitle>{t("admin.availability.blockTitle")}</CardTitle>
          <CardDescription>{t("admin.availability.blockDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t("admin.availability.court")}</Label>
            <Select value={courtId} onValueChange={setCourtId}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.availability.choosePlaceholder")} />
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
              <Label htmlFor="block-start">{t("admin.availability.from")}</Label>
              <Input id="block-start" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-end">{t("admin.availability.to")}</Label>
              <Input id="block-end" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="block-reason">{t("admin.availability.reason")}</Label>
            <Input
              id="block-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("admin.availability.reasonPlaceholder")}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="block-repeat">{t("admin.availability.repeatWeekly")}</Label>
              <span className="text-xs text-slate-gray">{t("admin.availability.repeatWeeklyHint")}</span>
            </div>
            <Switch id="block-repeat" checked={repeatWeekly} onCheckedChange={setRepeatWeekly} />
          </div>
          {repeatWeekly && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-weeks">{t("admin.availability.weeks")}</Label>
              <Input
                id="block-weeks"
                type="number"
                min={2}
                max={26}
                value={weeks}
                onChange={(event) => setWeeks(event.target.value)}
              />
            </div>
          )}
          <Button disabled={!canSubmit} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? t("admin.availability.submitting") : t("admin.availability.submit")}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Select value={filterCourtId} onValueChange={setFilterCourtId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t("admin.availability.filterCourt")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("admin.availability.allCourts")}</SelectItem>
              {courts?.map((court) => (
                <SelectItem key={court.id} value={court.id}>
                  {court.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
        {isError && (
          <ErrorState title={t("common.error.title")} description={t("common.error.description")} onRetry={() => refetch()} />
        )}
        {!isLoading && !isError && blocks?.length === 0 && (
          <EmptyState title={t("admin.availability.empty.title")} description={t("admin.availability.empty.description")} />
        )}
        {blocks?.map((block) => (
          <DataRow key={block.id} className="gap-2 p-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink-navy">{block.court.name}</span>
                {block.series_id && <Badge variant="outline">{t("admin.availability.recurring")}</Badge>}
              </div>
              <span className="text-sm text-slate-gray">{formatDateRange(block.start_time, block.end_time)}</span>
              <span className="text-xs text-slate-gray">{block.reason}</span>
              <span className="text-xs text-mist-gray">
                {t("admin.availability.createdOn", { date: new Date(block.created_at).toLocaleDateString() })}
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              {block.series_id && (
                <Button size="sm" variant="outline" onClick={() => setDeleteSeriesTarget(block)}>
                  {t("admin.availability.removeSeries")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setDeleteTarget(block)}>
                {t("admin.availability.remove")}
              </Button>
            </div>
          </DataRow>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("confirmDialog.deleteBlock.title")}
        description={t("confirmDialog.deleteBlock.description")}
        confirmLabel={t("admin.availability.remove")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      <ConfirmDialog
        open={Boolean(deleteSeriesTarget)}
        onOpenChange={(open) => !open && setDeleteSeriesTarget(null)}
        title={t("confirmDialog.deleteBlockSeries.title")}
        description={t("confirmDialog.deleteBlockSeries.description")}
        confirmLabel={t("admin.availability.removeSeries")}
        isLoading={deleteSeriesMutation.isPending}
        onConfirm={() => deleteSeriesTarget?.series_id && deleteSeriesMutation.mutate(deleteSeriesTarget.series_id)}
      />
    </div>
  )
}

const STATUS_ORDER: ReservationStatus[] = [
  "PENDING",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "REJECTED",
  "NO_SHOW",
]

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

const STATS_WINDOW_OPTIONS = [7, 30, 90] as const

function OverviewTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const statusLabels = useStatusLabels()
  const [windowDays, setWindowDays] = useState<(typeof STATS_WINDOW_OPTIONS)[number]>(30)
  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ["admin-stats", windowDays], queryFn: () => api.getAdminStats(token!, windowDays) })

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (isError || !stats) {
    return <ErrorState title={t("common.error.title")} description={t("common.error.description")} onRetry={() => refetch()} />
  }

  const maxStatus = Math.max(1, ...Object.values(stats.status_breakdown))
  const maxCourtCount = Math.max(1, ...stats.top_courts.map((c) => c.reservation_count))
  const hourly = Array.from({ length: 24 }, (_, hour) => stats.busiest_hours.find((h) => h.hour === hour)?.count ?? 0)
  const maxHourly = Math.max(1, ...hourly)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={CalendarClock} label={t("admin.overview.totalReservations")} value={stats.total_reservations} />
        <div className="flex flex-col gap-1.5">
          <StatTile
            icon={Clock3}
            label={t("admin.overview.reservationsInWindow", { days: stats.window_days })}
            value={stats.reservations_in_window}
          />
          <div className="flex gap-1 px-1">
            {STATS_WINDOW_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days)}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                  days === windowDays ? "bg-ink-navy text-paper" : "text-slate-gray hover:bg-pebble",
                )}
              >
                {t("admin.overview.windowDays", { days })}
              </button>
            ))}
          </div>
        </div>
        <StatTile icon={AlertTriangle} label={t("admin.overview.noShowRate")} value={`${Math.round(stats.no_show_rate * 100)}%`} />
        <StatTile icon={Users} label={t("admin.overview.players")} value={stats.total_users} />
        <StatTile icon={LayoutGrid} label={t("admin.overview.courts")} value={stats.total_courts} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.overview.statusTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {STATUS_ORDER.map((status) => (
              <BarRow key={status} label={statusLabels[status]} value={stats.status_breakdown[status] ?? 0} max={maxStatus} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.overview.topCourtsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {stats.top_courts.length === 0 && <p className="text-sm text-slate-gray">{t("admin.overview.topCourtsEmpty")}</p>}
            {stats.top_courts.map((entry) => (
              <BarRow key={entry.court.id} label={entry.court.name} value={entry.reservation_count} max={maxCourtCount} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.overview.busiestHoursTitle")}</CardTitle>
          <CardDescription>{t("admin.overview.busiestHoursDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <div className="flex h-32 items-end gap-1">
              {hourly.map((count, hour) => (
                <div key={hour} className="flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-sm bg-signal-blue"
                    style={{ height: `${Math.max(2, Math.round((count / maxHourly) * 100))}%` }}
                    title={`${hour}:00 — ${count}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              {hourly.map((_, hour) => (
                <div key={hour} className="flex-1 text-center text-[10px] text-slate-gray">
                  {hour % 3 === 0 ? hour : ""}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const CHALLENGE_METRICS: ChallengeMetric[] = [
  "RESERVATIONS_COMPLETED",
  "COURTS_PLAYED",
  "GUESTS_INVITED",
  "REVIEWS_WRITTEN",
]

function ChallengesTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [sport, setSport] = useState<SportType | "ANY">("ANY")
  const [metric, setMetric] = useState<ChallengeMetric>("RESERVATIONS_COMPLETED")
  const [target, setTarget] = useState("5")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")

  const { data: challenges, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: () => api.listChallenges(token!),
    enabled: Boolean(token),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.createChallenge(token!, {
        title,
        description,
        sport_type: sport === "ANY" ? undefined : sport,
        metric,
        target: Number(target),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      }),
    onSuccess: () => {
      toast.success(t("admin.challenges.toast.created"))
      setCreateOpen(false)
      setTitle("")
      setDescription("")
      setSport("ANY")
      setTarget("5")
      setStartsAt("")
      setEndsAt("")
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.challenges.error.create")),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> {t("admin.challenges.create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.challenges.create.title")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                createMutation.mutate()
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="challenge-title">{t("admin.challenges.field.title")}</Label>
                <Input id="challenge-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="challenge-description">{t("admin.challenges.field.description")}</Label>
                <Textarea
                  id="challenge-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                  rows={2}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>{t("admin.challenges.field.sport")}</Label>
                  <Select value={sport} onValueChange={(value) => setSport(value as SportType | "ANY")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANY">{t("teams.field.sport.any")}</SelectItem>
                      {(["TENNIS", "VOLLEYBALL", "BADMINTON"] as SportType[]).map((option) => (
                        <SelectItem key={option} value={option}>
                          {sportLabels[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("admin.challenges.field.metric")}</Label>
                  <Select value={metric} onValueChange={(value) => setMetric(value as ChallengeMetric)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHALLENGE_METRICS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`admin.challenges.metric.${option}` as TranslationKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="challenge-target">{t("admin.challenges.field.target")}</Label>
                  <Input
                    id="challenge-target"
                    type="number"
                    min={1}
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="challenge-starts">{t("admin.challenges.field.startsAt")}</Label>
                  <Input
                    id="challenge-starts"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="challenge-ends">{t("admin.challenges.field.endsAt")}</Label>
                  <Input
                    id="challenge-ends"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={createMutation.isPending} className="mt-1 w-fit">
                {t("admin.challenges.create.submit")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}

      {isError && (
        <ErrorState title={t("common.error.title")} description={t("common.error.description")} onRetry={() => refetch()} />
      )}

      {!isLoading && challenges?.length === 0 && <EmptyState title={t("admin.challenges.empty")} />}

      {challenges?.map((challenge) => (
        <DataRow key={challenge.id}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink-navy">{challenge.title}</span>
              {challenge.sport_type && <Badge variant="secondary">{sportLabels[challenge.sport_type]}</Badge>}
            </div>
            <span className="text-sm text-slate-gray">{challenge.description}</span>
            <span className="text-xs text-slate-gray">
              {t(`admin.challenges.metric.${challenge.metric}` as TranslationKey)} ·{" "}
              {t("admin.challenges.target", { target: challenge.target })} ·{" "}
              {new Date(challenge.starts_at).toLocaleDateString()} – {new Date(challenge.ends_at).toLocaleDateString()}
            </span>
          </div>
        </DataRow>
      ))}
    </div>
  )
}

function UsersTab() {
  const { token, user: currentUser } = useAuth()
  const { t } = useTranslation()
  const roleLabels = useRoleLabels()
  const queryClient = useQueryClient()
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: UserAdmin; role: UserRole } | null>(null)
  const {
    data: users,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ["admin-users"], queryFn: () => api.listAdminUsers(token!) })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => api.updateUserRole(token!, userId, role),
    onSuccess: () => {
      toast.success(t("admin.toast.roleUpdated"))
      setRoleChangeTarget(null)
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.roleUpdate")),
  })

  const isCurrentUserAdmin = currentUser?.role === "ADMIN"
  const isGrant = roleChangeTarget?.role === "ADMIN"

  function handleRoleChange(user: UserAdmin, role: UserRole) {
    if (role === user.role) return
    // Granting or revoking the top tier is significant enough to confirm;
    // the existing PLAYER <-> VENUE_MANAGER toggle stays a single click.
    if (role === "ADMIN" || user.role === "ADMIN") {
      setRoleChangeTarget({ user, role })
    } else {
      roleMutation.mutate({ userId: user.id, role })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}

      {isError && (
        <ErrorState title={t("common.error.title")} description={t("common.error.description")} onRetry={() => refetch()} />
      )}

      {users?.map((user) => {
        const isSelf = user.id === currentUser?.id
        const canEditRole = !isSelf && (isCurrentUserAdmin || user.role !== "ADMIN")
        return (
          <DataRow key={user.id}>
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={assetUrl(user.avatar_url)} alt={user.name} loading="lazy" className="object-cover" />
                <AvatarFallback>
                  {user.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-ink-navy">{user.name}</span>
                <span className="text-sm text-slate-gray">{user.email}</span>
                <span className="text-xs text-slate-gray">
                  {t("admin.users.activeCount", { count: user.active_reservation_count })} ·{" "}
                  {user.no_show_count}{" "}
                  {user.no_show_count === 1 ? t("admin.users.noShow.one") : t("admin.users.noShow.other")}
                </span>
                <span className="text-xs text-mist-gray">
                  {t("admin.users.memberSince", { date: new Date(user.created_at).toLocaleDateString() })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={ROLE_VARIANT[user.role]}>{roleLabels[user.role]}</Badge>
              {isSelf ? (
                <Button size="sm" variant="outline" disabled>
                  {t("admin.users.you")}
                </Button>
              ) : !canEditRole ? (
                <Button size="sm" variant="outline" disabled>
                  {t("admin.users.adminOnly")}
                </Button>
              ) : (
                <Select
                  value={user.role}
                  onValueChange={(role) => handleRoleChange(user, role as UserRole)}
                  disabled={roleMutation.isPending}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLAYER">{roleLabels.PLAYER}</SelectItem>
                    <SelectItem value="VENUE_MANAGER">{roleLabels.VENUE_MANAGER}</SelectItem>
                    {isCurrentUserAdmin && <SelectItem value="ADMIN">{roleLabels.ADMIN}</SelectItem>}
                  </SelectContent>
                </Select>
              )}
            </div>
          </DataRow>
        )
      })}

      <ConfirmDialog
        open={Boolean(roleChangeTarget)}
        onOpenChange={(open) => !open && setRoleChangeTarget(null)}
        title={isGrant ? t("admin.users.confirmGrantAdmin.title") : t("admin.users.confirmRevokeAdmin.title")}
        description={
          roleChangeTarget
            ? t(isGrant ? "admin.users.confirmGrantAdmin.description" : "admin.users.confirmRevokeAdmin.description", {
                name: roleChangeTarget.user.name,
                role: roleLabels[roleChangeTarget.role],
              })
            : undefined
        }
        confirmLabel={isGrant ? t("admin.users.confirmGrantAdmin.confirm") : t("admin.users.confirmRevokeAdmin.confirm")}
        destructive={!isGrant}
        isLoading={roleMutation.isPending}
        onConfirm={() =>
          roleChangeTarget && roleMutation.mutate({ userId: roleChangeTarget.user.id, role: roleChangeTarget.role })
        }
      />
    </div>
  )
}

function AdminPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeader
        align="left"
        eyebrow={t("admin.header.eyebrow")}
        title={t("admin.header.title")}
        description={t("admin.header.description")}
      />

      {/* key: re-mount when a notification deep-links to another tab while this page is already open */}
      <Tabs key={searchParams.toString()} defaultValue={searchParams.get("tab") ?? "overview"} className="mt-10">
        <div className="-mx-6 overflow-x-auto px-6 pb-1">
          <TabsList>
            <TabsTrigger value="overview">{t("admin.tabs.overview")}</TabsTrigger>
            <TabsTrigger value="courts">{t("admin.tabs.courts")}</TabsTrigger>
            <TabsTrigger value="reservations">{t("admin.tabs.reservations")}</TabsTrigger>
            <TabsTrigger value="availability">{t("admin.tabs.availability")}</TabsTrigger>
            <TabsTrigger value="challenges">{t("admin.tabs.challenges")}</TabsTrigger>
            <TabsTrigger value="users">{t("admin.tabs.users")}</TabsTrigger>
          </TabsList>
        </div>
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
        <TabsContent value="challenges">
          <ChallengesTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { AdminPage }
