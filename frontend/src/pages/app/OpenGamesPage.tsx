import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarPlus, CheckCircle2, Clock3, Hourglass, MessageSquareQuote, Sparkles, Users, XCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { FilterChip } from "@/components/shared/filter-chip"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { DateBlock } from "@/components/shared/reservation-card"
import { ReservationDetailDialog } from "@/components/shared/reservation-detail-dialog"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { SubsectionHeading } from "@/components/shared/subsection-heading"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { useMyReservations } from "@/lib/queries"
import { groupByDay, isUpcoming } from "@/lib/reservation-status"
import type { JoinRequestStatus, OpenGame, Reservation, SportType } from "@/types"

const SPORTS: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]

const REQUEST_BADGE: Record<JoinRequestStatus, { variant: "warning" | "success" | "destructive" | "secondary"; icon: typeof Clock3 }> = {
  PENDING: { variant: "warning", icon: Hourglass },
  ACCEPTED: { variant: "success", icon: CheckCircle2 },
  DECLINED: { variant: "destructive", icon: XCircle },
  CANCELLED: { variant: "secondary", icon: XCircle },
}

function OpenGamesPage() {
  const { token, user } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const sportLabels = useSportLabels()
  const queryClient = useQueryClient()
  const [sport, setSport] = useState<SportType | null>(null)
  const [joinTarget, setJoinTarget] = useState<OpenGame | null>(null)
  const [joinNote, setJoinNote] = useState("")
  const [detail, setDetail] = useState<Reservation | null>(null)

  const { data: openGames, isLoading, isError, refetch } = useQuery({
    queryKey: ["reservations-open"],
    queryFn: () => api.listOpenGames(token!),
    enabled: Boolean(token),
  })
  const { data: myJoinRequests } = useQuery({
    queryKey: ["join-requests-mine"],
    queryFn: () => api.listMyJoinRequests(token!),
    enabled: Boolean(token),
  })
  const { data: myReservations } = useMyReservations()

  const requestToJoinMutation = useMutation({
    mutationFn: ({ game, note }: { game: OpenGame; note: string }) => api.requestToJoin(token!, game.id, note || undefined),
    onSuccess: () => {
      toast.success(t("dashboard.toast.joinRequestSent"))
      setJoinTarget(null)
      queryClient.invalidateQueries({ queryKey: ["join-requests-mine"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("dashboard.error.joinRequest")),
  })

  const requestByReservation = new Map((myJoinRequests ?? []).map((request) => [request.reservation_id, request]))
  const others = useMemo(
    () =>
      (openGames ?? [])
        .filter((game) => game.user.id !== user?.id)
        .filter((game) => (sport ? game.court.sport_type === sport : true))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [openGames, user?.id, sport],
  )
  const gameById = new Map((openGames ?? []).map((game) => [game.id, game]))
  const myOpen = (myReservations ?? []).filter((r) => r.open_to_join && isUpcoming(r))

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow={t("nav.group.community")}
        title={t("openGames.title")}
        description={t("openGames.description")}
        actions={
          <Button variant="outline" asChild>
            <Link to="/app">
              <Sparkles /> {t("openGames.hostCta")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={sport === null} onClick={() => setSport(null)} count={openGames ? openGames.filter((g) => g.user.id !== user?.id).length : undefined}>
              {t("courts.allSports")}
            </FilterChip>
            {SPORTS.map((option) => (
              <FilterChip key={option} active={sport === option} onClick={() => setSport((s) => (s === option ? null : option))}>
                {sportLabels[option]}
              </FilterChip>
            ))}
          </div>

          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[112px] w-full rounded-xl" />)}
          {isError && <ErrorState onRetry={() => refetch()} />}
          {!isLoading && !isError && others.length === 0 && (
            <EmptyState
              icon={Users}
              title={t("dashboard.openGames.empty.title")}
              description={t("dashboard.openGames.empty.description")}
              action={
                <Button variant="brand" size="sm" asChild>
                  <Link to="/app/book">
                    <CalendarPlus /> {t("nav.book")}
                  </Link>
                </Button>
              }
            />
          )}

          {groupByDay(others).map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <h2 className="eyebrow">
                {fmt.dayLabel(group.date)}
                {fmt.dayLabel(group.date) !== fmt.date(group.date) && <span className="ml-2 normal-case opacity-70">{fmt.date(group.date)}</span>}
              </h2>
              <div className="stagger flex flex-col gap-2">
                {group.items.map((game, index) => {
                  const request = requestByReservation.get(game.id)
                  const badge = request ? REQUEST_BADGE[request.status] : null
                  return (
                    <article
                      key={game.id}
                      style={{ "--i": index } as React.CSSProperties}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-[border-color,box-shadow] hover:border-border-strong sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3.5">
                        <DateBlock iso={game.start_time} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[14px] font-semibold">{game.court.name}</span>
                            <Badge variant="brand">{t("dashboard.openGames.spotsLeft", { count: game.spots_left })}</Badge>
                          </div>
                          <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                            <SportIcon sport={game.court.sport_type} className="size-3.5" />
                            {sportLabels[game.court.sport_type]}
                            <span className="font-mono text-foreground/85 tabular">{fmt.timeRange(game.start_time, game.end_time)}</span>
                          </span>
                          <Link to={`/app/players/${game.user.id}`} className="flex w-fit items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                            <UserAvatar name={game.user.name} avatarUrl={game.user.avatar_url} size="xs" />
                            {t("dashboard.openGames.hostedBy", { name: game.user.name })}
                          </Link>
                          {game.open_note && (
                            <p className="flex items-start gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground/80">
                              <MessageSquareQuote className="mt-px size-3.5 shrink-0 text-muted-foreground" /> {game.open_note}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 justify-end">
                        {badge && request ? (
                          <Badge variant={badge.variant} className="h-8 px-2.5 text-[13px]">
                            <badge.icon /> {t(`joinRequestStatus.${request.status}` as TranslationKey)}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            disabled={game.spots_left <= 0}
                            onClick={() => {
                              setJoinTarget(game)
                              setJoinNote("")
                            }}
                          >
                            {t("dashboard.openGames.request")}
                          </Button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
            <SubsectionHeading title={t("openGames.mine.title")} count={myOpen.length} />
            {myOpen.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{t("openGames.mine.empty")}</p>
            ) : (
              <div className="flex flex-col gap-1">
                {myOpen.map((reservation) => (
                  <button
                    key={reservation.id}
                    type="button"
                    onClick={() => setDetail(reservation)}
                    className="flex items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <SportIcon sport={reservation.court.sport_type} className="size-4 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium">{reservation.court.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmt.dayLabel(reservation.start_time)} · <span className="font-mono">{fmt.time(reservation.start_time)}</span>
                      </span>
                    </div>
                    <span className="text-xs font-medium text-foreground">{t("openGames.mine.manage")}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
            <SubsectionHeading title={t("dashboard.myJoinRequests.title")} count={myJoinRequests?.length} />
            {!myJoinRequests && <Skeleton className="h-16" />}
            {myJoinRequests?.length === 0 && <p className="text-[13px] text-muted-foreground">{t("dashboard.myJoinRequests.empty")}</p>}
            <div className="flex flex-col gap-2">
              {myJoinRequests?.map((request) => {
                const game = gameById.get(request.reservation_id)
                const badge = REQUEST_BADGE[request.status]
                return (
                  <div key={request.id} className="flex items-center gap-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium">{game ? game.court.name : t("openGames.requests.unknownGame")}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {game ? `${fmt.dayLabel(game.start_time)} · ${fmt.time(game.start_time)}` : fmt.relativeTime(request.created_at)}
                      </span>
                    </div>
                    <Badge variant={badge.variant}>
                      <badge.icon /> {t(`joinRequestStatus.${request.status}` as TranslationKey)}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="flex gap-3 rounded-xl border border-dashed border-border-strong p-4">
            <Sparkles className="size-4 shrink-0 text-brand-ink" />
            <p className="text-xs leading-relaxed text-muted-foreground">{t("openGames.howItWorks")}</p>
          </div>
        </aside>
      </div>

      <Dialog open={Boolean(joinTarget)} onOpenChange={(open) => !open && setJoinTarget(null)}>
        <DialogContent>
          {joinTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{t("dashboard.joinRequest.dialog.title")}</DialogTitle>
                <DialogDescription>
                  {t("dashboard.joinRequest.dialog.description", { name: joinTarget.user.name, court: joinTarget.court.name })}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <UserAvatar name={joinTarget.user.name} avatarUrl={joinTarget.user.avatar_url} size="sm" />
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">{joinTarget.court.name}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular">{fmt.dateRange(joinTarget.start_time, joinTarget.end_time)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="join-note">{t("openGames.join.noteLabel")}</Label>
                <Textarea
                  id="join-note"
                  value={joinNote}
                  onChange={(event) => setJoinNote(event.target.value)}
                  placeholder={t("dashboard.joinRequest.notePlaceholder")}
                  maxLength={200}
                  rows={3}
                />
                <span className="self-end font-mono text-[11px] text-subtle-foreground tabular">{joinNote.length}/200</span>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setJoinTarget(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  isLoading={requestToJoinMutation.isPending}
                  onClick={() => requestToJoinMutation.mutate({ game: joinTarget, note: joinNote.trim() })}
                >
                  {t("dashboard.joinRequest.send")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ReservationDetailDialog reservation={detail} onClose={() => setDetail(null)} />
    </PageContainer>
  )
}

export { OpenGamesPage }
