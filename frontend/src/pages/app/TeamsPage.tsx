import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, Users } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/avatar"
import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Card, CardContent } from "@/components/shared/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shared/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Input } from "@/components/shared/input"
import { Label } from "@/components/shared/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select"
import { Skeleton } from "@/components/shared/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/tabs"
import { Textarea } from "@/components/shared/textarea"
import { useSportLabels } from "@/components/shared/sport-icon"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import type { SportType } from "@/types"

const SPORT_TYPES: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]
const DISCOVER_PAGE_SIZE = 12

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function CreateTeamDialog() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
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
    onSuccess: () => {
      setOpen(false)
      setName("")
      setSport("ANY")
      setDescription("")
      queryClient.invalidateQueries({ queryKey: ["teams-mine"] })
      toast.success(t("teams.toast.created"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.error.createFailed")),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length === 0) return
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> {t("teams.create")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("teams.create.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-name">{t("teams.field.name")}</Label>
            <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("teams.field.sport")}</Label>
            <Select value={sport} onValueChange={(value) => setSport(value as SportType | "ANY")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">{t("teams.field.sport.any")}</SelectItem>
                {SPORT_TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {sportLabels[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-description">{t("teams.field.description")}</Label>
            <Textarea
              id="team-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <Button type="submit" disabled={createMutation.isPending || name.trim().length === 0} className="mt-1 w-fit">
            {createMutation.isPending ? t("teams.creating") : t("teams.create.submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MyTeamsList() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams-mine"],
    queryFn: () => api.listMyTeams(token!),
    enabled: Boolean(token),
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  }

  if (teams?.length === 0) {
    return <EmptyState title={t("teams.empty.title")} description={t("teams.empty.description")} />
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {teams?.map((team) => (
        <Link key={team.id} to={`/app/teams/${team.id}`}>
          <Card className="h-full transition-colors hover:bg-pebble">
            <CardContent className="flex flex-col gap-2 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarImage src={assetUrl(team.avatar_url)} alt={team.name} loading="lazy" className="object-cover" />
                    <AvatarFallback>{initials(team.name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-ink-navy">{team.name}</span>
                </div>
                {(team.my_role === "OWNER" || team.my_role === "CAPTAIN") && (
                  <Badge variant="secondary">{t(team.my_role === "OWNER" ? "teams.role.owner" : "teams.role.captain")}</Badge>
                )}
              </div>
              {team.sport_type && <Badge className="w-fit">{sportLabels[team.sport_type]}</Badge>}
              {team.description && <p className="text-sm text-slate-gray">{team.description}</p>}
              <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-gray">
                <Users className="size-3.5" /> {t("teams.memberCount", { count: team.members.length })}
              </span>
            </CardContent>
          </Card>
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
    const timeout = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    setLimit(DISCOVER_PAGE_SIZE)
  }, [debounced, sport])

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams-discover", debounced, sport, limit],
    queryFn: () => api.discoverTeams(token!, { q: debounced, sport: sport === "ANY" ? undefined : sport, limit }),
    enabled: Boolean(token),
  })

  const { data: myRequests } = useQuery({
    queryKey: ["team-join-requests-mine"],
    queryFn: () => api.listMyTeamJoinRequests(token!),
    enabled: Boolean(token),
  })
  const requestedTeamIds = new Set((myRequests ?? []).map((request) => request.team_id))

  const requestMutation = useMutation({
    mutationFn: (teamId: string) => api.requestToJoinTeam(token!, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-join-requests-mine"] })
      toast.success(t("teams.discover.toast.requested"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.discover.error.requestFailed")),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-gray" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("teams.discover.searchPlaceholder")} className="pl-9" />
        </div>
        <Select value={sport} onValueChange={(value) => setSport(value as SportType | "ANY")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY">{t("teams.field.sport.any")}</SelectItem>
            {SPORT_TYPES.map((option) => (
              <SelectItem key={option} value={option}>
                {sportLabels[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!isLoading && teams?.length === 0 && <EmptyState title={t("teams.discover.empty")} />}

      {teams && teams.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => {
            const alreadyRequested = requestedTeamIds.has(team.id)
            return (
              <Card key={team.id}>
                <CardContent className="flex flex-col gap-2 p-5">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage src={assetUrl(team.avatar_url)} alt={team.name} loading="lazy" className="object-cover" />
                      <AvatarFallback>{initials(team.name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-ink-navy">{team.name}</span>
                  </div>
                  {team.sport_type && <Badge className="w-fit">{sportLabels[team.sport_type]}</Badge>}
                  {team.description && <p className="text-sm text-slate-gray">{team.description}</p>}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-slate-gray">
                      <Users className="size-3.5" /> {t("teams.memberCount", { count: team.member_count })}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={alreadyRequested || requestMutation.isPending}
                      onClick={() => requestMutation.mutate(team.id)}
                    >
                      {alreadyRequested ? t("teams.discover.requested") : t("teams.discover.requestToJoin")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {teams && teams.length > 0 && teams.length >= limit && (
        <Button variant="outline" className="w-fit" onClick={() => setLimit((current) => current + DISCOVER_PAGE_SIZE)}>
          {t("common.loadMore")}
        </Button>
      )}
    </div>
  )
}

function TeamsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink-navy">{t("teams.title")}</h1>
        <CreateTeamDialog />
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">{t("teams.tabs.mine")}</TabsTrigger>
          <TabsTrigger value="discover">{t("teams.tabs.discover")}</TabsTrigger>
        </TabsList>
        <TabsContent value="mine">
          <MyTeamsList />
        </TabsContent>
        <TabsContent value="discover">
          <DiscoverTeams />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { TeamsPage }
