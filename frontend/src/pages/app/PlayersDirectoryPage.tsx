import { useQuery } from "@tanstack/react-query"
import { Crown, Medal, Newspaper, Search, Trophy, UserRoundSearch } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ActivityFeedItem } from "@/components/shared/activity-feed-item"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { SubsectionHeading } from "@/components/shared/subsection-heading"
import { UserAvatar } from "@/components/shared/user-avatar"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { SportType, User } from "@/types"

const PAGE_SIZE = 24
const FEED_PAGE = 20
const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]
type Tab = "feed" | "players" | "leaderboards"

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="size-4 text-star" aria-label="1" />
  if (rank <= 3) return <Medal className={cn("size-4", rank === 2 ? "text-muted-foreground" : "text-warning")} aria-label={String(rank)} />
  return <span className="font-mono text-xs text-muted-foreground tabular">{rank}</span>
}

function LeaderRow({ rank, user, primary, secondary, isMe }: { rank: number; user: User; primary: string; secondary: string; isMe: boolean }) {
  const { t } = useTranslation()
  return (
    <Link
      to={`/app/players/${user.id}`}
      className={cn("flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60", isMe && "bg-brand-soft hover:bg-brand-soft")}
    >
      <span className="flex w-6 shrink-0 justify-center">
        <RankBadge rank={rank} />
      </span>
      <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="sm" />
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-[13px] font-medium">
        {user.name}
        {isMe && <span className="rounded-xs bg-brand px-1 font-mono text-[10px] text-brand-foreground">{t("leaderboard.you")}</span>}
      </span>
      <span className="flex flex-col items-end">
        <span className="font-mono text-[13px] font-semibold tabular">{primary}</span>
        <span className="text-[11px] text-muted-foreground">{secondary}</span>
      </span>
    </Link>
  )
}

