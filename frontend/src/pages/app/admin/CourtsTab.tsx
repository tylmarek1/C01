import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BarChart3, Camera, Eye, EyeOff, ImagePlus, LayoutGrid, MoreHorizontal, Pencil, Plus, ShieldCheck, Star, Trash2, X } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Heatmap } from "@/components/shared/charts"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CourtArt } from "@/components/shared/court-art"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { FilterChip } from "@/components/shared/filter-chip"
import { SearchInput } from "@/components/shared/search-input"
import { useSportLabels } from "@/components/shared/sport-icon"
import { ApiError, api, assetUrl } from "@/lib/api"
import { ALL_AMENITIES, AMENITY_ICON, useAmenityLabels } from "@/lib/amenities"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency, useFormatters } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { compressImageFile } from "@/lib/image"
import { cn } from "@/lib/utils"
import type { Amenity, Court, SportType } from "@/types"

const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]
const MAX_GALLERY = 8

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
  open,
  onOpenChange,
  onSaved,
  onImageUploaded,
}: {
  court?: Court
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (values: CourtFormValues) => Promise<void>
  onImageUploaded?: () => void
}) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const amenityLabels = useAmenityLabels()
  const [values, setValues] = useState<CourtFormValues>(() => formValuesFromCourt(court))
  const [isSaving, setIsSaving] = useState(false)
  const [touched, setTouched] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setValues(formValuesFromCourt(court))
      setTouched(false)
    }
  }

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

  const nameError = touched && values.name.trim().length === 0 ? t("admin.court.nameRequired") : null
  const priceError = values.price_per_hour !== "" && Number(values.price_per_hour) < 0 ? t("admin.court.priceInvalid") : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (values.name.trim().length === 0 || priceError) return
    setIsSaving(true)
    try {
      await onSaved({ ...values, name: values.name.trim() })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{court ? t("admin.court.editTitle") : t("admin.court.addTitle")}</DialogTitle>
          <DialogDescription>{court ? t("admin.court.editDescription") : t("admin.court.addDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          {court && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <CourtArt sport={court.sport_type} imageUrl={court.image_url} compact className="size-16 shrink-0 rounded-md" />
                <div className="flex flex-col gap-1.5">
                  <Button type="button" variant="outline" size="sm" isLoading={imageMutation.isPending} onClick={() => fileInputRef.current?.click()}>
                    {!imageMutation.isPending && <Camera />} {imageMutation.isPending ? t("admin.court.uploading") : t("admin.court.uploadPhoto")}
                  </Button>
                  <span className="text-xs text-muted-foreground">{t("admin.court.photoFallback")}</span>
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
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <span className="flex items-center justify-between text-[13px] font-medium">
                  {t("admin.court.gallery")}
                  <span className="font-mono text-[11px] text-muted-foreground tabular">
                    {court.images.length}/{MAX_GALLERY}
                  </span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {court.images.map((image) => (
                    <div key={image.id} className="group relative size-14 shrink-0 overflow-hidden rounded-md border border-border">
                      <img src={assetUrl(image.url)} alt="" loading="lazy" className="size-full object-cover" />
                      <button
                        type="button"
                        disabled={galleryRemoveMutation.isPending}
                        onClick={() => galleryRemoveMutation.mutate(image.id)}
                        aria-label={t("admin.court.gallery.remove")}
                        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary/80 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  {court.images.length < MAX_GALLERY && (
                    <button
                      type="button"
                      disabled={galleryAddMutation.isPending}
                      onClick={() => galleryInputRef.current?.click()}
                      aria-label={t("admin.court.gallery.add")}
                      className="flex size-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                    >
                      <ImagePlus className="size-4" />
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
                <span className="text-xs text-muted-foreground">{t("admin.court.gallery.hint")}</span>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="court-name">{t("admin.court.name")}</Label>
              <Input
                id="court-name"
                value={values.name}
                onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
                onBlur={() => setTouched(true)}
                placeholder={t("admin.court.namePlaceholder")}
                aria-invalid={Boolean(nameError)}
                maxLength={100}
                autoFocus={!court}
              />
              {nameError && <span className="text-xs text-danger">{nameError}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="court-price">{t("admin.court.pricePerHour")}</Label>
              <div className="relative">
                <Input
                  id="court-price"
                  type="number"
                  min={0}
                  step="10"
                  inputMode="numeric"
                  value={values.price_per_hour}
                  onChange={(event) => setValues((v) => ({ ...v, price_per_hour: event.target.value }))}
                  placeholder={t("admin.court.pricePlaceholder")}
                  className="pr-10"
                  aria-invalid={Boolean(priceError)}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">Kč</span>
              </div>
              {priceError && <span className="text-xs text-danger">{priceError}</span>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>{t("admin.court.sport")}</Label>
              <Select value={values.sport_type} onValueChange={(value) => setValues((v) => ({ ...v, sport_type: value as SportType }))}>
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
              <div className="flex h-9 items-center gap-1 rounded-md border border-border bg-muted p-0.5">
                {[false, true].map((indoor) => (
                  <button
                    key={String(indoor)}
                    type="button"
                    onClick={() => setValues((v) => ({ ...v, indoor }))}
                    aria-pressed={values.indoor === indoor}
                    className={cn(
                      "h-full flex-1 rounded-sm text-[13px] font-medium transition-colors",
                      values.indoor === indoor ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {indoor ? t("admin.court.indoorCourt") : t("admin.court.outdoorCourt")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-3">
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-[13px] font-medium">
                <ShieldCheck className="size-3.5" /> {t("admin.court.requiresApproval")}
              </span>
              <span className="text-xs text-muted-foreground">{t("admin.court.requiresApprovalHint")}</span>
            </span>
            <Switch
              checked={values.requires_approval}
              onCheckedChange={(checked) => setValues((v) => ({ ...v, requires_approval: checked }))}
              aria-label={t("admin.court.requiresApproval")}
            />
          </label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="court-description">{t("admin.court.description")}</Label>
            <Textarea
              id="court-description"
              value={values.description}
              onChange={(event) => setValues((v) => ({ ...v, description: event.target.value }))}
              placeholder={t("admin.court.descriptionPlaceholder")}
              maxLength={500}
              rows={3}
            />
            <span className="self-end font-mono text-[11px] text-subtle-foreground tabular">{values.description.length}/500</span>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("admin.court.amenities")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_AMENITIES.map((amenity) => {
                const active = values.amenities.includes(amenity)
                const Icon = AMENITY_ICON[amenity]
                return (
                  <FilterChip
                    key={amenity}
                    active={active}
                    onClick={() =>
                      setValues((v) => ({ ...v, amenities: active ? v.amenities.filter((a) => a !== amenity) : [...v.amenities, amenity] }))
                    }
                  >
                    {!active && <Icon className="size-3" />} {amenityLabels[amenity]}
                  </FilterChip>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {isSaving ? t("admin.court.saving") : court ? t("admin.court.save") : t("admin.court.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const UTILIZATION_DAYS = 30
const UTILIZATION_HOURS = Array.from({ length: 15 }, (_, i) => 7 + i)
const UTILIZATION_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

function CourtUtilizationDialog({ court, open, onOpenChange }: { court: Court; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const { data, isLoading } = useQuery({
    queryKey: ["court-utilization", court.id, UTILIZATION_DAYS],
    queryFn: () => api.getCourtUtilization(token!, court.id, UTILIZATION_DAYS),
    enabled: open,
  })
  const cellByKey = new Map(data?.cells.map((cell) => [`${cell.day_of_week}-${cell.hour}`, cell]) ?? [])
  const hasAnyBookings = (data?.cells ?? []).some((cell) => cell.booked_count > 0)
  const overall = data
    ? data.cells.reduce((sum, c) => sum + c.booked_count, 0) / Math.max(1, data.cells.reduce((sum, c) => sum + c.possible_count, 0))
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.utilization.dialog.title", { court: court.name })}</DialogTitle>
          <DialogDescription>{t("admin.utilization.dialog.description", { days: UTILIZATION_DAYS })}</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-64 w-full" />}
        {!isLoading && !hasAnyBookings && <EmptyState size="compact" icon={BarChart3} title={t("admin.utilization.empty")} />}
        {!isLoading && hasAnyBookings && (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[34px] leading-none font-extrabold tabular">{fmt.percent(overall)}</span>
              <span className="text-[13px] text-muted-foreground">{t("admin.utilization.overall")}</span>
            </div>
            <Heatmap
              ariaLabel={t("admin.utilization.dialog.title", { court: court.name })}
              rows={UTILIZATION_WEEKDAYS.map((day) => ({ key: day, label: t(`weekday.${day}` as TranslationKey) }))}
              columns={UTILIZATION_HOURS.map((hour) => ({ key: hour, label: String(hour) }))}
              value={(day, hour) => cellByKey.get(`${day}-${hour}`)?.occupancy ?? 0}
              tooltip={(day, hour, v) => {
                const cell = cellByKey.get(`${day}-${hour}`)
                return `${t(`weekday.${day}` as TranslationKey)} ${String(hour).padStart(2, "0")}:00 — ${fmt.percent(v)} (${cell?.booked_count ?? 0}/${cell?.possible_count ?? 0})`
              }}
            />
          </>
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
  const [editTarget, setEditTarget] = useState<Court | null>(null)
  const [creating, setCreating] = useState(false)
  const [utilizationTarget, setUtilizationTarget] = useState<Court | null>(null)
  const [query, setQuery] = useState("")
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all")
  const isAdmin = currentUser?.role === "ADMIN"

  const { data: courts, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-courts"],
    queryFn: () => api.listCourts({ includeInactive: true }, token),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-courts"] })
    queryClient.invalidateQueries({ queryKey: ["courts"] })
  }

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (courts ?? [])
      .filter((court) => (visibility === "visible" ? court.active : visibility === "hidden" ? !court.active : true))
      .filter((court) => (q ? court.name.toLowerCase().includes(q) : true))
  }, [courts, query, visibility])

  // Keep the edit dialog's court in sync after a photo upload refetches the list.
  const liveEditTarget = editTarget ? (courts?.find((c) => c.id === editTarget.id) ?? editTarget) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={query} onValueChange={setQuery} placeholder={t("admin.court.searchPlaceholder")} className="sm:w-72" />
        <div className="flex gap-1.5">
          <FilterChip active={visibility === "all"} onClick={() => setVisibility("all")} count={courts?.length}>
            {t("admin.court.filter.all")}
          </FilterChip>
          <FilterChip active={visibility === "visible"} onClick={() => setVisibility("visible")} count={courts?.filter((c) => c.active).length}>
            {t("admin.court.visible")}
          </FilterChip>
          <FilterChip active={visibility === "hidden"} onClick={() => setVisibility("hidden")} count={courts?.filter((c) => !c.active).length}>
            {t("admin.court.hidden")}
          </FilterChip>
        </div>
        <Button size="sm" className="sm:ml-auto" onClick={() => setCreating(true)}>
          <Plus /> {t("admin.court.add")}
        </Button>
      </div>

      {isError && <ErrorState onRetry={() => refetch()} />}

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-72 rounded-xl" />)}
        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState
            className="col-span-full"
            icon={LayoutGrid}
            title={t("admin.court.empty.title")}
            description={t("admin.court.empty.description")}
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus /> {t("admin.court.add")}
              </Button>
            }
          />
        )}
        {filtered.map((court, index) => (
          <article
            key={court.id}
            style={{ "--i": index } as React.CSSProperties}
            className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs", !court.active && "opacity-80")}
          >
            <div className="relative p-1.5 pb-0">
              <CourtArt sport={court.sport_type} imageUrl={court.image_url} hideMeta className={cn("rounded-lg", !court.active && "grayscale")} />
              {!court.active && (
                <Badge variant="solid" className="absolute top-3.5 left-3.5">
                  <EyeOff /> {t("admin.court.hidden")}
                </Badge>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link to={`/courts/${court.id}`} className="truncate text-[14px] font-semibold hover:underline">
                    {court.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {sportLabels[court.sport_type]} · {court.indoor ? t("courts.indoor") : t("courts.outdoor")}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label={t("reservationCard.moreActions")}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditTarget(court)}>
                      <Pencil /> {t("admin.court.editAria")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setUtilizationTarget(court)}>
                      <BarChart3 /> {t("admin.court.utilizationAria")}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/courts/${court.id}`}>
                        <Eye /> {t("admin.court.viewPublic")}
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(court)}>
                          <Trash2 /> {t("admin.court.delete")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border text-xs">
                <div className="flex flex-col gap-0.5 bg-card p-2">
                  <dt className="text-muted-foreground">{t("admin.court.metric.price")}</dt>
                  <dd className="font-medium tabular">{court.price_per_hour !== null ? formatCurrency(court.price_per_hour) : "—"}</dd>
                </div>
                <div className="flex flex-col gap-0.5 bg-card p-2">
                  <dt className="text-muted-foreground">{t("admin.court.metric.rating")}</dt>
                  <dd className="flex items-center gap-1 font-medium tabular">
                    {court.average_rating !== null ? (
                      <>
                        <Star className="size-3 fill-star text-star" /> {court.average_rating.toFixed(1)}
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 bg-card p-2">
                  <dt className="text-muted-foreground">{t("admin.court.metric.reviews")}</dt>
                  <dd className="font-medium tabular">{court.review_count}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-1">
                {court.requires_approval && (
                  <Badge variant="info">
                    <ShieldCheck /> {t("courts.requiresApproval")}
                  </Badge>
                )}
                {court.amenities.slice(0, 3).map((amenity) => {
                  const Icon = AMENITY_ICON[amenity]
                  return (
                    <Badge key={amenity} variant="secondary">
                      <Icon />
                    </Badge>
                  )
                })}
              </div>
              <label className="mt-auto flex cursor-pointer items-center justify-between gap-3 border-t border-border pt-3 text-[13px]">
                <span className="flex flex-col">
                  <span className="font-medium">{court.active ? t("admin.court.visible") : t("admin.court.hidden")}</span>
                  <span className="text-xs text-muted-foreground">{court.active ? t("admin.court.visibleHint") : t("admin.court.hiddenHint")}</span>
                </span>
                <Switch
                  checked={court.active}
                  onCheckedChange={(checked) => updateMutation.mutate({ id: court.id, values: { active: checked } })}
                  aria-label={t("admin.court.visibilityToggle", { court: court.name })}
                />
              </label>
            </div>
          </article>
        ))}
      </div>

      <CourtFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={async (values) => {
          await createMutation.mutateAsync(values)
        }}
      />
      {liveEditTarget && (
        <CourtFormDialog
          court={liveEditTarget}
          open={Boolean(editTarget)}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onImageUploaded={invalidate}
          onSaved={async (values) => {
            await updateMutation.mutateAsync({
              id: liveEditTarget.id,
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
            toast.success(t("admin.toast.courtUpdated"))
          }}
        />
      )}
      {utilizationTarget && (
        <CourtUtilizationDialog court={utilizationTarget} open onOpenChange={(open) => !open && setUtilizationTarget(null)} />
      )}
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

export { CourtsTab }
