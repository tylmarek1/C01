import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Flame, MapPin, SlidersHorizontal, Sparkles, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CourtCard } from "@/components/shared/court-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { FilterChip } from "@/components/shared/filter-chip"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { SubsectionHeading } from "@/components/shared/subsection-heading"
import { ApiError, api } from "@/lib/api"
import { ALL_AMENITIES, AMENITY_ICON, useAmenityLabels } from "@/lib/amenities"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { useCourts } from "@/lib/queries"
import type { Amenity, Court, SportType } from "@/types"

const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]
type Sort = "recommended" | "rating" | "priceAsc" | "priceDesc" | "name"
const SORTS: Sort[] = ["recommended", "rating", "priceAsc", "priceDesc", "name"]
type Environment = "indoor" | "outdoor"

function sortCourts(courts: Court[], sort: Sort): Court[] {
  const list = [...courts]
  switch (sort) {
    case "rating":
      return list.sort((a, b) => (b.average_rating ?? -1) - (a.average_rating ?? -1) || b.review_count - a.review_count)
    case "priceAsc":
      return list.sort((a, b) => (a.price_per_hour ?? Infinity) - (b.price_per_hour ?? Infinity))
    case "priceDesc":
      return list.sort((a, b) => (b.price_per_hour ?? -Infinity) - (a.price_per_hour ?? -Infinity))
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name))
    default:
      return list
  }
}

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
  const envParam = searchParams.get("env")
  const environment = envParam === "indoor" || envParam === "outdoor" ? (envParam as Environment) : undefined
  const sortParam = searchParams.get("sort") as Sort | null
  const sort: Sort = sortParam && SORTS.includes(sortParam) ? sortParam : "recommended"
  const [showAllAmenities, setShowAllAmenities] = useState(Boolean(amenity))

  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "")
  const q = searchParams.get("q") ?? undefined

  function updateParam(key: string, value: string | undefined) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    const handle = setTimeout(() => updateParam("q", searchInput.trim() || undefined), 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const { data: allCourts } = useCourts()
  const { data: courts, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["courts", sport ?? "all", amenity ?? "all", q ?? ""],
    queryFn: () => api.listCourts({ sport, amenity, q }),
    placeholderData: (previous) => previous,
  })

  const hasFilters = Boolean(sport || amenity || q || environment)

  const { data: trendingCourts } = useQuery({
    queryKey: ["courts-trending", 4],
    queryFn: () => api.listTrendingCourts(7, 4),
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

  const visible = useMemo(() => {
    const filtered = (courts ?? []).filter((court) =>
      environment === "indoor" ? court.indoor : environment === "outdoor" ? !court.indoor : true,
    )
    return sortCourts(filtered, sort)
  }, [courts, environment, sort])

  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allCourts?.length ?? 0 }
    for (const court of allCourts ?? []) counts[court.sport_type] = (counts[court.sport_type] ?? 0) + 1
    return counts
  }, [allCourts])

  const favoriteMutation = useMutation({
    mutationFn: (court: Court) => (favoriteIds.has(court.id) ? api.removeFavorite(token!, court.id) : api.addFavorite(token!, court.id)),
    onSuccess: (_v, court) => {
      const wasFavorite = favoriteIds.has(court.id)
      queryClient.invalidateQueries({ queryKey: ["favorites-mine"] })
      toast.success(t(wasFavorite ? "courts.favorite.removedToast" : "courts.favorite.addedToast", { court: court.name }))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("profile.error.favoritesFailed")),
  })
  const toggleFavorite = user ? (court: Court) => favoriteMutation.mutate(court) : undefined

  function handleClearFilters() {
    setSearchInput("")
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const rails = !hasFilters
    ? [
        ...(user && recommendedCourts && recommendedCourts.length > 0
          ? [{ key: "recommended", icon: Sparkles, title: t("courts.recommended.title"), items: recommendedCourts.slice(0, 4) }]
          : []),
        ...(trendingCourts && trendingCourts.length > 0
          ? [{ key: "trending", icon: Flame, title: t("courts.trending.title"), items: trendingCourts.slice(0, 4) }]
          : []),
      ]
    : []

  const amenitiesShown = showAllAmenities ? ALL_AMENITIES : ALL_AMENITIES.slice(0, 4)

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {t("courtDetail.venueName")}
          </span>
        }
        title={t("courts.pageTitle")}
        description={t("courts.pageDescription")}
        actions={
          user ? (
            <Button variant="brand" asChild className="lg:hidden">
              <Link to="/app/book">{t("nav.book")}</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/register">{t("hero.cta.signup")}</Link>
            </Button>
          )
        }
      />

      {/* Filter bar */}
      <div className="flex flex-col gap-3 border-b border-foreground pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchInput
            value={searchInput}
            onValueChange={setSearchInput}
            placeholder={t("courts.search.placeholder")}
            className="md:max-w-xs md:flex-1"
            aria-label={t("courts.search.placeholder")}
          />
          <Tabs value={sport ?? "all"} onValueChange={(value) => updateParam("sport", value === "all" ? undefined : value)} className="gap-0">
            <TabsList>
              <TabsTrigger value="all">
                {t("courts.allSports")} <span className="font-mono text-[10.5px] text-subtle-foreground tabular">{sportCounts.all}</span>
              </TabsTrigger>
              {SPORTS.map((option) => (
                <TabsTrigger key={option} value={option}>
                  <SportIcon sport={option} /> {sportLabels[option]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2 md:ml-auto">
            <span className="hidden text-xs text-muted-foreground lg:inline">{t("courts.sort.label")}</span>
            <Select value={sort} onValueChange={(value) => updateParam("sort", value === "recommended" ? undefined : value)}>
              <SelectTrigger className="w-full md:w-44" aria-label={t("courts.sort.label")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {SORTS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`courts.sort.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-foreground/20 pt-3">
          <SlidersHorizontal className="mr-1 size-3.5 text-muted-foreground" />
          <FilterChip active={environment === "indoor"} onClick={() => updateParam("env", environment === "indoor" ? undefined : "indoor")}>
            {t("courts.indoor")}
          </FilterChip>
          <FilterChip active={environment === "outdoor"} onClick={() => updateParam("env", environment === "outdoor" ? undefined : "outdoor")}>
            {t("courts.outdoor")}
          </FilterChip>
          <span className="mx-1 h-4 w-px bg-border" />
          {amenitiesShown.map((option) => {
            const Icon = AMENITY_ICON[option]
            return (
              <FilterChip key={option} active={amenity === option} onClick={() => updateParam("amenity", amenity === option ? undefined : option)}>
                {amenity !== option && <Icon className="size-3" />} {amenityLabels[option]}
              </FilterChip>
            )
          })}
          {!showAllAmenities && (
            <Button variant="ghost" size="xs" onClick={() => setShowAllAmenities(true)}>
              {t("courts.moreFilters", { count: ALL_AMENITIES.length - 4 })}
            </Button>
          )}
          {hasFilters && (
            <Button variant="ghost" size="xs" onClick={handleClearFilters} className="ml-auto">
              <X /> {t("courts.clearFilters")}
            </Button>
          )}
        </div>
      </div>

      {rails.map((rail) => (
        <section key={rail.key} className="mt-10 flex flex-col gap-4">
          <SubsectionHeading
            title={
              <span className="flex items-center gap-2">
                <rail.icon className="size-4 text-muted-foreground" /> {rail.title}
              </span>
            }
          />
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {rail.items.map((court) => (
              <CourtCard key={court.id} court={court} href={`/courts/${court.id}`} compact className="w-72 shrink-0 snap-start sm:w-auto" />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-10 flex flex-col gap-4">
        <SubsectionHeading
          title={hasFilters ? t("courts.results") : t("courts.allCourts")}
          count={isLoading ? undefined : visible.length}
          action={isFetching && !isLoading ? <span className="text-xs text-muted-foreground">{t("common.loading")}</span> : undefined}
        />
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-80 rounded-xl" />)}
          {isError && <ErrorState className="col-span-full" onRetry={() => refetch()} />}
          {!isLoading && !isError && visible.length === 0 && (
            <EmptyState
              icon={SlidersHorizontal}
              title={t("courts.empty.title")}
              description={t("courts.empty.description")}
              action={
                hasFilters && (
                  <Button variant="outline" size="sm" onClick={handleClearFilters}>
                    {t("courts.clearFilters")}
                  </Button>
                )
              }
              className="col-span-full"
            />
          )}
          {visible.map((court, index) => (
            <div key={court.id} style={{ "--i": index } as React.CSSProperties}>
              <CourtCard court={court} href={`/courts/${court.id}`} isFavorite={favoriteIds.has(court.id)} onToggleFavorite={toggleFavorite} />
            </div>
          ))}
        </div>
      </section>

      {!user && (
        <div className="mt-14 flex flex-col items-start gap-5 rounded-md bg-panel p-6 text-panel-foreground sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="flex flex-col gap-2">
            <span className="display text-[36px] sm:text-[44px]">{t("courts.guestCta.title")}</span>
            <span className="text-[14px] text-panel-muted">{t("courts.guestCta.description")}</span>
          </div>
          <Button variant="brand" size="lg" asChild>
            <Link to="/register">
              {t("hero.cta.signup")} <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
    </PageContainer>
  )
}

export { CourtsPage }
