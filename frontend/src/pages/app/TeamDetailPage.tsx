import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Camera, Check, Crown, Globe, Lock, LogOut, MessageCircle, MoreHorizontal, Pencil, Shield, Trash2, UserMinus, UserPlus, X } from "lucide-react"
import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { PageContainer } from "@/components/shared/page-header"
import { PlayerSearch } from "@/components/shared/player-search"
import { SportIcon, useSportLabels } from "@/components/shared/sport-icon"
import { SportPicker } from "@/components/shared/sport-picker"
import { SubsectionHeading } from "@/components/shared/subsection-heading"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { compressImageFile } from "@/lib/image"
import { cn } from "@/lib/utils"
import type { PlayerSearchResult, SportType, Team, TeamRole } from "@/types"

const ROLE_ORDER: Record<TeamRole, number> = { OWNER: 0, CAPTAIN: 1, MEMBER: 2 }

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
      queryClient.invalidateQueries({ queryKey: ["teams-mine"] })
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
      <UserAvatar name={team.name} avatarUrl={team.avatar_url} src={preview} size="2xl" className="rounded-2xl ring-4 ring-card [&_*]:rounded-2xl" />
      {canManage && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarMutation.isPending}
            className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
            aria-label={t("teams.avatar.change")}
          >
            <Camera className="size-3.5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleChange} />
        </>
      )}
    </div>
  )
}

