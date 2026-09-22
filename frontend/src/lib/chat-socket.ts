import { API_URL } from "@/lib/api"
import type { Message } from "@/types"

interface MessageFrame {
  type: "message"
  conversation_id: string
  message: Message
}

interface MessageDeletedFrame {
  type: "message_deleted"
  conversation_id: string
  message_id: string
}

interface ReactionFrame {
  type: "reaction"
  conversation_id: string
  message_id: string
  emoji: string
  user_id: string
  action: "added" | "removed"
}

export type ChatFrame = MessageFrame | MessageDeletedFrame | ReactionFrame

type Listener = (frame: ChatFrame) => void

const listeners = new Set<Listener>()

let socket: WebSocket | null = null
let currentToken: string | null = null
let reconnectDelayMs = 1000
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function wsUrl(): string {
  return `${API_URL.replace(/^http/, "ws")}/ws/chat`
}

function open(token: string) {
  const ws = new WebSocket(wsUrl())
  socket = ws

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "auth", token }))
    reconnectDelayMs = 1000
  }

  ws.onmessage = (event) => {
    try {
      const frame = JSON.parse(event.data) as ChatFrame
      if (frame.type === "message" || frame.type === "message_deleted" || frame.type === "reaction") {
        listeners.forEach((listener) => listener(frame))
      }
    } catch {
      // Ignore a malformed frame rather than crash the socket handler.
    }
  }

  ws.onclose = () => {
    socket = null
    if (!currentToken) return
    reconnectTimer = setTimeout(() => open(currentToken!), reconnectDelayMs)
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15_000)
  }
}

/** Connects (or reuses) the single per-tab chat socket for this session.
 * Call once the user is authenticated; safe to call repeatedly. */
export function connectChatSocket(token: string): void {
  if (socket && currentToken === token) return
  currentToken = token
  if (reconnectTimer) clearTimeout(reconnectTimer)
  open(token)
}

export function disconnectChatSocket(): void {
  currentToken = null
  if (reconnectTimer) clearTimeout(reconnectTimer)
  socket?.close()
  socket = null
}

/** Subscribe to live chat events (new message, delete, reaction). Returns
 * an unsubscribe function. */
export function onChatEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
