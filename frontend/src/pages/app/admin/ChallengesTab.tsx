import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Flag, Plus, Trophy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { useSportLabels } from "@/components/shared/sport-icon"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { useNow } from "@/lib/use-now"
import type { ChallengeMetric, SportType } from "@/types"

const CHALLENGE_METRICS: ChallengeMetric[] = ["RESERVATIONS_COMPLETED", "COURTS_PLAYED", "GUESTS_INVITED", "REVIEWS_WRITTEN"]
const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]

function ChallengesTab() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const sportLabels = useSportLabels()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [sport, setSport] = useState<SportType | "ANY">("ANY")
  const [metric, setMetric] = useState<ChallengeMetric>("RESERVATIONS_COMPLETED")
  const [target, setTarget] = useState("5")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")

  const { data: challenges, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: () => api.listChallenges(token!),
    enabled: Boolean(token),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.createChallenge(token!, {
        title: title.trim(),
        description: description.trim(),
        sport_type: sport === "ANY" ? undefined : sport,
        metric,
        target: Number(target),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      }),
    onSuccess: () => {
      toast.success(t("admin.challenges.toast.created"))
      setCreateOpen(false)
      setTitle("")
      setDescription("")
      setSport("ANY")
      setTarget("5")
      setStartsAt("")
      setEndsAt("")
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] })
      queryClient.invalidateQueries({ queryKey: ["challenges-mine"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.challenges.error.create")),
  })

  const rangeInvalid = Boolean(startsAt && endsAt && new Date(endsAt) <= new Date(startsAt))
  const canSubmit = title.trim() && description.trim() && Number(target) >= 1 && startsAt && endsAt && !rangeInvalid

  const now = useNow(60_000)
  const withState = (challenges ?? []).map((challenge) => {
    const startsAtMs = new Date(challenge.starts_at).getTime()
    const endsAtMs = new Date(challenge.ends_at).getTime()
    const state: "active" | "upcoming" | "ended" = now < startsAtMs ? "upcoming" : now > endsAtMs ? "ended" : "active"
    return { challenge, state }
  })
  const order = { active: 0, upcoming: 1, ended: 2 }
  withState.sort((a, b) => order[a.state] - order[b.state])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-muted-foreground">{t("admin.challenges.intro")}</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus /> {t("admin.challenges.create")}
        </Button>
      </div>

      {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full rounded-xl" />)}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && challenges?.length === 0 && (
        <EmptyState
          icon={Flag}
          title={t("admin.challenges.empty")}
          description={t("admin.challenges.emptyHint")}
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> {t("admin.challenges.create")}
            </Button>
          }
        />
      )}

      <div className="stagger grid gap-3 md:grid-cols-2">
        {withState.map(({ challenge, state }, index) => (
          <article key={challenge.id} style={{ "--i": index } as React.CSSProperties} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-semibold">{challenge.title}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {fmt.dateMedium(challenge.starts_at)} – {fmt.dateMedium(challenge.ends_at)}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                {challenge.sport_type && <Badge variant="secondary">{sportLabels[challenge.sport_type]}</Badge>}
                {state === "active" && <Badge variant="brand" dot>{t("challenges.active")}</Badge>}
                {state === "upcoming" && <Badge variant="info">{t("challenges.upcoming")}</Badge>}
                {state === "ended" && <Badge variant="outline">{t("challenges.ended")}</Badge>}
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground">{challenge.description}</p>
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">
                {t(`admin.challenges.metric.${challenge.metric}` as TranslationKey)} · {t("admin.challenges.target", { target: challenge.target })}
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                <Trophy className="size-3.5 text-star" /> {t("admin.challenges.completedCount", { count: challenge.completed_count })}
              </span>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.challenges.create.title")}</DialogTitle>
            <DialogDescription>{t("admin.challenges.create.description")}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (canSubmit) createMutation.mutate()
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="challenge-title">{t("admin.challenges.field.title")}</Label>
              <Input id="challenge-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="challenge-description">{t("admin.challenges.field.description")}</Label>
              <Textarea id="challenge-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{t("admin.challenges.field.sport")}</Label>
                <Select value={sport} onValueChange={(value) => setSport(value as SportType | "ANY")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">{t("teams.field.sport.any")}</SelectItem>
                    {SPORTS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {sportLabels[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t("admin.challenges.field.metric")}</Label>
                <Select value={metric} onValueChange={(value) => setMetric(value as ChallengeMetric)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHALLENGE_METRICS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`admin.challenges.metric.${option}` as TranslationKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="challenge-target">{t("admin.challenges.field.target")}</Label>
                <Input id="challenge-target" type="number" min={1} value={target} onChange={(event) => setTarget(event.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="challenge-starts">{t("admin.challenges.field.startsAt")}</Label>
                <Input id="challenge-starts" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="challenge-ends">{t("admin.challenges.field.endsAt")}</Label>
                <Input id="challenge-ends" type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={(event) => setEndsAt(event.target.value)} aria-invalid={rangeInvalid} required />
              </div>
            </div>
            {rangeInvalid && <p className="-mt-2 text-xs text-danger">{t("admin.availability.rangeInvalid")}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!canSubmit} isLoading={createMutation.isPending}>
                {t("admin.challenges.create.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { ChallengesTab }
