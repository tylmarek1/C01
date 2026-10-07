import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowDownUp, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { FilterChip } from "@/components/shared/filter-chip"
import { SearchInput } from "@/components/shared/search-input"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { ROLE_VARIANT, useRoleLabels } from "@/lib/user-role"
import { cn } from "@/lib/utils"
import type { UserAdmin, UserRole } from "@/types"

// Mirrors backend rules.NO_SHOW_LIMIT — highlight only; the backend enforces it.
const NO_SHOW_LIMIT = 3
const ROLES: UserRole[] = ["PLAYER", "VENUE_MANAGER", "ADMIN"]
type Sort = "newest" | "name" | "active" | "noShows"

function UsersTab() {
  const { token, user: currentUser } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const roleLabels = useRoleLabels()
  const queryClient = useQueryClient()
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: UserAdmin; role: UserRole } | null>(null)
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | null>(null)
  const [sort, setSort] = useState<Sort>("newest")
  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.listAdminUsers(token!, { limit: 200 }),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => api.updateUserRole(token!, userId, role),
    onSuccess: (updated) => {
      toast.success(t("admin.toast.roleUpdatedFor", { name: updated.name, role: roleLabels[updated.role] }))
      setRoleChangeTarget(null)
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("admin.error.roleUpdate")),
  })

  const isCurrentUserAdmin = currentUser?.role === "ADMIN"
  const isGrant = roleChangeTarget?.role === "ADMIN"

  function handleRoleChange(user: UserAdmin, role: UserRole) {
    if (role === user.role) return
    // Granting or revoking the top tier is significant enough to confirm;
    // the PLAYER <-> VENUE_MANAGER toggle stays a single click.
    if (role === "ADMIN" || user.role === "ADMIN") setRoleChangeTarget({ user, role })
    else roleMutation.mutate({ userId: user.id, role })
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const u of users ?? []) c[u.role] = (c[u.role] ?? 0) + 1
    return c
  }, [users])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (users ?? [])
      .filter((u) => (roleFilter ? u.role === roleFilter : true))
      .filter((u) => (q ? u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) : true))
    return [...list].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name)
        case "active":
          return b.active_reservation_count - a.active_reservation_count
        case "noShows":
          return b.no_show_count - a.no_show_count
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
  }, [users, query, roleFilter, sort])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={query} onValueChange={setQuery} placeholder={t("admin.users.searchPlaceholder")} className="lg:w-80" />
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={roleFilter === null} onClick={() => setRoleFilter(null)} count={users?.length}>
            {t("admin.users.allRoles")}
          </FilterChip>
          {ROLES.map((role) => (
            <FilterChip key={role} active={roleFilter === role} onClick={() => setRoleFilter(roleFilter === role ? null : role)} count={counts[role] ?? 0}>
              {roleLabels[role]}
            </FilterChip>
          ))}
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
          <SelectTrigger className="w-full lg:ml-auto lg:w-48" aria-label={t("courts.sort.label")}>
            <ArrowDownUp className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="newest">{t("admin.users.sort.newest")}</SelectItem>
            <SelectItem value="name">{t("admin.users.sort.name")}</SelectItem>
            <SelectItem value="active">{t("admin.users.sort.active")}</SelectItem>
            <SelectItem value="noShows">{t("admin.users.sort.noShows")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError && <ErrorState onRetry={() => refetch()} />}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="hidden grid-cols-[minmax(0,2fr)_6rem_6rem_7rem_12rem] gap-4 border-b border-border bg-muted/50 px-4 py-2.5 md:grid">
          <span className="eyebrow">{t("admin.table.player")}</span>
          <span className="eyebrow text-right">{t("admin.users.col.active")}</span>
          <span className="eyebrow text-right">{t("admin.users.col.noShows")}</span>
          <span className="eyebrow">{t("admin.users.col.joined")}</span>
          <span className="eyebrow">{t("admin.users.col.role")}</span>
        </div>
        <ul className="divide-y divide-border">
          {isLoading &&
            Array.from({ length: 6 }).map((_, index) => (
              <li key={index} className="px-4 py-3">
                <Skeleton className="h-10" />
              </li>
            ))}
          {visible.map((user) => {
            const isSelf = user.id === currentUser?.id
            const canEditRole = !isSelf && (isCurrentUserAdmin || user.role !== "ADMIN")
            const flagged = user.no_show_count >= NO_SHOW_LIMIT
            return (
              <li key={user.id} className="grid grid-cols-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,2fr)_6rem_6rem_7rem_12rem] md:gap-4">
                <Link to={`/app/players/${user.id}`} className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={user.name} avatarUrl={user.avatar_url} />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 truncate text-[13px] font-medium">
                      {user.name}
                      {isSelf && <Badge variant="outline">{t("admin.users.you")}</Badge>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                </Link>
                <span className="flex items-center justify-between font-mono text-[13px] tabular md:justify-end">
                  <span className="text-xs text-muted-foreground md:hidden">{t("admin.users.col.active")}</span>
                  {user.active_reservation_count}
                </span>
                <span className="flex items-center justify-between md:justify-end">
                  <span className="text-xs text-muted-foreground md:hidden">{t("admin.users.col.noShows")}</span>
                  {flagged ? (
                    <Tooltip content={t("admin.users.noShowFlag", { limit: NO_SHOW_LIMIT })}>
                      <Badge variant="destructive" tabIndex={0}>
                        <AlertTriangle /> {user.no_show_count}
                      </Badge>
                    </Tooltip>
                  ) : (
                    <span className={cn("font-mono text-[13px] tabular", user.no_show_count === 0 && "text-subtle-foreground")}>{user.no_show_count}</span>
                  )}
                </span>
                <span className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="md:hidden">{t("admin.users.col.joined")}</span>
                  {fmt.dateMedium(user.created_at)}
                </span>
                <div>
                  {canEditRole ? (
                    <Select value={user.role} onValueChange={(role) => handleRoleChange(user, role as UserRole)} disabled={roleMutation.isPending}>
                      <SelectTrigger className="h-8 text-[13px]" aria-label={t("admin.users.changeRole", { name: user.name })}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PLAYER">{roleLabels.PLAYER}</SelectItem>
                        <SelectItem value="VENUE_MANAGER">{roleLabels.VENUE_MANAGER}</SelectItem>
                        {isCurrentUserAdmin && <SelectItem value="ADMIN">{roleLabels.ADMIN}</SelectItem>}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Tooltip content={isSelf ? t("admin.users.selfHint") : t("admin.users.adminOnly")}>
                      <span tabIndex={0}>
                        <Badge variant={ROLE_VARIANT[user.role]}>{roleLabels[user.role]}</Badge>
                      </span>
                    </Tooltip>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        {!isLoading && !isError && visible.length === 0 && (
          <EmptyState className="m-4 border-0" icon={Users} title={t("admin.users.noMatches")} description={t("admin.users.noMatchesHint")} />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(roleChangeTarget)}
        onOpenChange={(open) => !open && setRoleChangeTarget(null)}
        title={isGrant ? t("admin.users.confirmGrantAdmin.title") : t("admin.users.confirmRevokeAdmin.title")}
        description={
          roleChangeTarget
            ? t(isGrant ? "admin.users.confirmGrantAdmin.description" : "admin.users.confirmRevokeAdmin.description", {
                name: roleChangeTarget.user.name,
                role: roleLabels[roleChangeTarget.role],
              })
            : undefined
        }
        confirmLabel={isGrant ? t("admin.users.confirmGrantAdmin.confirm") : t("admin.users.confirmRevokeAdmin.confirm")}
        destructive={!isGrant}
        isLoading={roleMutation.isPending}
        onConfirm={() => roleChangeTarget && roleMutation.mutate({ userId: roleChangeTarget.user.id, role: roleChangeTarget.role })}
      />
    </div>
  )
}

export { UsersTab }
