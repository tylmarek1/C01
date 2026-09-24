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
  const showResults = open && debounced.length >= 2

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
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
      {/* Rendered in normal document flow, right under the input, instead of
          as a floating `position: absolute`/portaled overlay — that overlay
          approach broke in every Dialog it was used from: a Dialog's
          `overflow-y-auto` content box swallowed an `absolute` dropdown as
          extra scroll height instead of showing it, and escaping via a
          portal to `document.body` ran straight into Radix Dialog's own
          modality guard, which marks everything outside its own portal
          `inert` (unclickable) while open — including a separate portal like
          that one. Living in the layout avoids both failure modes outright:
          nothing to clip, nothing external to be marked inert. */}
      {showResults && (
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {isFetching && <p className="px-1 py-2 text-sm text-slate-gray">{t("playerSearch.searching")}</p>}
          {!isFetching && filtered.length === 0 && (
            <p className="px-1 py-2 text-sm text-slate-gray">{t("playerSearch.empty")}</p>
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
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-pebble"
              >
                <Avatar className="size-9">
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
