import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Paperclip, Send, SmilePlus, SquarePen, Trash2, Users } from "lucide-react"
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/avatar"
import { Button } from "@/components/shared/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shared/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Input } from "@/components/shared/input"
import { PlayerSearch } from "@/components/shared/player-search"
import { Skeleton } from "@/components/shared/skeleton"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { onChatEvent } from "@/lib/chat-socket"
import { compressImageFile } from "@/lib/image"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Conversation, Message } from "@/types"

const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🎉"]

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

function MessageBubble({
  message,
  isMine,
  pickerOpen,
  onTogglePicker,
  onToggleReaction,
  onDelete,
}: {
  message: Message
  isMine: boolean
  pickerOpen: boolean
  onTogglePicker: () => void
  onToggleReaction: (emoji: string) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const isDeleted = Boolean(message.deleted_at)

  return (
    <div className={cn("group flex flex-col", isMine ? "items-end" : "items-start")}>
      <div className={cn("flex items-end gap-1.5", isMine && "flex-row-reverse")}>
        <div
          className={cn(
            "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
            isDeleted
              ? "border border-dashed border-hairline text-slate-gray italic"
              : isMine
                ? "bg-signal-blue text-paper"
                : "bg-pebble text-ink-navy",
          )}
        >
          {isDeleted ? (
            t("chat.messageDeleted")
          ) : (
            <div className="flex flex-col gap-1.5">
              {message.image_url && (
                <img
                  src={assetUrl(message.image_url)}
                  alt=""
                  loading="lazy"
                  className="max-h-64 rounded-xl object-cover"
                />
              )}
              {message.body && <span>{message.body}</span>}
            </div>
          )}
        </div>
        {!isDeleted && (
          <div
            className={cn(
              "relative flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100",
              pickerOpen && "opacity-100",
            )}
          >
            <button
              type="button"
              onClick={onTogglePicker}
              className="flex size-6 items-center justify-center rounded-full text-mist-gray hover:bg-pebble hover:text-slate-gray"
              aria-label={t("chat.react")}
            >
              <SmilePlus className="size-3.5" />
            </button>
            {isMine && (
              <button
                type="button"
                onClick={onDelete}
                className="flex size-6 items-center justify-center rounded-full text-mist-gray hover:bg-pebble hover:text-destructive"
                aria-label={t("chat.deleteMessage")}
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
            {pickerOpen && (
              <div
                className={cn(
                  "absolute bottom-7 z-10 flex gap-1 rounded-full border border-hairline bg-card p-1 shadow-lg",
                  isMine ? "right-0" : "left-0",
                )}
              >
                {REACTION_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggleReaction(emoji)}
                    className="flex size-7 items-center justify-center rounded-full text-base hover:bg-pebble"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!isDeleted && message.reactions.length > 0 && (
        <div className={cn("mt-1 flex flex-wrap gap-1", isMine && "justify-end")}>
          {message.reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              onClick={() => onToggleReaction(reaction.emoji)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs",
                reaction.reacted_by_me ? "border-signal-blue bg-highlight-blue" : "border-hairline bg-card",
              )}
            >
              <span>{reaction.emoji}</span>
              <span className="text-[10px] text-slate-gray">{reaction.count}</span>
            </button>
          ))}
        </div>
      )}

      <span className="mt-0.5 px-1 text-[10px] text-mist-gray">
        {!isMine && `${message.sender.name} · `}
        {timeOf(message.created_at)}
      </span>
    </div>
  )
}

function ChatPage() {
  const { token, user } = useAuth()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState("")
  const [newMessageOpen, setNewMessageOpen] = useState(false)
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    return onChatEvent((frame) => {
      if (frame.type === "message") {
        queryClient.setQueryData<Message[]>(["chat-messages", frame.conversation_id], (old) =>
          old ? appendUnique(old, frame.message) : old,
        )
        queryClient.invalidateQueries({ queryKey: ["conversations"] })
      } else if (frame.type === "message_deleted") {
        queryClient.setQueryData<Message[]>(["chat-messages", frame.conversation_id], (old) =>
          old?.map((m) => (m.id === frame.message_id ? { ...m, body: "", image_url: null, deleted_at: new Date().toISOString() } : m)),
        )
      } else if (frame.type === "reaction") {
        // A delta-applied count (+1/-1 per event) isn't safe against a
        // duplicate delivery of the same frame — nothing in this event
        // carries enough identity to dedupe against, unlike appendUnique's
        // per-message id above. Refetching this one message's true state
        // is idempotent no matter how many times the same frame arrives.
        queryClient.invalidateQueries({ queryKey: ["chat-messages", frame.conversation_id] })
      }
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

  const sendImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const compressed = await compressImageFile(file, 1200, 0.85)
      return api.sendMessageImage(token!, selectedId!, compressed, draft.trim() || undefined)
    },
    onSuccess: (message) => {
      setDraft("")
      queryClient.setQueryData<Message[]>(["chat-messages", selectedId], (old) => appendUnique(old, message))
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("chat.error.sendImageFailed")),
  })

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => api.deleteMessage(token!, selectedId!, messageId),
    onSuccess: (_void, messageId) => {
      setDeleteTarget(null)
      queryClient.setQueryData<Message[]>(["chat-messages", selectedId], (old) =>
        old?.map((m) => (m.id === messageId ? { ...m, body: "", image_url: null, deleted_at: new Date().toISOString() } : m)),
      )
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("chat.error.deleteFailed")),
  })

  const reactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.toggleMessageReaction(token!, selectedId!, messageId, emoji),
    onSuccess: (message) => {
      setReactionPickerFor(null)
      queryClient.setQueryData<Message[]>(["chat-messages", selectedId], (old) =>
        old?.map((m) => (m.id === message.id ? message : m)),
      )
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("chat.error.reactFailed")),
  })

  const startDmMutation = useMutation({
    mutationFn: (userId: string) => api.openDirectMessage(token!, userId),
    onSuccess: (conversation) => {
      setNewMessageOpen(false)
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
      setSearchParams({ conversation: conversation.id })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("chat.error.startFailed")),
  })

  function handleSend(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body) return
    sendMutation.mutate(body)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    sendImageMutation.mutate(file)
  }

  if (!user) return null

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className={cn("flex w-full flex-col gap-2 overflow-y-auto sm:w-80 sm:shrink-0", selectedId && "hidden sm:flex")}>
        <div className="flex items-center justify-between px-1">
          <h1 className="text-lg font-bold text-ink-navy">{t("chat.title")}</h1>
          <Button variant="ghost" size="icon" aria-label={t("chat.newMessage")} onClick={() => setNewMessageOpen(true)}>
            <SquarePen className="size-4" />
          </Button>
        </div>
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
              conversation.id === selectedId ? "border-signal-blue bg-highlight-blue" : "border-hairline bg-card hover:bg-pebble",
            )}
          >
            <ConversationAvatar conversation={conversation} selfId={user.id} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-ink-navy">{conversationTitle(conversation, user.id)}</span>
              <span className="truncate text-xs text-slate-gray">
                {conversation.last_message
                  ? conversation.last_message.deleted_at
                    ? t("chat.messageDeleted")
                    : conversation.last_message.image_url && !conversation.last_message.body
                      ? t("chat.photoMessage")
                      : conversation.last_message.body
                  : t("chat.noMessagesYet")}
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

            <div ref={scrollRef} className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto p-4">
              {isLoadingMessages && <Skeleton className="h-10 w-2/3" />}
              {!isLoadingMessages && messages?.length === 0 && (
                <p className="m-auto text-sm text-slate-gray">{t("chat.noMessagesYet")}</p>
              )}
              {messages?.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isMine={message.sender.id === user.id}
                  pickerOpen={reactionPickerFor === message.id}
                  onTogglePicker={() => setReactionPickerFor((current) => (current === message.id ? null : message.id))}
                  onToggleReaction={(emoji) => reactionMutation.mutate({ messageId: message.id, emoji })}
                  onDelete={() => setDeleteTarget(message.id)}
                />
              ))}
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-hairline p-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={sendImageMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
                aria-label={t("chat.attachImage")}
              >
                <Paperclip className="size-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
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

      <Dialog open={newMessageOpen} onOpenChange={setNewMessageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chat.newMessage")}</DialogTitle>
          </DialogHeader>
          <PlayerSearch
            autoFocus
            placeholder={t("playerSearch.placeholder")}
            onSelect={(player) => startDmMutation.mutate(player.id)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("confirmDialog.deleteMessage.title")}
        description={t("confirmDialog.deleteMessage.description")}
        confirmLabel={t("chat.deleteMessage")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </div>
  )
}

export { ChatPage }
