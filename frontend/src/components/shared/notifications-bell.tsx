import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { LucideIcon } from "lucide-react"
import {
  AlarmClock,
  Award,
  Bell,
  BellOff,
  CalendarCheck2,
  CalendarX2,
  CheckCheck,
  Hourglass,
  Settings,
  ShieldCheck,
  Swords,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react"
import { createElement, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip } from "@/components/ui/tooltip"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories"
import { cn } from "@/lib/utils"
import type { Notification, NotificationType } from "@/types"

// Notifications don't carry a specific reservation id (backend intentionally
// keeps them lightweight), so clicking one routes by *type* to the screen
// where that kind of update actually lives, rather than a dead end.
const NOTIFICATION_DESTINATION: Record<NotificationType, string> = {
  RESERVATION_CREATED: "/app",
  RESERVATION_CONFIRMED: "/app",
  RESERVATION_CANCELLED: "/app?view=history",
  RESERVATION_CHANGED: "/app",
  RESERVATION_REMINDER: "/app",
  RESERVATION_EXPIRED: "/app?view=history",
  RESERVATION_REJECTED: "/app?view=history",
  APPROVAL_REQUESTED: "/app/admin?tab=reservations&status=PENDING_APPROVAL",
  FACILITY_UNAVAILABLE: "/app",
  WAITLIST_JOINED: "/app",
  WAITLIST_SLOT_OFFERED: "/app",
  ACHIEVEMENT_UNLOCKED: "/app/profile?tab=achievements",
  JOIN_REQUEST_RECEIVED: "/app",
  JOIN_REQUEST_ACCEPTED: "/app/games",
  JOIN_REQUEST_DECLINED: "/app/games",
  NEW_FOLLOWER: "/app/players",
  TEAM_MEMBER_ADDED: "/app/teams",
  MATCH_RESULT_REPORTED: "/app/profile",
  CHALLENGE_COMPLETED: "/app/profile?tab=challenges",
  TEAM_JOIN_REQUEST_RECEIVED: "/app/teams",
  TEAM_JOIN_REQUEST_ACCEPTED: "/app/teams",
  TEAM_JOIN_REQUEST_DECLINED: "/app/teams",
  PAYMENT_RECEIVED: "/app",
  PAYMENT_REFUNDED: "/app?view=history",
  REFUND_FAILED: "/app/admin?tab=payments&status=REFUND_FAILED",
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  reservations: CalendarCheck2,
  reminders: AlarmClock,
  approvals: ShieldCheck,
  facility: CalendarX2,
  waitlist: Hourglass,
  achievements: Award,
  joinRequests: UserPlus,
  social: Users,
  teams: UsersRound,
  matches: Swords,
  payments: Wallet,
}

function iconFor(type: NotificationType): LucideIcon {
  const category = NOTIFICATION_CATEGORIES.find((entry) => entry.types.includes(type))
  return (category && CATEGORY_ICON[category.key]) ?? Bell
}

function NotificationRow({ notification, onOpen }: { notification: Notification; onOpen: (n: Notification) => void }) {
  const fmt = useFormatters()
  const isUnread = notification.read_at === null
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className="group flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border",
          isUnread ? "border-transparent bg-brand-soft text-brand-ink" : "border-border bg-card text-muted-foreground",
        )}
      >
        {createElement(iconFor(notification.type), { className: "size-4" })}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-start justify-between gap-2">
          <span className={cn("text-[13px] leading-snug", isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>
            {notification.title}
          </span>
          {isUnread && <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-brand ring-2 ring-brand-soft" />}
        </span>
        <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{notification.message}</span>
        <span className="font-mono text-[10.5px] text-subtle-foreground">{fmt.relativeTime(notification.created_at)}</span>
      </span>
    </button>
  )
}

function NotificationsBell() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => api.unreadNotificationCount(token!),
    enabled: Boolean(token),
    refetchInterval: 20_000,
  })

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.listNotifications(token!),
    enabled: Boolean(token) && open,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] })
    queryClient.invalidateQueries({ queryKey: ["notifications-unread"] })
  }

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(token!, id),
    onSuccess: invalidate,
  })

  const markAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(token!),
    onSuccess: invalidate,
  })

  const unreadCount = unread?.count ?? 0
  const visible = (notifications ?? []).filter((n) => filter === "all" || n.read_at === null)

  function handleOpen(notification: Notification) {
    if (notification.read_at === null) markReadMutation.mutate(notification.id)
    setOpen(false)
    navigate(NOTIFICATION_DESTINATION[notification.type] ?? "/app")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={t("notifications.title")}>
        <PopoverTrigger asChild>
          <Button
            variant="subtle"
            size="icon-sm"
            className="relative"
            aria-label={unreadCount > 0 ? t("notifications.ariaUnread", { count: unreadCount }) : t("notifications.title")}
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[9.5px] font-semibold text-brand-foreground ring-2 ring-background tabular">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="flex w-[min(24rem,calc(100vw-1.5rem))] flex-col p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
          <span className="text-[14px] font-semibold text-foreground">{t("notifications.title")}</span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="xs" isLoading={markAllMutation.isPending} onClick={() => markAllMutation.mutate()}>
                {!markAllMutation.isPending && <CheckCheck />} {t("notifications.markAllRead")}
              </Button>
            )}
            <Tooltip content={t("notificationPrefs.title")}>
              <Button variant="subtle" size="icon-xs" asChild>
                <Link to="/app/settings#notifications" onClick={() => setOpen(false)} aria-label={t("notificationPrefs.title")}>
                  <Settings />
                </Link>
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="px-3.5 pt-2.5">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as "all" | "unread")}>
            <TabsList className="w-full *:flex-1">
              <TabsTrigger value="all">{t("notifications.filter.all")}</TabsTrigger>
              <TabsTrigger value="unread">
                {t("notifications.filter.unread")}
                {unreadCount > 0 && <span className="font-mono text-[10px] text-subtle-foreground tabular">{unreadCount}</span>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex max-h-[min(28rem,70vh)] flex-col gap-0.5 overflow-y-auto p-1.5">
          {isLoading &&
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex gap-3 px-2.5 py-2.5">
                <Skeleton className="size-8 shrink-0" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          {!isLoading && visible.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground">
                <BellOff className="size-4" />
              </span>
              <p className="text-[13px] font-medium text-foreground">
                {filter === "unread" ? t("notifications.emptyUnread") : t("notifications.empty")}
              </p>
              <p className="text-xs text-muted-foreground">{t("notifications.emptyHint")}</p>
            </div>
          )}
          {visible.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} onOpen={handleOpen} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { NotificationsBell }
