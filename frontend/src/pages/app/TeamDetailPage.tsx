import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Camera, Check, MessageCircle, Pencil, Trash2, UserPlus, X } from "lucide-react"
import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ErrorState } from "@/components/shared/error-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlayerSearch } from "@/components/shared/player-search"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useSportLabels } from "@/components/shared/sport-icon"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { compressImageFile } from "@/lib/image"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import type { PlayerSearchResult, SportType, Team, TeamRole } from "@/types"

const SPORT_TYPES: SportType[] = ["TENNIS", "VOLLEYBALL", "BADMINTON"]

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function TeamAvatarUpload({ team, canManage }: { team: Team; canManage: boolean }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => api.uploadTeamAvatar(token!, team.id, await compressImageFile(file)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", team.id] })
      toast.success(t("teams.toast.avatarUpdated"))
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t("teams.error.avatarFailed"))
      setPreview(null)
    },
  })

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setPreview(URL.createObjectURL(file))
    avatarMutation.mutate(file)
  }

  return (
    <div className="relative shrink-0">
      <Avatar className="size-14">
        <AvatarImage src={preview ?? assetUrl(team.avatar_url)} alt={team.name} className="object-cover" />
        <AvatarFallback className="text-base">{initials(team.name)}</AvatarFallback>
      </Avatar>
      {canManage && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarMutation.isPending}
            className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-signal-blue text-paper shadow-button transition-transform hover:scale-105 disabled:opacity-60"
            aria-label={t("teams.avatar.change")}
          >
            <Camera className="size-3" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleChange}
          />
        </>
      )}
    </div>
  )
}

function EditTeamDialog({ team, isOwner }: { team: Team; isOwner: boolean }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const sportLabels = useSportLabels()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(team.name)
  const [sport, setSport] = useState<SportType | "ANY">(team.sport_type ?? "ANY")
  const [description, setDescription] = useState(team.description ?? "")
  const [isPublic, setIsPublic] = useState(team.is_public)

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateTeam(token!, team.id, {
        name: name.trim(),
        sport_type: sport === "ANY" ? null : sport,
        description: description.trim() || null,
        ...(isOwner ? { is_public: isPublic } : {}),
      }),
    onSuccess: () => {
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ["team", team.id] })
      toast.success(t("teams.toast.updated"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.error.updateFailed")),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length === 0) return
    updateMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("teams.edit")}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("teams.edit.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-team-name">{t("teams.field.name")}</Label>
            <Input id="edit-team-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
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
            <Label htmlFor="edit-team-description">{t("teams.field.description")}</Label>
            <Textarea
              id="edit-team-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          {isOwner && (
            <div className="flex items-center justify-between rounded-lg border border-hairline p-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-ink-navy">{t("teams.field.isPublic")}</span>
                <span className="text-xs text-slate-gray">{t("teams.field.isPublic.hint")}</span>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label={t("teams.field.isPublic")} />
            </div>
          )}
          <Button type="submit" disabled={updateMutation.isPending || name.trim().length === 0} className="mt-1 w-fit">
            {updateMutation.isPending ? t("teams.creating") : t("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function JoinRequestsPanel({ teamId }: { teamId: string }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: requests } = useQuery({
    queryKey: ["team-join-requests", teamId],
    queryFn: () => api.listTeamJoinRequests(token!, teamId),
    enabled: Boolean(token),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["team-join-requests", teamId] })
    queryClient.invalidateQueries({ queryKey: ["team", teamId] })
  }

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => api.acceptTeamJoinRequest(token!, teamId, requestId),
    onSuccess: () => {
      invalidate()
      toast.success(t("teams.joinRequests.toast.accepted"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.joinRequests.error.decideFailed")),
  })

  const declineMutation = useMutation({
    mutationFn: (requestId: string) => api.declineTeamJoinRequest(token!, teamId, requestId),
    onSuccess: () => {
      invalidate()
      toast.success(t("teams.joinRequests.toast.declined"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.joinRequests.error.decideFailed")),
  })

  if (!requests || requests.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("teams.joinRequests.title", { count: requests.length })}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {requests.map((request) => (
          <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2">
            <Link to={`/app/players/${request.user.id}`} className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarImage src={assetUrl(request.user.avatar_url)} alt={request.user.name} loading="lazy" className="object-cover" />
                <AvatarFallback>{initials(request.user.name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-ink-navy">{request.user.name}</span>
            </Link>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={declineMutation.isPending}
                onClick={() => declineMutation.mutate(request.id)}
              >
                <X className="size-3.5" /> {t("teams.joinRequests.decline")}
              </Button>
              <Button size="sm" disabled={acceptMutation.isPending} onClick={() => acceptMutation.mutate(request.id)}>
                <Check className="size-3.5" /> {t("teams.joinRequests.accept")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
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

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) => api.setTeamMemberRole(token!, id!, userId, role),
    onSuccess: () => {
      invalidate()
      toast.success(t("teams.toast.roleUpdated"))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("teams.error.roleUpdateFailed")),
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
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError || !team) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <ErrorState title={t("teams.error.loadFailed")} onRetry={() => refetch()} />
      </div>
    )
  }

  const isOwner = team.my_role === "OWNER"
  const isManage = isOwner || team.my_role === "CAPTAIN"

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/app/teams")}>
        <ArrowLeft className="size-4" /> {t("teams.back")}
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TeamAvatarUpload team={team} canManage={isManage} />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-ink-navy">{team.name}</h1>
                  {team.sport_type && <Badge>{sportLabels[team.sport_type]}</Badge>}
                  {!team.is_public && <Badge variant="secondary">{t("teams.private")}</Badge>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isManage && <EditTeamDialog team={team} isOwner={isOwner} />}
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

      {isManage && <JoinRequestsPanel teamId={team.id} />}

      <Card>
        <CardHeader>
          <CardTitle>{t("teams.roster.title", { count: team.members.length })}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {team.members.map((member) => {
            const canRemove =
              member.user.id === user?.id ||
              isOwner ||
              (team.my_role === "CAPTAIN" && member.role === "MEMBER")
            return (
              <div key={member.user.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2">
                <Link to={`/app/players/${member.user.id}`} className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarImage src={assetUrl(member.user.avatar_url)} alt={member.user.name} loading="lazy" className="object-cover" />
                    <AvatarFallback>{initials(member.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink-navy">{member.user.name}</span>
                    <span className="text-xs text-slate-gray">
                      {member.role !== "MEMBER" && `${t(member.role === "OWNER" ? "teams.role.owner" : "teams.role.captain")} · `}
                      {t("teams.roster.joinedAt", { date: new Date(member.joined_at).toLocaleDateString() })}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  {isOwner && member.role !== "OWNER" && (
                    <Select
                      value={member.role}
                      onValueChange={(value) => roleMutation.mutate({ userId: member.user.id, role: value as TeamRole })}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">{t("teams.role.member")}</SelectItem>
                        <SelectItem value="CAPTAIN">{t("teams.role.captain")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {canRemove && (
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
              </div>
            )
          })}

          {isManage && (
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
