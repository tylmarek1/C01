import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Send, Users } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/avatar"
import { Button } from "@/components/shared/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Input } from "@/components/shared/input"
import { Skeleton } from "@/components/shared/skeleton"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { onChatMessage } from "@/lib/chat-socket"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Conversation, Message } from "@/types"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// A message can reach the cache twice — the sender's own POST response and
// (for anyone else already subscribed, e.g. React StrictMode's dev-only
// double-effect-invocation briefly holding two listeners) a live WS frame —
// so appends are keyed by id rather than assumed unique.
function appendUnique(existing: Message[] | undefined, message: Message): Message[] {
  if (!existing) return [message]
  if (existing.some((m) => m.id === message.id)) return existing
  return [...existing, message]
}

function conversationTitle(conversation: Conversation, selfId: string): string {
  const others = conversation.participants.filter((p) => p.id !== selfId)
  return others.map((p) => p.name).join(", ") || conversation.kind
}

function ConversationAvatar({ conversation, selfId }: { conversation: Conversation; selfId: string }) {
  const others = conversation.participants.filter((p) => p.id !== selfId)
  if (conversation.kind === "DM" && others.length === 1) {
    const other = others[0]
    return (
      <Avatar className="size-11 shrink-0">
        <AvatarImage src={assetUrl(other.avatar_url)} alt={other.name} loading="lazy" className="object-cover" />
        <AvatarFallback>{initials(other.name)}</AvatarFallback>
      </Avatar>
    )
  }
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pebble text-ink-navy">
      <Users className="size-5" />
    </span>
  )
}

function ChatPage() {
  const { token, user } = useAuth()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const selectedId = searchParams.get("conversation")

  const { data: conversations, isLoading: isLoadingConversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.listConversations(token!),
    enabled: Boolean(token),
    refetchInterval: 20_000,
  })

  const selected = conversations?.find((c) => c.id === selectedId) ?? null

  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["chat-messages", selectedId],
    queryFn: async () => {
      const result = await api.listMessages(token!, selectedId!)
      // The GET above already marked the conversation read server-side —
      // refresh the sidebar so its unread badge clears too.
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
      return result
    },
    enabled: Boolean(token && selectedId),
  })

  useEffect(() => {
    return onChatMessage((frame) => {
      queryClient.setQueryData<Message[]>(["chat-messages", frame.conversation_id], (old) =>
        old ? appendUnique(old, frame.message) : old,
      )
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    })
  }, [queryClient])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const sendMutation = useMutation({
    mutationFn: (body: string) => api.sendMessage(token!, selectedId!, body),
    onSuccess: (message) => {
      setDraft("")
      queryClient.setQueryData<Message[]>(["chat-messages", selectedId], (old) => appendUnique(old, message))
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("chat.error.sendFailed")),
  })

  function handleSend(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body) return
    sendMutation.mutate(body)
  }

  if (!user) return null

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className={cn("flex w-full flex-col gap-2 overflow-y-auto sm:w-80 sm:shrink-0", selectedId && "hidden sm:flex")}>
        <h1 className="px-1 text-lg font-bold text-ink-navy">{t("chat.title")}</h1>
        {isLoadingConversations && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        {!isLoadingConversations && conversations?.length === 0 && (
          <EmptyState title={t("chat.empty.title")} description={t("chat.empty.description")} />
        )}
        {conversations?.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => setSearchParams({ conversation: conversation.id })}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
              conversation.id === selectedId ? "border-signal-blue bg-[#eaf3ff]" : "border-hairline bg-card hover:bg-pebble",
            )}
          >
            <ConversationAvatar conversation={conversation} selfId={user.id} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-ink-navy">{conversationTitle(conversation, user.id)}</span>
              <span className="truncate text-xs text-slate-gray">
                {conversation.last_message ? conversation.last_message.body : t("chat.noMessagesYet")}
              </span>
            </div>
            {conversation.unread_count > 0 && (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-signal-blue text-[10px] font-semibold text-paper">
                {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col rounded-2xl border border-hairline bg-card", !selectedId && "hidden sm:flex")}>
        {!selected && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-gray">{t("chat.selectPrompt")}</p>
          </div>
        )}
        {selected && (
          <>
            <div className="flex items-center gap-3 border-b border-hairline p-3">
              <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setSearchParams({})}>
                <ArrowLeft className="size-4" />
              </Button>
              <ConversationAvatar conversation={selected} selfId={user.id} />
              <span className="font-medium text-ink-navy">{conversationTitle(selected, user.id)}</span>
            </div>

            <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {isLoadingMessages && <Skeleton className="h-10 w-2/3" />}
              {!isLoadingMessages && messages?.length === 0 && (
                <p className="m-auto text-sm text-slate-gray">{t("chat.noMessagesYet")}</p>
              )}
              {messages?.map((message) => {
                const isMine = message.sender.id === user.id
                return (
                  <div key={message.id} className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                        isMine ? "bg-signal-blue text-paper" : "bg-pebble text-ink-navy",
                      )}
                    >
                      {message.body}
                    </div>
                    <span className="mt-0.5 px-1 text-[10px] text-mist-gray">
                      {!isMine && `${message.sender.name} · `}
                      {timeOf(message.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-hairline p-3">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("chat.composerPlaceholder")}
                maxLength={1000}
              />
              <Button type="submit" size="icon" disabled={sendMutation.isPending || draft.trim().length === 0}>
                <Send className="size-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export { ChatPage }
