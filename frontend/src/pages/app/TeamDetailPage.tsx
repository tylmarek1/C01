import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, MessageCircle, Trash2, UserPlus, X } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/avatar"
import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/card"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { PlayerSearch } from "@/components/shared/player-search"
import { Skeleton } from "@/components/shared/skeleton"
import { useSportLabels } from "@/components/shared/sport-icon"
import { ApiError, api, assetUrl } from "@/lib/api"
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

function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const {
    data: team,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["team", id],
    queryFn: () => api.getTeam(token!, id!),
    enabled: Boolean(token && id),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["team", id] })

  const addMemberMutation = useMutation({
    mutationFn: (player: PlayerSearchResult) => api.addTeamMember(token!, id!, { userId: player.id }),
    onSuccess: () => {
      invalidate()
      toast.success(t("teams.toast.memberAdded"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.error.addMemberFailed")),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.removeTeamMember(token!, id!, userId),
    onSuccess: (_team, removedUserId) => {
      setRemoveTarget(null)
      queryClient.invalidateQueries({ queryKey: ["teams-mine"] })
      if (removedUserId === user?.id) {
        // We just left — the detail page is no longer accessible to us.
        navigate("/app/teams")
      } else {
        invalidate()
      }
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.error.removeMemberFailed")),
  })

  const deleteTeamMutation = useMutation({
    mutationFn: () => api.deleteTeam(token!, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams-mine"] })
      toast.success(t("teams.toast.deleted"))
      navigate("/app/teams")
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.error.deleteFailed")),
  })

  const chatMutation = useMutation({
    mutationFn: () => api.openTeamChat(token!, id!),
    onSuccess: (conversation) => navigate(`/app/chat?conversation=${conversation.id}`),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.error.chatFailed")),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError || !team) {
    return <ErrorState title={t("teams.error.loadFailed")} onRetry={() => refetch()} />
  }

  const isOwner = team.my_role === "OWNER"

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/app/teams")}>
        <ArrowLeft className="size-4" /> {t("teams.back")}
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-ink-navy">{team.name}</h1>
              {team.sport_type && <Badge>{sportLabels[team.sport_type]}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={chatMutation.isPending} onClick={() => chatMutation.mutate()}>
                <MessageCircle className="size-4" /> {t("teams.chat")}
              </Button>
              {isOwner && (
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="size-4" /> {t("teams.delete")}
                </Button>
              )}
            </div>
          </div>
          {team.description && <p className="text-sm text-slate-gray">{team.description}</p>}
          <span className="text-xs text-slate-gray">
            {t("teams.createdAt", { date: new Date(team.created_at).toLocaleDateString() })}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("teams.roster.title", { count: team.members.length })}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {team.members.map((member) => (
            <div key={member.user.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2">
              <Link to={`/app/players/${member.user.id}`} className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarImage src={assetUrl(member.user.avatar_url)} alt={member.user.name} loading="lazy" className="object-cover" />
                  <AvatarFallback>{initials(member.user.name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink-navy">{member.user.name}</span>
                  <span className="text-xs text-slate-gray">
                    {member.role === "OWNER" && `${t("teams.role.owner")} · `}
                    {t("teams.roster.joinedAt", { date: new Date(member.joined_at).toLocaleDateString() })}
                  </span>
                </div>
              </Link>
              {(isOwner || member.user.id === user?.id) && (
                <button
                  type="button"
                  onClick={() => setRemoveTarget(member.user.id)}
                  disabled={removeMemberMutation.isPending}
                  className="text-slate-gray hover:text-destructive"
                  aria-label={member.user.id === user?.id ? t("teams.leave") : t("teams.roster.remove")}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}

          {isOwner && (
            <div className="mt-2 flex items-center gap-2">
              <UserPlus className="size-4 shrink-0 text-slate-gray" />
              <div className="flex-1">
                <PlayerSearch
                  placeholder={t("teams.field.addMemberPlaceholder")}
                  excludeIds={team.members.map((member) => member.user.id)}
                  onSelect={(player) => addMemberMutation.mutate(player)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={removeTarget === user?.id ? t("confirmDialog.leaveTeam.title") : t("confirmDialog.removeTeamMember.title")}
        description={removeTarget === user?.id ? t("confirmDialog.leaveTeam.description") : t("confirmDialog.removeTeamMember.description")}
        confirmLabel={removeTarget === user?.id ? t("teams.leave") : t("teams.roster.remove")}
        isLoading={removeMemberMutation.isPending}
        onConfirm={() => removeTarget && removeMemberMutation.mutate(removeTarget)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("confirmDialog.deleteTeam.title", { name: team.name })}
        description={t("confirmDialog.deleteTeam.description")}
        confirmLabel={t("teams.delete")}
        isLoading={deleteTeamMutation.isPending}
        onConfirm={() => deleteTeamMutation.mutate()}
      />
    </div>
  )
}

export { TeamDetailPage }
