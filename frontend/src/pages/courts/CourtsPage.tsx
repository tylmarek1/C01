import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/shared/button"
import { CourtCard } from "@/components/shared/court-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { Input } from "@/components/shared/input"
import { SectionHeader } from "@/components/shared/section-header"
import { Skeleton } from "@/components/shared/skeleton"
import { useSportLabels } from "@/components/shared/sport-icon"
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/tabs"
import { ApiError, api } from "@/lib/api"
import { ALL_AMENITIES, useAmenityLabels } from "@/lib/amenities"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Amenity, Court, SportType } from "@/types"

const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]

function CourtsPage() {
  const { user, token } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const amenityLabels = useAmenityLabels()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const sportParam = searchParams.get("sport")
  const sport = SPORTS.includes(sportParam as SportType) ? (sportParam as SportType) : undefined
  const amenityParam = searchParams.get("amenity")
  const amenity = ALL_AMENITIES.includes(amenityParam as Amenity) ? (amenityParam as Amenity) : undefined

  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "")
  const q = searchParams.get("q") ?? undefined

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (searchInput) next.set("q", searchInput)
        else next.delete("q")
        return next
      })
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const {
    data: courts,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["courts", sport ?? "all", amenity ?? "all", q ?? ""],
    queryFn: () => api.listCourts({ sport, amenity, q }),
  })

  const hasFilters = Boolean(sport || amenity || q)

  const { data: trendingCourts } = useQuery({
    queryKey: ["courts-trending"],
    queryFn: () => api.listTrendingCourts(7, 6),
    enabled: !hasFilters,
  })

  const { data: recommendedCourts } = useQuery({
    queryKey: ["courts-recommended"],
    queryFn: () => api.listRecommendedCourts(token!),
    enabled: !hasFilters && Boolean(token),
  })

  const { data: favorites } = useQuery({
    queryKey: ["favorites-mine"],
    queryFn: () => api.listMyFavorites(token!),
    enabled: Boolean(token),
  })
  const favoriteIds = new Set(favorites?.map((c) => c.id) ?? [])

  const favoriteMutation = useMutation({
    mutationFn: (court: Court) =>
      favoriteIds.has(court.id) ? api.removeFavorite(token!, court.id) : api.addFavorite(token!, court.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites-mine"] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.favoritesFailed")),
  })

  function handleTabChange(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === "all") next.delete("sport")
      else next.set("sport", value)
      return next
    })
  }

  function handleAmenityClick(value: Amenity) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (next.get("amenity") === value) next.delete("amenity")
      else next.set("amenity", value)
      return next
    })
  }

  function handleClearFilters() {
    setSearchInput("")
    setSearchParams(new URLSearchParams())
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeader
        align="left"
        eyebrow={t("nav.courts")}
        title={t("courts.pageTitle")}
        description={t("courts.pageDescription")}
      />

      <div className="mt-8 flex flex-col gap-5">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-gray" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("courts.search.placeholder")}
            className="pl-10"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-gray hover:text-ink-navy"
              aria-label={t("courts.search.clear")}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <Tabs value={sport ?? "all"} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">{t("courts.allSports")}</TabsTrigger>
            {SPORTS.map((option) => (
              <TabsTrigger key={option} value={option}>
                {sportLabels[option]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          {ALL_AMENITIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleAmenityClick(option)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                amenity === option
                  ? "border-signal-blue bg-highlight-blue text-signal-blue"
                  : "border-hairline bg-card text-slate-gray hover:text-ink-navy",
              )}
            >
              {amenityLabels[option]}
            </button>
          ))}
        </div>
      </div>

      {!hasFilters && trendingCourts && trendingCourts.length > 0 && (
        <div className="mt-10 flex flex-col gap-4">
          <span className="text-sm font-semibold text-ink-navy">{t("courts.trending.title")}</span>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trendingCourts.map((court) => (
              <CourtCard
                key={court.id}
                court={court}
                href={`/courts/${court.id}`}
                isFavorite={favoriteIds.has(court.id)}
                onToggleFavorite={user ? (c) => favoriteMutation.mutate(c) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {!hasFilters && user && recommendedCourts && recommendedCourts.length > 0 && (
        <div className="mt-10 flex flex-col gap-4">
          <span className="text-sm font-semibold text-ink-navy">{t("courts.recommended.title")}</span>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedCourts.map((court) => (
              <CourtCard
                key={court.id}
                court={court}
                href={`/courts/${court.id}`}
                isFavorite={favoriteIds.has(court.id)}
                onToggleFavorite={(c) => favoriteMutation.mutate(c)}
              />
            ))}
          </div>
        </div>
      )}

      {!hasFilters && ((trendingCourts && trendingCourts.length > 0) || (user && recommendedCourts && recommendedCourts.length > 0)) && (
        <span className="mt-10 block text-sm font-semibold text-ink-navy">{t("courts.allCourts")}</span>
      )}
      <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", !hasFilters ? "mt-4" : "mt-10")}>
        {isLoading && Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="aspect-[16/10] w-full rounded-2xl" />)}

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
            title={t("courts.empty.title")}
            description={t("courts.empty.description")}
            action={
              hasFilters && (
                <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-1">
                  {t("courts.clearFilters")}
                </Button>
              )
            }
            className="col-span-full"
          />
        )}

        {courts?.map((court) => (
          <CourtCard
            key={court.id}
            court={court}
            href={`/courts/${court.id}`}
            isFavorite={favoriteIds.has(court.id)}
            onToggleFavorite={user ? (c) => favoriteMutation.mutate(c) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

export { CourtsPage }
