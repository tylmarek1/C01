import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Input } from "@/components/ui/input"
import { SectionHeader } from "@/components/shared/section-header"
import { Skeleton } from "@/components/ui/skeleton"
import { api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"

const PAGE_SIZE = 24

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function PlayersDirectoryPage() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [limit, setLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [debounced])

  const { data: players, isLoading } = useQuery({
    queryKey: ["players-directory", debounced, limit],
    queryFn: () => api.searchPlayers(token!, debounced, { limit }),
    enabled: Boolean(token),
  })

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <SectionHeader align="left" eyebrow={t("playersDirectory.nav")} title={t("playersDirectory.title")} description={t("playersDirectory.hint")} />

      <div className="mt-8 flex flex-col gap-6">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-gray" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("playerSearch.placeholder")}
            className="pl-9"
            autoFocus
          />
        </div>

        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {!isLoading && players?.length === 0 && (
          <EmptyState
            title={debounced ? t("playersDirectory.noResults") : t("playersDirectory.empty")}
          />
        )}

        {players && players.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <Link
                key={player.id}
                to={`/app/players/${player.id}`}
                className="flex items-center gap-3 rounded-2xl border border-hairline bg-card p-3 transition-colors hover:bg-pebble"
              >
                <Avatar className="size-10">
                  <AvatarImage src={assetUrl(player.avatar_url)} alt={player.name} loading="lazy" className="object-cover" />
                  <AvatarFallback>{initials(player.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-ink-navy">{player.name}</span>
              </Link>
            ))}
          </div>
        )}

        {players && players.length > 0 && players.length >= limit && (
          <Button variant="outline" className="w-fit" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
            {t("common.loadMore")}
          </Button>
        )}
      </div>
    </div>
  )
}

export { PlayersDirectoryPage }
