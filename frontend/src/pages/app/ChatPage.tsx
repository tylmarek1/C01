import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CalendarDays, ImagePlus, MessagesSquare, SendHorizontal, SmilePlus, SquarePen, Trash2, UsersRound } from "lucide-react"
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PlayerSearch } from "@/components/shared/player-search"
import { SearchInput } from "@/components/shared/search-input"
import { UserAvatar } from "@/components/shared/user-avatar"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { onChatEvent } from "@/lib/chat-socket"
import { isSameDay, useFormatters } from "@/lib/format"
import { compressImageFile } from "@/lib/image"
import { useTranslation } from "@/lib/i18n"
import { useConversations } from "@/lib/queries"
import { cn } from "@/lib/utils"
import type { Conversation, Message } from "@/types"

const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🎉"]
const GROUP_WINDOW_MS = 5 * 60_000

// A message can reach the cache twice — the sender's own POST response and
// (for anyone else already subscribed, e.g. React StrictMode's dev-only
// double-effect-invocation briefly holding two listeners) a live WS frame —
// so appends are keyed by id rather than assumed unique.
function appendUnique(existing: Message[] | undefined, message: Message): Message[] {
  if (!existing) return [message]
  if (existing.some((m) => m.id === message.id)) return existing
  return [...existing, message]
}

function useConversationTitle() {
  const { t } = useTranslation()
  return (conversation: Conversation, selfId: string): string => {
    const others = conversation.participants.filter((p) => p.id !== selfId)
    if (others.length === 0) return t("chat.justYou")
    if (others.length <= 3) return others.map((p) => p.name).join(", ")
    return t("chat.groupTitle", { names: others.slice(0, 2).map((p) => p.name).join(", "), count: others.length - 2 })
  }
}

function ConversationAvatar({ conversation, selfId, size = "md" }: { conversation: Conversation; selfId: string; size?: "sm" | "md" }) {
  const others = conversation.participants.filter((p) => p.id !== selfId)
  if (conversation.kind === "DM" && others.length === 1) {
    return <UserAvatar name={others[0].name} avatarUrl={others[0].avatar_url} size={size === "md" ? "lg" : "md"} className={size === "md" ? "size-11" : undefined} />
  }
  const Icon = conversation.kind === "TEAM" ? UsersRound : CalendarDays
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-muted text-foreground", size === "md" ? "size-11" : "size-9")}>
      <Icon className="size-[18px]" />
    </span>
  )
}

function MessageBubble({
  message,
  isMine,
  showMeta,
  showAvatar,
  isGroupChat,
  onToggleReaction,
  onDelete,
}: {
  message: Message
  isMine: boolean
  showMeta: boolean
  showAvatar: boolean
  isGroupChat: boolean
  onToggleReaction: (emoji: string) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const fmt = useFormatters()
  const [pickerOpen, setPickerOpen] = useState(false)
  const isDeleted = Boolean(message.deleted_at)

  return (
    <div className={cn("group flex gap-2", isMine ? "flex-row-reverse" : "flex-row", showMeta ? "mt-3" : "mt-0.5")}>
      {!isMine && isGroupChat && (
        <div className="w-7 shrink-0 self-end">
          {showAvatar && <UserAvatar name={message.sender.name} avatarUrl={message.sender.avatar_url} size="xs" className="size-7" />}
        </div>
      )}
      <div className={cn("flex max-w-[78%] flex-col sm:max-w-[65%]", isMine ? "items-end" : "items-start")}>
        {showMeta && !isMine && isGroupChat && <span className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">{message.sender.name}</span>}
        <div className={cn("flex items-center gap-1", isMine && "flex-row-reverse")}>
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed break-words whitespace-pre-wrap",
              isDeleted
                ? "border border-dashed border-border-strong text-muted-foreground italic"
                : isMine
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md border border-border bg-card text-foreground shadow-xs",
            )}
          >
            {isDeleted ? (
              t("chat.messageDeleted")
            ) : (
              <div className="flex flex-col gap-1.5">
                {message.image_url && (
                  <a href={assetUrl(message.image_url)} target="_blank" rel="noreferrer" className="-mx-1.5 -mt-0.5">
                    <img src={assetUrl(message.image_url)} alt="" loading="lazy" className="max-h-72 rounded-xl object-cover" />
                  </a>
                )}
                {message.body && <span>{message.body}</span>}
              </div>
            )}
          </div>
          {!isDeleted && (
            <div className={cn("flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100", pickerOpen && "opacity-100")}>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button size="icon-xs" variant="subtle" aria-label={t("chat.react")}>
                    <SmilePlus />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align={isMine ? "end" : "start"} className="flex w-auto gap-0.5 rounded-full p-1">
                  {REACTION_EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onToggleReaction(emoji)
                        setPickerOpen(false)
                      }}
                      className="flex size-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-muted"
                    >
                      {emoji}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              {isMine && (
                <Button size="icon-xs" variant="subtle" onClick={onDelete} aria-label={t("chat.deleteMessage")} className="hover:text-danger">
                  <Trash2 />
                </Button>
              )}
            </div>
          )}
        </div>
        {!isDeleted && message.reactions.length > 0 && (
          <div className={cn("-mt-1.5 flex flex-wrap gap-1 px-1", isMine && "justify-end")}>
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() => onToggleReaction(reaction.emoji)}
                aria-pressed={reaction.reacted_by_me}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-1.5 py-px text-xs shadow-xs transition-colors",
                  reaction.reacted_by_me ? "border-foreground/40 bg-brand-soft" : "border-border bg-card hover:bg-muted",
                )}
              >
                <span>{reaction.emoji}</span>
                <span className="font-mono text-[10px] text-muted-foreground tabular">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
        {showMeta && <span className="mt-1 px-1 font-mono text-[10px] text-subtle-foreground">{fmt.time(message.created_at)}</span>}
      </div>
    </div>
  )
}

