import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Compass, Crown, Globe, Lock, Plus, Shield, Users, UsersRound } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { SportPicker } from "@/components/shared/sport-picker"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { SportType } from "@/types"

const DISCOVER_PAGE_SIZE = 12

function CreateTeamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [sport, setSport] = useState<SportType | "ANY">("ANY")
  const [description, setDescription] = useState("")

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTeam(token!, {
        name: name.trim(),
        sport_type: sport === "ANY" ? undefined : sport,
        description: description.trim() || undefined,
      }),
    onSuccess: (team) => {
      onOpenChange(false)
      setName("")
      setSport("ANY")
      setDescription("")
      queryClient.invalidateQueries({ queryKey: ["teams-mine"] })
      toast.success(t("teams.toast.created"))
      navigate(`/app/teams/${team.id}`)
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.error.createFailed")),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length === 0) return
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("teams.create.title")}</DialogTitle>
          <DialogDescription>{t("teams.create.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-name">{t("teams.field.name")}</Label>
            <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("teams.field.sport")}</Label>
            <SportPicker value={sport} onChange={setSport} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-description">{t("teams.field.description")}</Label>
            <Textarea id="team-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={name.trim().length === 0} isLoading={createMutation.isPending}>
              {createMutation.isPending ? t("teams.creating") : t("teams.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MyTeamsList({ onCreate }: { onCreate: () => void }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const { data: teams, isLoading, isError, refetch } = useQuery({
    queryKey: ["teams-mine"],
    queryFn: () => api.listMyTeams(token!),
    enabled: Boolean(token),
  })

  if (isLoading)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    )
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (teams?.length === 0)
    return (
      <EmptyState
        icon={UsersRound}
        title={t("teams.empty.title")}
        description={t("teams.empty.description")}
        action={
          <>
            <Button size="sm" onClick={onCreate}>
              <Plus /> {t("teams.create")}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/app/teams?tab=discover">{t("teams.tabs.discover")}</Link>
            </Button>
          </>
        }
      />
    )

  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teams?.map((team, index) => (
        <Link
          key={team.id}
          to={`/app/teams/${team.id}`}
          style={{ "--i": index } as React.CSSProperties}
          className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs outline-none surface-interactive focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <div className="flex items-start gap-3">
            <UserAvatar name={team.name} avatarUrl={team.avatar_url} size="lg" className="rounded-lg [&_*]:rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{team.name}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                {team.sport_type && (
                  <Badge variant="secondary">
                    <SportIcon sport={team.sport_type} /> {sportLabels[team.sport_type]}
                  </Badge>
                )}
                {team.my_role === "OWNER" && (
                  <Badge variant="brand">
                    <Crown /> {t("teams.role.owner")}
                  </Badge>
                )}
                {team.my_role === "CAPTAIN" && (
                  <Badge variant="info">
                    <Shield /> {t("teams.role.captain")}
                  </Badge>
                )}
                {!team.is_public && (
                  <Badge variant="outline">
                    <Lock /> {t("teams.private")}
                  </Badge>
                )}
              </span>
            </div>
          </div>
          {team.description && <p className="line-clamp-2 text-[13px] text-muted-foreground">{team.description}</p>}
          <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
            <div className="flex -space-x-2">
              {team.members.slice(0, 5).map((member) => (
                <UserAvatar key={member.user.id} name={member.user.name} avatarUrl={member.user.avatar_url} size="xs" className="ring-2 ring-card" />
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" /> {t("teams.memberCount", { count: team.members.length })}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function DiscoverTeams() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [sport, setSport] = useState<SportType | "ANY">("ANY")
  const [limit, setLimit] = useState(DISCOVER_PAGE_SIZE)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(query.trim())
      setLimit(DISCOVER_PAGE_SIZE)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  const { data: teams, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["teams-discover", debounced, sport, limit],
    queryFn: () => api.discoverTeams(token!, { q: debounced, sport: sport === "ANY" ? undefined : sport, limit }),
    enabled: Boolean(token),
    placeholderData: (previous) => previous,
  })
  const { data: myRequests } = useQuery({
    queryKey: ["team-join-requests-mine"],
    queryFn: () => api.listMyTeamJoinRequests(token!),
    enabled: Boolean(token),
  })
  const requestIdByTeamId = new Map((myRequests ?? []).filter((r) => r.status === "PENDING").map((request) => [request.team_id, request.id]))

  const requestMutation = useMutation({
    mutationFn: (teamId: string) => api.requestToJoinTeam(token!, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-join-requests-mine"] })
      toast.success(t("teams.discover.toast.requested"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.discover.error.requestFailed")),
  })
  const cancelRequestMutation = useMutation({
    mutationFn: ({ teamId, requestId }: { teamId: string; requestId: string }) => api.cancelTeamJoinRequest(token!, teamId, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-join-requests-mine"] })
      toast.success(t("teams.discover.toast.requestCancelled"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.discover.error.cancelFailed")),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={query} onValueChange={setQuery} placeholder={t("teams.discover.searchPlaceholder")} className="sm:w-72" />
        <SportPicker
          value={sport}
          onChange={(next) => {
            setSport(next)
            setLimit(DISCOVER_PAGE_SIZE)
          }}
        />
      </div>
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && teams?.length === 0 && <EmptyState icon={Compass} title={t("teams.discover.empty")} description={t("teams.discover.emptyHint")} />}
      {teams && teams.length > 0 && (
        <div className={cn("stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3", isFetching && "opacity-70 transition-opacity")}>
          {teams.map((team, index) => {
            const requestId = requestIdByTeamId.get(team.id)
            return (
              <article key={team.id} style={{ "--i": index } as React.CSSProperties} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <UserAvatar name={team.name} avatarUrl={team.avatar_url} size="lg" className="rounded-lg [&_*]:rounded-lg" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-[15px] font-semibold">{team.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {team.sport_type && (
                        <Badge variant="secondary">
                          <SportIcon sport={team.sport_type} /> {sportLabels[team.sport_type]}
                        </Badge>
                      )}
                      <Badge variant="outline">
                        <Globe /> {t("teams.public")}
                      </Badge>
                    </span>
                  </div>
                </div>
                {team.description && <p className="line-clamp-2 text-[13px] text-muted-foreground">{team.description}</p>}
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" /> {t("teams.memberCount", { count: team.member_count })}
                  </span>
                  {requestId ? (
                    <Button size="sm" variant="ghost" isLoading={cancelRequestMutation.isPending} onClick={() => cancelRequestMutation.mutate({ teamId: team.id, requestId })}>
                      {t("teams.discover.cancelRequest")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={requestMutation.isPending} onClick={() => requestMutation.mutate(team.id)}>
                      {t("teams.discover.requestToJoin")}
                    </Button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
      {teams && teams.length > 0 && teams.length >= limit && (
        <Button variant="outline" size="sm" className="w-fit self-center" isLoading={isFetching} onClick={() => setLimit((current) => current + DISCOVER_PAGE_SIZE)}>
          {t("common.loadMore")}
        </Button>
      )}
    </div>
  )
}

function TeamsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get("tab") === "discover" ? "discover" : "mine"
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow={t("nav.group.community")}
        title={t("teams.title")}
        description={t("teams.hint")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> {t("teams.create")}
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(value) => setSearchParams(value === "mine" ? {} : { tab: value }, { replace: true })}>
        <TabsList variant="line">
          <TabsTrigger value="mine">
            <UsersRound /> {t("teams.tabs.mine")}
          </TabsTrigger>
          <TabsTrigger value="discover">
            <Compass /> {t("teams.tabs.discover")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mine">
          <MyTeamsList onCreate={() => setCreateOpen(true)} />
        </TabsContent>
        <TabsContent value="discover">
          <DiscoverTeams />
        </TabsContent>
      </Tabs>
      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PageContainer>
  )
}

export { TeamsPage }
