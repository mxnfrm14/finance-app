export type MessageStatus = "streaming" | "complete" | "interrupted" | "failed"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  status: MessageStatus
  error?: string
}

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
  running: boolean
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessage[]
}

export interface ConversationPage {
  conversations: ConversationSummary[]
  nextCursor: string | null
}

export type ChatAction = { mode: "portfolio" | "instrument"; target?: string }

export type ChatEvent =
  | { type: "session"; conversation: Conversation }
  | { type: "text"; text: string }
  | { type: "tool_start"; toolName: string }
  | { type: "tool_result"; toolName: string }
  | { type: "done"; conversation: Conversation }
  | { type: "error"; error: string; conversation?: Conversation }

export function readMessages(serialized: string): ChatMessage[] {
  const data: unknown = JSON.parse(serialized)
  if (!Array.isArray(data)) throw new Error("Historique illisible.")
  return data.map((item, index) => {
    if (!item || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") {
      throw new Error("Historique illisible.")
    }
    return {
      id: typeof item.id === "string" ? item.id : `legacy-${index}`,
      role: item.role,
      content: item.content,
      status: ["streaming", "complete", "interrupted", "failed"].includes(item.status) ? item.status : "complete",
      ...(typeof item.error === "string" ? { error: item.error } : {}),
    }
  })
}

export function modelHistory(messages: ChatMessage[]) {
  return messages.filter((m) => m.status === "complete" && m.content.trim())
    .slice(-20).map(({ role, content }) => ({ role, content }))
}

// Handle arbitrary network chunk boundaries, including CRLF and the final frame.
export async function* readChatEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      if (done && buffer) { lines.push(buffer); buffer = "" }
      for (const line of lines) {
        if (line.startsWith("data:")) yield JSON.parse(line.slice(5).trim()) as ChatEvent
      }
      if (done) break
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
