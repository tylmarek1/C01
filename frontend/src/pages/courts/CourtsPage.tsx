import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { CourtCard } from "@/components/shared/court-card"
import { Input } from "@/components/shared/input"
import { SectionHeader } from "@/components/shared/section-header"
import { Skeleton } from "@/components/shared/skeleton"
import { SPORT_LABELS } from "@/components/shared/sport-icon"
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/tabs"
import { ApiError, api } from "@/lib/api"
import { ALL_AMENITIES, AMENITY_LABELS } from "@/lib/amenities"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import type { Amenity, Court, SportType } from "@/types"

const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]

function CourtsPage() {
  const { user, token } = useAuth()
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

  const { data: courts, isLoading } = useQuery({
    queryKey: ["courts", sport ?? "all", amenity ?? "all", q ?? ""],
    queryFn: () => api.listCourts({ sport, amenity, q }),
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
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update favorites"),
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeader
        align="left"
        eyebrow="Courts"
        title="Browse every court"
        description="Search, filter by amenity, and jump straight to booking."
      />

      <div className="mt-8 flex flex-col gap-5">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-gray" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search courts by name…"
            className="pl-10"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-gray hover:text-ink-navy"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <Tabs value={sport ?? "all"} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">All sports</TabsTrigger>
            {SPORTS.map((option) => (
              <TabsTrigger key={option} value={option}>
                {SPORT_LABELS[option]}
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
                  ? "border-signal-blue bg-[#eaf3ff] text-signal-blue"
                  : "border-hairline bg-card text-slate-gray hover:text-ink-navy",
              )}
            >
              {AMENITY_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="aspect-[16/10] w-full rounded-2xl" />)}

        {!isLoading && courts?.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline py-16 text-center">
            <p className="font-medium text-ink-navy">No courts match this filter</p>
            <p className="text-sm text-slate-gray">Try another sport, amenity, or search term.</p>
          </div>
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