function EditTeamDialog({ team, isOwner, open, onOpenChange }: { team: Team; isOwner: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
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
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: ["team", team.id] })
      queryClient.invalidateQueries({ queryKey: ["teams-mine"] })
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("teams.edit.title")}</DialogTitle>
          <DialogDescription>{team.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-team-name">{t("teams.field.name")}</Label>
            <Input id="edit-team-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("teams.field.sport")}</Label>
            <SportPicker value={sport} onChange={setSport} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-team-description">{t("teams.field.description")}</Label>
            <Textarea id="edit-team-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} />
          </div>
          {isOwner && (
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium">{t("teams.field.isPublic")}</span>
                <span className="text-xs text-muted-foreground">{t("teams.field.isPublic.hint")}</span>
              </span>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label={t("teams.field.isPublic")} />
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={name.trim().length === 0} isLoading={updateMutation.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function JoinRequestsPanel({ teamId }: { teamId: string }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
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

  const pending = (requests ?? []).filter((r) => r.status === "PENDING")
  if (pending.length === 0) return null

  return (
    <section className="flex animate-fade-up flex-col gap-3 rounded-xl border border-brand/50 bg-brand-soft/50 p-4">
      <SubsectionHeading title={t("teams.joinRequests.heading")} count={pending.length} />
      <ul className="flex flex-col gap-2">
        {pending.map((request) => (
          <li key={request.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-xs">
            <Link to={`/app/players/${request.user.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar name={request.user.name} avatarUrl={request.user.avatar_url} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium">{request.user.name}</span>
                <span className="font-mono text-[11px] text-subtle-foreground">{fmt.relativeTime(request.created_at)}</span>
              </span>
            </Link>
            <Button size="sm" variant="outline" disabled={declineMutation.isPending || acceptMutation.isPending} onClick={() => declineMutation.mutate(request.id)}>
              <X /> {t("teams.joinRequests.decline")}
            </Button>
            <Button size="sm" disabled={acceptMutation.isPending || declineMutation.isPending} onClick={() => acceptMutation.mutate(request.id)}>
              <Check /> {t("teams.joinRequests.accept")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const sportLabels = useSportLabels()
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const { data: team, isLoading, isError, refetch } = useQuery({
    queryKey: ["team", id],
    queryFn: () => api.getTeam(token!, id!),
    enabled: Boolean(token && id),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["team", id] })
    queryClient.invalidateQueries({ queryKey: ["teams-mine"] })
  }

  const addMemberMutation = useMutation({
    mutationFn: (player: PlayerSearchResult) => api.addTeamMember(token!, id!, { userId: player.id }),
    onSuccess: (_team, player) => {
      invalidate()
      toast.success(t("teams.toast.memberAddedName", { name: player.name }))
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
        toast.success(t("teams.toast.left"))
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
      <PageContainer>
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-64 w-full rounded-xl" />
      </PageContainer>
    )
  }
  if (isError || !team) {
    return (
      <PageContainer size="narrow">
        <ErrorState title={t("teams.error.loadFailed")} onRetry={() => refetch()} />
      </PageContainer>
    )
  }

  const isOwner = team.my_role === "OWNER"
  const isManage = isOwner || team.my_role === "CAPTAIN"
  const members = [...team.members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.user.name.localeCompare(b.user.name))
  const removeIsSelf = removeTarget === user?.id
  const removeName = team.members.find((m) => m.user.id === removeTarget)?.user.name ?? ""

  return (
    <PageContainer>
      <Link to="/app/teams" className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("teams.back")}
      </Link>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div aria-hidden className="h-20 bg-panel" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="-mt-10 flex flex-col gap-3 sm:flex-row sm:items-end">
            <TeamAvatarUpload team={team} canManage={isManage} />
            <div className="flex flex-col gap-1.5">
              <h1 className="display text-[44px] sm:text-[52px]">{team.name}</h1>
              <div className="flex flex-wrap items-center gap-1.5">
                {team.sport_type && (
                  <Badge variant="secondary">
                    <SportIcon sport={team.sport_type} /> {sportLabels[team.sport_type]}
                  </Badge>
                )}
                <Badge variant="outline">
                  {team.is_public ? <Globe /> : <Lock />} {team.is_public ? t("teams.public") : t("teams.private")}
                </Badge>
                <span className="text-xs text-muted-foreground">{t("teams.createdAt", { date: fmt.dateMedium(team.created_at) })}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" isLoading={chatMutation.isPending} onClick={() => chatMutation.mutate()}>
              {!chatMutation.isPending && <MessageCircle />} {t("teams.chat")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="outline" aria-label={t("reservationCard.moreActions")}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isManage && (
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                    <Pencil /> {t("teams.edit")}
                  </DropdownMenuItem>
                )}
                {!isOwner && (
                  <DropdownMenuItem variant="destructive" onSelect={() => setRemoveTarget(user!.id)}>
                    <LogOut /> {t("teams.leave")}
                  </DropdownMenuItem>
                )}
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                      <Trash2 /> {t("teams.delete")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {team.description && <p className="border-t border-border px-5 py-4 text-[14px] leading-relaxed text-foreground/85 sm:px-6">{team.description}</p>}
      </section>

      <div className="mt-6 flex flex-col gap-6">
        {isManage && <JoinRequestsPanel teamId={team.id} />}

        <section className="flex flex-col gap-3">
          <SubsectionHeading
            title={t("teams.roster.heading")}
            count={team.members.length}
            action={
              isManage && (
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <UserPlus /> {t("teams.addMember")}
                </Button>
              )
            }
          />
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {members.map((member) => {
              const isMe = member.user.id === user?.id
              const canRemove = !isMe && (isOwner || (team.my_role === "CAPTAIN" && member.role === "MEMBER"))
              return (
                <li key={member.user.id} className={cn("flex items-center gap-3 px-4 py-3", isMe && "bg-muted/40")}>
                  <Link to={`/app/players/${member.user.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar name={member.user.name} avatarUrl={member.user.avatar_url} />
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 truncate text-[13px] font-medium">
                        {member.user.name}
                        {isMe && <span className="text-[11px] font-normal text-muted-foreground">({t("leaderboard.you")})</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{t("teams.roster.joinedAt", { date: fmt.dateMedium(member.joined_at) })}</span>
                    </span>
                  </Link>
                  {member.role === "OWNER" && (
                    <Badge variant="brand">
                      <Crown /> {t("teams.role.owner")}
                    </Badge>
                  )}
                  {member.role === "CAPTAIN" && (
                    <Badge variant="info">
                      <Shield /> {t("teams.role.captain")}
                    </Badge>
                  )}
                  {(isOwner && member.role !== "OWNER") || canRemove ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={t("teams.roster.manage", { name: member.user.name })}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isOwner && member.role !== "OWNER" && (
                          <>
                            <DropdownMenuLabel>{t("teams.roster.role")}</DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                              value={member.role}
                              onValueChange={(value) => roleMutation.mutate({ userId: member.user.id, role: value as TeamRole })}
                            >
                              <DropdownMenuRadioItem value="MEMBER">{t("teams.role.member")}</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="CAPTAIN">{t("teams.role.captain")}</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </>
                        )}
                        {canRemove && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setRemoveTarget(member.user.id)}>
                              <UserMinus /> {t("teams.roster.remove")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="w-8" />
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {editOpen && <EditTeamDialog team={team} isOwner={isOwner} open onOpenChange={setEditOpen} />}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("teams.addMember")}</DialogTitle>
            <DialogDescription>{t("teams.addMemberDescription", { team: team.name })}</DialogDescription>
          </DialogHeader>
          <PlayerSearch
            autoFocus
            placeholder={t("teams.field.addMemberPlaceholder")}
            excludeIds={team.members.map((member) => member.user.id)}
            onSelect={(player) => addMemberMutation.mutate(player)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={removeIsSelf ? t("confirmDialog.leaveTeam.title") : t("confirmDialog.removeTeamMemberNamed.title", { name: removeName })}
        description={removeIsSelf ? t("confirmDialog.leaveTeam.description") : t("confirmDialog.removeTeamMember.description")}
        confirmLabel={removeIsSelf ? t("teams.leave") : t("teams.roster.remove")}
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
    </PageContainer>
  )
}

export { TeamDetailPage }