function Leaderboards() {
  const { token, user } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const sportLabels = useSportLabels()
  const [sport, setSport] = useState<SportType>("TENNIS")

  const activity = useQuery({ queryKey: ["leaderboard"], queryFn: () => api.getLeaderboard(token!, 20), enabled: Boolean(token) })
  const ratings = useQuery({
    queryKey: ["ratings-leaderboard", sport],
    queryFn: () => api.getRatingLeaderboard(token!, sport, 20),
    enabled: Boolean(token),
  })
  const mine = useQuery({ queryKey: ["ratings-mine"], queryFn: () => api.getMyRatings(token!), enabled: Boolean(token) })
  const myRating = mine.data?.find((entry) => entry.sport_type === sport)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <SubsectionHeading title={t("leaderboard.activity.title")} description={t("leaderboard.activity.description")} />
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {activity.isLoading && <Skeleton className="m-4 h-48" />}
          {activity.isError && <ErrorState size="compact" className="m-4" onRetry={() => activity.refetch()} />}
          {activity.data?.length === 0 && <EmptyState size="compact" className="m-4" icon={Trophy} title={t("leaderboard.empty")} />}
          <div className="divide-y divide-border">
            {activity.data?.map((entry) => (
              <LeaderRow
                key={entry.user.id}
                rank={entry.rank}
                user={entry.user}
                isMe={entry.user.id === user?.id}
                primary={t("leaderboard.hoursPlayed", { hours: fmt.number(entry.hours_played) })}
                secondary={t("leaderboard.games", { count: entry.completed_reservations })}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SubsectionHeading title={t("leaderboard.rating.title")} description={t("leaderboard.rating.description")} />
        <Tabs value={sport} onValueChange={(value) => setSport(value as SportType)} className="gap-0">
          <TabsList>
            {SPORTS.map((option) => (
              <TabsTrigger key={option} value={option}>
                <SportIcon sport={option} /> {sportLabels[option]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {myRating && (
          <div className="flex items-center justify-between rounded-lg border border-brand/50 bg-brand-soft px-4 py-2.5 text-[13px]">
            <span className="font-medium text-brand-ink">{t("playerProfile.ratings.mine")}</span>
            <span className="font-mono font-semibold tabular">
              {Math.round(myRating.rating)} <span className="font-sans font-normal text-muted-foreground">· {t("playerProfile.ratings.matchesPlayed", { count: myRating.matches_played })}</span>
            </span>
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {ratings.isLoading && <Skeleton className="m-4 h-48" />}
          {ratings.isError && <ErrorState size="compact" className="m-4" onRetry={() => ratings.refetch()} />}
          {ratings.data?.length === 0 && (
            <EmptyState size="compact" className="m-4" icon={Trophy} title={t("ratingLeaderboard.empty")} description={t("leaderboard.rating.emptyHint")} />
          )}
          <div className="divide-y divide-border">
            {ratings.data?.map((entry) => (
              <LeaderRow
                key={entry.user.id}
                rank={entry.rank}
                user={entry.user}
                isMe={entry.user.id === user?.id}
                primary={String(Math.round(entry.rating))}
                secondary={t("playerProfile.ratings.matchesPlayed", { count: entry.matches_played })}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function Feed() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [limit, setLimit] = useState(FEED_PAGE)
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["activity-feed", limit],
    queryFn: () => api.getActivityFeed(token!, limit),
    enabled: Boolean(token),
    placeholderData: (previous) => previous,
  })

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (!data || data.length === 0)
    return (
      <EmptyState
        icon={Newspaper}
        title={t("dashboard.feed.empty.title")}
        description={t("dashboard.feed.empty.description")}
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/app/players?tab=players">{t("community.findPlayers")}</Link>
          </Button>
        }
      />
    )

  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <div className="stagger flex flex-col gap-2">
        {data.map((event, index) => (
          <div key={event.id} style={{ "--i": index } as React.CSSProperties}>
            <ActivityFeedItem event={event} />
          </div>
        ))}
      </div>
      {data.length >= limit && (
        <Button variant="outline" size="sm" className="mt-2 w-fit self-center" isLoading={isFetching} onClick={() => setLimit((n) => n + FEED_PAGE)}>
          {t("common.loadMore")}
        </Button>
      )}
    </div>
  )
}

function Directory() {
  const { token, user } = useAuth()
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [limit, setLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(query.trim())
      setLimit(PAGE_SIZE)
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  const { data: players, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["players-directory", debounced, limit],
    queryFn: () => api.searchPlayers(token!, debounced, { limit }),
    enabled: Boolean(token),
    placeholderData: (previous) => previous,
  })

  return (
    <div className="flex flex-col gap-5">
      <SearchInput value={query} onValueChange={setQuery} placeholder={t("playerSearch.placeholder")} className="max-w-md" autoFocus />
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && players?.length === 0 && (
        <EmptyState icon={UserRoundSearch} title={debounced ? t("playersDirectory.noResults") : t("playersDirectory.empty")} />
      )}
      {players && players.length > 0 && (
        <div className={cn("stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", isFetching && "opacity-70 transition-opacity")}>
          {players.map((player, index) => (
            <Link
              key={player.id}
              to={`/app/players/${player.id}`}
              style={{ "--i": index } as React.CSSProperties}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs surface-interactive"
            >
              <UserAvatar name={player.name} avatarUrl={player.avatar_url} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{player.name}</span>
              {player.id === user?.id && <span className="text-[11px] text-muted-foreground">{t("leaderboard.you")}</span>}
            </Link>
          ))}
        </div>
      )}
      {players && players.length >= limit && (
        <Button variant="outline" size="sm" className="w-fit self-center" isLoading={isFetching} onClick={() => setLimit((current) => current + PAGE_SIZE)}>
          {t("common.loadMore")}
        </Button>
      )}
    </div>
  )
}

function PlayersDirectoryPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("tab") as Tab | null
  const tab: Tab = tabParam === "players" || tabParam === "leaderboards" ? tabParam : "feed"

  return (
    <PageContainer size="wide">
      <PageHeader eyebrow={t("nav.group.community")} title={t("community.title")} description={t("community.description")} />
      <Tabs value={tab} onValueChange={(value) => setSearchParams(value === "feed" ? {} : { tab: value }, { replace: true })}>
        <TabsList variant="line">
          <TabsTrigger value="feed">
            <Newspaper /> {t("community.tabs.feed")}
          </TabsTrigger>
          <TabsTrigger value="players">
            <Search /> {t("community.tabs.players")}
          </TabsTrigger>
          <TabsTrigger value="leaderboards">
            <Trophy /> {t("community.tabs.leaderboards")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="feed">
          <Feed />
        </TabsContent>
        <TabsContent value="players">
          <Directory />
        </TabsContent>
        <TabsContent value="leaderboards">
          <Leaderboards />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

export { PlayersDirectoryPage }
