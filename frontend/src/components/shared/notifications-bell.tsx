import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCheck } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/shared/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shared/dropdown-menu"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Notification, NotificationType } from "@/types"

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

function relativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60_000)
  if (Math.abs(diffMinutes) < 60) return relativeTimeFormatter.format(diffMinutes, "minute")
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return relativeTimeFormatter.format(diffHours, "hour")
  return relativeTimeFormatter.format(Math.round(diffHours / 24), "day")
}

// Notifications don't carry a specific reservation id (backend intentionally
// keeps them lightweight), so clicking one routes by *type* to the screen
// where that kind of update actually lives, rather than a dead end.
const NOTIFICATION_DESTINATION: Record<NotificationType, string> = {
  RESERVATION_CREATED: "/app",
  RESERVATION_CONFIRMED: "/app",
  RESERVATION_CANCELLED: "/app",
  RESERVATION_CHANGED: "/app",
  RESERVATION_REMINDER: "/app",
  RESERVATION_EXPIRED: "/app",
  FACILITY_UNAVAILABLE: "/app",
  WAITLIST_JOINED: "/app",
  WAITLIST_SLOT_OFFERED: "/app",
  ACHIEVEMENT_UNLOCKED: "/app/profile",
  JOIN_REQUEST_RECEIVED: "/app",
  JOIN_REQUEST_ACCEPTED: "/app",
  JOIN_REQUEST_DECLINED: "/app",
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification
  onOpen: (notification: Notification) => void
}) {
  const isUnread = notification.read_at === null
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-pebble",
        isUnread && "bg-[#eaf3ff]",
      )}
    >
      <span className="flex items-center gap-2">
        {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-signal-blue" />}
        <span className="text-sm font-medium text-ink-navy">{notification.title}</span>
      </span>
      <span className="text-xs text-slate-gray">{notification.message}</span>
      <span className="text-[11px] text-mist-gray">{relativeTime(notification.created_at)}</span>
    </button>
  )
}

function NotificationsBell() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => api.unreadNotificationCount(token!),
    enabled: Boolean(token),
    refetchInterval: 20_000,
  })

  const { data: notifications } = useQuery({
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

  function handleOpen(notification: Notification) {
    if (notification.read_at === null) markReadMutation.mutate(notification.id)
    setOpen(false)
    navigate(NOTIFICATION_DESTINATION[notification.type] ?? "/app")
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex size-9 items-center justify-center rounded-full text-slate-gray transition-colors hover:bg-pebble hover:text-ink-navy"
          aria-label={t("notifications.title")}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-signal-blue text-[10px] font-semibold text-paper">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <div className="flex items-center justify-between px-1">
          <DropdownMenuLabel className="px-2">{t("notifications.title")}</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(event) => {
                event.stopPropagation()
                markAllMutation.mutate()
              }}
            >
              <CheckCheck className="size-3.5" /> {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {notifications?.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-gray">{t("notifications.empty")}</p>
          )}
          {notifications?.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} onOpen={handleOpen} />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { NotificationsBell }