function Composer({ conversationId, disabled }: { conversationId: string; disabled?: boolean }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(160, el.scrollHeight)}px`
  }, [draft])

  const onSent = (message: Message) => {
    setDraft("")
    queryClient.setQueryData<Message[]>(["chat-messages", conversationId], (old) => appendUnique(old, message))
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }

  const sendMutation = useMutation({
    mutationFn: (body: string) => api.sendMessage(token!, conversationId, body),
    onSuccess: onSent,
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("chat.error.sendFailed")),
  })
  const sendImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const compressed = await compressImageFile(file, 1200, 0.85)
      return api.sendMessageImage(token!, conversationId, compressed, draft.trim() || undefined)
    },
    onSuccess: onSent,
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("chat.error.sendImageFailed")),
  })

  function submit(event?: FormEvent) {
    event?.preventDefault()
    const body = draft.trim()
    if (!body || sendMutation.isPending) return
    sendMutation.mutate(body)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) sendImageMutation.mutate(file)
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-border bg-card p-3">
      <Tooltip content={t("chat.attachImage")}>
        <Button type="button" variant="ghost" size="icon" isLoading={sendImageMutation.isPending} disabled={disabled} onClick={() => fileInputRef.current?.click()} aria-label={t("chat.attachImage")}>
          {!sendImageMutation.isPending && <ImagePlus />}
        </Button>
      </Tooltip>
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
      <textarea
        ref={textareaRef}
        rows={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder={t("chat.composerPlaceholder")}
        maxLength={1000}
        disabled={disabled}
        aria-label={t("chat.composerPlaceholder")}
        autoFocus
        className="max-h-40 min-h-9 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-[14px] leading-snug outline-none transition-[border-color,box-shadow] placeholder:text-subtle-foreground focus-visible:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/15"
      />
      <Button type="submit" size="icon" variant={draft.trim() ? "brand" : "secondary"} disabled={draft.trim().length === 0} isLoading={sendMutation.isPending} aria-label={t("chat.send")}>
        {!sendMutation.isPending && <SendHorizontal />}
      </Button>
    </form>
  )
}

function ChatPage() {
  const { token, user } = useAuth()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const conversationTitle = useConversationTitle()
  const [searchParams, setSearchParams] = useSearchParams()
  const [newMessageOpen, setNewMessageOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const selectedId = searchParams.get("conversation")
  const { data: conversations, isLoading: isLoadingConversations } = useConversations()
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
        queryClient.setQueryData<Message[]>(["chat-messages", frame.conversation_id], (old) => (old ? appendUnique(old, frame.message) : old))
        queryClient.invalidateQueries({ queryKey: ["conversations"] })
      } else if (frame.type === "message_deleted") {
        queryClient.setQueryData<Message[]>(["chat-messages", frame.conversation_id], (old) =>
          old?.map((m) => (m.id === frame.message_id ? { ...m, body: "", image_url: null, deleted_at: new Date().toISOString() } : m)),
        )
      } else if (frame.type === "reaction") {
        // A delta-applied count isn't safe against a duplicate delivery of
        // the same frame — refetching the true state is idempotent.
        queryClient.invalidateQueries({ queryKey: ["chat-messages", frame.conversation_id] })
      }
    })
  }, [queryClient])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: messages && messages.length > 0 ? "smooth" : "auto" })
  }, [messages, selectedId])

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
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) => api.toggleMessageReaction(token!, selectedId!, messageId, emoji),
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(["chat-messages", selectedId], (old) => old?.map((m) => (m.id === message.id ? message : m)))
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

  const visibleConversations = useMemo(() => {
    if (!user) return []
    const q = filter.trim().toLowerCase()
    return (conversations ?? [])
      .filter((c) => (q ? conversationTitle(c, user.id).toLowerCase().includes(q) : true))
      .sort(
        (a, b) =>
          new Date(b.last_message?.created_at ?? b.created_at).getTime() - new Date(a.last_message?.created_at ?? a.created_at).getTime(),
      )
    // conversationTitle is stable per language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, filter, user])

  if (!user) return null

  function preview(conversation: Conversation): string {
    const last = conversation.last_message
    if (!last) return t("chat.noMessagesYet")
    if (last.deleted_at) return t("chat.messageDeleted")
    const prefix = last.sender.id === user!.id ? `${t("chat.you")}: ` : conversation.kind !== "DM" ? `${last.sender.name.split(" ")[0]}: ` : ""
    return prefix + (last.image_url && !last.body ? t("chat.photoMessage") : last.body)
  }

  const kindLabel = (conversation: Conversation) =>
    conversation.kind === "DM"
      ? t("chat.kind.dm")
      : conversation.kind === "TEAM"
        ? t("chat.kind.team", { count: conversation.participants.length })
        : t("chat.kind.reservation", { count: conversation.participants.length })
  const otherInDm = selected?.kind === "DM" ? selected.participants.find((p) => p.id !== user.id) : undefined

  return (
    <div className="flex h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] min-h-0 lg:h-[calc(100dvh-6rem)]">
      {/* Conversation list */}
      <aside className={cn("flex w-full min-w-0 flex-col border-r border-border bg-background md:w-80 md:shrink-0", selectedId && "hidden md:flex")}>
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h1 className="display text-[30px]">{t("chat.title")}</h1>
            <Tooltip content={t("chat.newMessage")}>
              <Button variant="outline" size="icon-sm" aria-label={t("chat.newMessage")} onClick={() => setNewMessageOpen(true)}>
                <SquarePen />
              </Button>
            </Tooltip>
          </div>
          <SearchInput value={filter} onValueChange={setFilter} placeholder={t("chat.searchPlaceholder")} inputClassName="h-8" />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingConversations &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          {!isLoadingConversations && conversations?.length === 0 && (
            <EmptyState
              size="compact"
              className="m-2"
              icon={MessagesSquare}
              title={t("chat.empty.title")}
              description={t("chat.empty.description")}
              action={
                <Button size="sm" onClick={() => setNewMessageOpen(true)}>
                  <SquarePen /> {t("chat.newMessage")}
                </Button>
              }
            />
          )}
          {visibleConversations.map((conversation) => {
            const unread = conversation.unread_count > 0
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSearchParams({ conversation: conversation.id })}
                aria-current={conversation.id === selectedId ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  conversation.id === selectedId ? "bg-card shadow-xs ring-1 ring-border" : "hover:bg-muted",
                )}
              >
                <ConversationAvatar conversation={conversation} selfId={user.id} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-[13px]", unread ? "font-semibold" : "font-medium")}>{conversationTitle(conversation, user.id)}</span>
                    {conversation.last_message && (
                      <span className={cn("shrink-0 font-mono text-[10.5px]", unread ? "text-foreground" : "text-subtle-foreground")}>
                        {isSameDay(new Date(conversation.last_message.created_at), new Date())
                          ? fmt.time(conversation.last_message.created_at)
                          : fmt.dayMonth(conversation.last_message.created_at)}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>{preview(conversation)}</span>
                    {unread && (
                      <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-semibold text-brand-foreground tabular">
                        {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                      </span>
                    )}
                  </span>
                </div>
              </button>
            )
          })}
          {filter && visibleConversations.length === 0 && conversations && conversations.length > 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">{t("chat.noMatches")}</p>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={cn("flex min-w-0 flex-1 flex-col bg-muted/30", !selectedId && "hidden md:flex")}>
        {!selected && (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              className="max-w-sm border-0 bg-transparent"
              icon={MessagesSquare}
              title={selectedId && !isLoadingConversations ? t("chat.notFound") : t("chat.selectPrompt")}
              description={t("chat.selectHint")}
              action={
                <Button size="sm" variant="outline" onClick={() => setNewMessageOpen(true)}>
                  <SquarePen /> {t("chat.newMessage")}
                </Button>
              }
            />
          </div>
        )}
        {selected && (
          <>
            <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:px-4">
              <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setSearchParams({})} aria-label={t("chat.back")}>
                <ArrowLeft />
              </Button>
              <ConversationAvatar conversation={selected} selfId={user.id} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold">{conversationTitle(selected, user.id)}</span>
                <span className="truncate text-xs text-muted-foreground">{kindLabel(selected)}</span>
              </div>
              {otherInDm && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/app/players/${otherInDm.id}`}>{t("chat.viewProfile")}</Link>
                </Button>
              )}
              {selected.kind !== "DM" && (
                <div className="hidden -space-x-2 sm:flex">
                  {selected.participants.slice(0, 4).map((p) => (
                    <UserAvatar key={p.id} name={p.name} avatarUrl={p.avatar_url} size="xs" className="ring-2 ring-card" />
                  ))}
                </div>
              )}
            </header>

            <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-6" aria-live="polite">
              <div className="mt-auto" />
              {isLoadingMessages && (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-10 w-1/2" />
                  <Skeleton className="ml-auto h-10 w-1/3" />
                  <Skeleton className="h-16 w-2/5" />
                </div>
              )}
              {!isLoadingMessages && messages?.length === 0 && (
                <div className="m-auto flex flex-col items-center gap-2 text-center">
                  <ConversationAvatar conversation={selected} selfId={user.id} />
                  <p className="text-[13px] font-medium">{conversationTitle(selected, user.id)}</p>
                  <p className="text-xs text-muted-foreground">{t("chat.startHint")}</p>
                </div>
              )}
              {messages?.map((message, index) => {
                const previous = messages[index - 1]
                const next = messages[index + 1]
                const date = new Date(message.created_at)
                const newDay = !previous || !isSameDay(new Date(previous.created_at), date)
                const startsGroup =
                  newDay || !previous || previous.sender.id !== message.sender.id || date.getTime() - new Date(previous.created_at).getTime() > GROUP_WINDOW_MS
                const endsGroup =
                  !next || next.sender.id !== message.sender.id || new Date(next.created_at).getTime() - date.getTime() > GROUP_WINDOW_MS ||
                  !isSameDay(new Date(next.created_at), date)
                return (
                  <Fragment key={message.id}>
                    {newDay && (
                      <div className="my-4 flex items-center gap-3">
                        <span className="h-px flex-1 bg-border" />
                        <span className="eyebrow text-[10px]">{fmt.dayLabel(date)}</span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <MessageBubble
                      message={message}
                      isMine={message.sender.id === user.id}
                      showMeta={startsGroup}
                      showAvatar={endsGroup}
                      isGroupChat={selected.kind !== "DM"}
                      onToggleReaction={(emoji) => reactionMutation.mutate({ messageId: message.id, emoji })}
                      onDelete={() => setDeleteTarget(message.id)}
                    />
                  </Fragment>
                )
              })}
            </div>

            <Composer key={selected.id} conversationId={selected.id} />
          </>
        )}
      </section>

      <Dialog open={newMessageOpen} onOpenChange={setNewMessageOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("chat.newMessage")}</DialogTitle>
            <DialogDescription>{t("chat.newMessageDescription")}</DialogDescription>
          </DialogHeader>
          <PlayerSearch autoFocus placeholder={t("playerSearch.placeholder")} excludeIds={[user.id]} onSelect={(player) => startDmMutation.mutate(player.id)} />
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
