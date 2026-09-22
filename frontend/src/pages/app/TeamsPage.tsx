import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Users } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Card, CardContent } from "@/components/shared/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shared/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Input } from "@/components/shared/input"
import { Label } from "@/components/shared/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select"
import { Skeleton } from "@/components/shared/skeleton"
import { Textarea } from "@/components/shared/textarea"
import { useSportLabels } from "@/components/shared/sport-icon"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import type { SportType } from "@/types"

const SPORT_TYPES: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]

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

function TeamsPage() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams-mine"],
    queryFn: () => api.listMyTeams(token!),
    enabled: Boolean(token),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink-navy">{t("teams.title")}</h1>
        <CreateTeamDialog />
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!isLoading && teams?.length === 0 && (
        <EmptyState title={t("teams.empty.title")} description={t("teams.empty.description")} />
      )}

      {teams && teams.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <Link key={team.id} to={`/app/teams/${team.id}`}>
              <Card className="h-full transition-colors hover:bg-pebble">
                <CardContent className="flex flex-col gap-2 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink-navy">{team.name}</span>
                    {team.my_role === "OWNER" && <Badge variant="secondary">{t("teams.role.owner")}</Badge>}
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
      )}
    </div>
  )
}

export { TeamsPage }
