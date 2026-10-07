import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { SearchInput } from "@/components/shared/search-input"
import { UserAvatar } from "@/components/shared/user-avatar"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { PlayerSearchResult } from "@/types"

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
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query.trim()), 250)
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
  const active = Math.min(activeIndex, Math.max(0, filtered.length - 1))

  function choose(player: PlayerSearchResult) {
    onSelect(player)
    setQuery("")
    setDebounced("")
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <SearchInput
        value={query}
        onValueChange={(value) => {
          setQuery(value)
          setActiveIndex(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!showResults || filtered.length === 0) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setActiveIndex((i) => Math.min(filtered.length - 1, i + 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex((i) => Math.max(0, i - 1))
          } else if (event.key === "Enter") {
            event.preventDefault()
            choose(filtered[active])
          }
        }}
        placeholder={placeholder ?? t("playerSearch.placeholder")}
        autoFocus={autoFocus}
        aria-autocomplete="list"
      />
      {!showResults && query.trim().length > 0 && query.trim().length < 2 && (
        <p className="px-1 text-xs text-muted-foreground">{t("playerSearch.minChars")}</p>
      )}
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
        <div role="listbox" className="flex max-h-72 animate-fade-in flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {isFetching &&
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-2 py-1.5">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            ))}
          {!isFetching && filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-[13px] text-muted-foreground">{t("playerSearch.empty")}</p>
          )}
          {!isFetching &&
            filtered.map((player, index) => (
              <button
                key={player.id}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => choose(player)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                  index === active ? "bg-muted" : "hover:bg-muted",
                )}
              >
                <UserAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
                <span className="text-[13px] font-medium">{player.name}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export { PlayerSearch }
