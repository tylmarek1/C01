import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import type { PlayerSearchResult } from "@/types"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function PlayerSearch({
  onSelect,
  placeholder,
  excludeIds,
  autoFocus,
}: {
  onSelect: (player: PlayerSearchResult) => void
  placeholder?: string
  excludeIds?: string[]
  autoFocus?: boolean
}) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const { data: results, isFetching } = useQuery({
    queryKey: ["player-search", debounced],
    queryFn: () => api.searchPlayers(token!, debounced),
    enabled: Boolean(token) && debounced.length >= 2,
  })

  const filtered = (results ?? []).filter((player) => !excludeIds?.includes(player.id))
  const showDropdown = open && debounced.length >= 2

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-gray" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? t("playerSearch.placeholder")}
          className="pl-9"
          autoFocus={autoFocus}
        />
      </div>
      {showDropdown && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-hairline bg-card shadow-lg">
          {isFetching && <div className="p-3 text-sm text-slate-gray">{t("playerSearch.searching")}</div>}
          {!isFetching && filtered.length === 0 && (
            <div className="p-3 text-sm text-slate-gray">{t("playerSearch.empty")}</div>
          )}
          {!isFetching &&
            filtered.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => {
                  onSelect(player)
                  setQuery("")
                  setDebounced("")
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-pebble"
              >
                <Avatar className="size-8">
                  <AvatarImage src={assetUrl(player.avatar_url)} alt={player.name} loading="lazy" className="object-cover" />
                  <AvatarFallback>{initials(player.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-ink-navy">{player.name}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export { PlayerSearch }
