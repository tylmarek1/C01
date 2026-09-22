import { useQuery, useQueryClient } from "@tanstack/react-query"
import { MessageCircle } from "lucide-react"
import { useEffect } from "react"
import { NavLink } from "react-router-dom"

import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { onChatMessage } from "@/lib/chat-socket"
import { useTranslation } from "@/lib/i18n"

function ChatNavButton() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.listConversations(token!),
    enabled: Boolean(token),
    refetchInterval: 20_000,
  })

  useEffect(() => {
    return onChatMessage(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }))
  }, [queryClient])

  const unreadCount = conversations?.reduce((total, conversation) => total + conversation.unread_count, 0) ?? 0

  return (
    <NavLink
      to="/app/chat"
      className="relative flex size-9 items-center justify-center rounded-full text-slate-gray transition-colors hover:bg-pebble hover:text-ink-navy"
      aria-label={t("chat.title")}
    >
      <MessageCircle className="size-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-signal-blue text-[10px] font-semibold text-paper">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </NavLink>
  )
}

export { ChatNavButton }
