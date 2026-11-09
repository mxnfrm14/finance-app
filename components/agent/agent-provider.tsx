"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { readChatEvents, type ChatAction, type Conversation, type ConversationPage, type ConversationSummary } from "@/lib/ai/conversations"

export interface LiveConversation {
  conversation: Conversation
  pending: boolean
  currentTool?: string
  error?: string
  retryMessage?: string
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === "string" ? body.error : "La requête a échoué. Réessayez."
}

function mergeSummaries(previous: ConversationSummary[], incoming: ConversationSummary[]) {
  const merged = new Map(previous.map((item) => [item.id, item]))
  incoming.forEach((item) => merged.set(item.id, item))
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
}

interface AgentContextValue {
  entries: Record<string, LiveConversation>
  summaries: ConversationSummary[]
  nextCursor: string | null
  historyError: string | null
  refresh: (cursor?: string) => Promise<void>
  load: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  start: (message: string, sessionId?: string, action?: ChatAction) => string
}

const AgentContext = createContext<AgentContextValue | null>(null)

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<Record<string, LiveConversation>>({})
  const entriesRef = useRef(entries)
  const controllers = useRef(new Map<string, AbortController>())
  const [summaries, setSummaries] = useState<ConversationSummary[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const alive = useRef(true)
  const listVersion = useRef(0)
  const loadedMore = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      controllers.current.forEach((controller) => controller.abort())
    }
  }, [])

  const put = useCallback((key: string, entry: LiveConversation) => {
    if (!alive.current) return
    entriesRef.current = { ...entriesRef.current, [key]: entry }
    setEntries(entriesRef.current)
    if (!entry.conversation.id.startsWith("draft:")) {
      const { id, title, updatedAt, running } = entry.conversation
      setSummaries((previous) => mergeSummaries(previous, [{ id, title, updatedAt, running }]))
    }
  }, [])

  const refresh = useCallback(async (cursor?: string) => {
    const version = ++listVersion.current
    try {
      const response = await fetch(`/api/agent/sessions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" })
      if (!response.ok) throw new Error(await responseError(response))
      const page: ConversationPage = await response.json()
      if (!alive.current || version !== listVersion.current) return
      setSummaries((previous) => mergeSummaries(previous, page.conversations))
      if (cursor) loadedMore.current = true
      if (cursor || !loadedMore.current) setNextCursor(page.nextCursor)
      setHistoryError(null)
    } catch (error) {
      if (alive.current && version === listVersion.current) setHistoryError(error instanceof Error ? error.message : "Historique indisponible.")
    }
  }, [])

  const load = useCallback(async (id: string) => {
    const current = Object.entries(entriesRef.current).find(([, entry]) => entry.conversation.id === id)
    if (current?.[1].pending) return
    const response = await fetch(`/api/agent/sessions/${encodeURIComponent(id)}`, { cache: "no-store" })
    if (!response.ok) throw new Error(await responseError(response))
    const conversation: Conversation = await response.json()
    const latest = Object.entries(entriesRef.current).find(([, entry]) => entry.conversation.id === id)
    if (!latest?.[1].pending) put(latest?.[0] ?? id, { conversation, pending: false })
  }, [put])

  const remove = useCallback(async (id: string) => {
    const response = await fetch(`/api/agent/sessions/${encodeURIComponent(id)}`, { method: "DELETE" })
    if (!response.ok) throw new Error(await responseError(response))
    listVersion.current++
    setSummaries((previous) => previous.filter((item) => item.id !== id))
    entriesRef.current = Object.fromEntries(Object.entries(entriesRef.current).filter(([, entry]) => entry.conversation.id !== id))
    setEntries(entriesRef.current)
  }, [])

  const start = useCallback((message: string, sessionId?: string, action?: ChatAction) => {
    const existing = sessionId ? Object.entries(entriesRef.current).find(([, entry]) => entry.conversation.id === sessionId) : undefined
    if (existing?.[1].pending || existing?.[1].conversation.running) return existing[0]
    const key = existing?.[0] ?? `draft:${crypto.randomUUID()}`
    const prior = existing?.[1].conversation
    const conversation: Conversation = {
      id: sessionId ?? key, title: prior?.title ?? message.slice(0, 80), updatedAt: new Date().toISOString(), running: true,
      messages: [...(prior?.messages ?? []),
        { id: crypto.randomUUID(), role: "user", content: message, status: "complete" },
        { id: crypto.randomUUID(), role: "assistant", content: "", status: "streaming" }],
    }
    put(key, { conversation, pending: true })
    const controller = new AbortController()
    controllers.current.set(key, controller)

    void (async () => {
      let terminal = false
      let acknowledged = false
      try {
        const response = await fetch("/api/agent/analyze", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ message, sessionId, mode: action?.mode ?? "chat", target: action?.target }),
        })
        if (!response.ok) throw new Error(await responseError(response))
        if (!response.body) throw new Error("Réponse vide du serveur.")
        for await (const event of readChatEvents(response.body)) {
          const current = entriesRef.current[key]
          if (!current) break
          if (event.type === "session") {
            acknowledged = true
            put(key, { conversation: event.conversation, pending: true })
          } else if (event.type === "text") {
            const messages = current.conversation.messages.map((m, index, all) => index === all.length - 1 ? { ...m, content: m.content + event.text } : m)
            put(key, { ...current, currentTool: undefined, conversation: { ...current.conversation, messages } })
          } else if (event.type === "tool_start" || event.type === "tool_result") {
            put(key, { ...current, currentTool: event.type === "tool_start" ? event.toolName : undefined })
          } else if (event.type === "done") {
            terminal = true
            put(key, { conversation: event.conversation, pending: false })
          } else if (event.type === "error") {
            terminal = true
            if (event.conversation) put(key, { conversation: event.conversation, pending: false, error: event.error })
            else throw new Error(event.error)
          }
        }
        if (!terminal) throw new Error("La connexion a été interrompue. Rouvrez la conversation pour retrouver la dernière sauvegarde.")
      } catch (error) {
        if (!alive.current) return
        const current = entriesRef.current[key]
        if (current) put(key, {
          ...current, pending: false, currentTool: undefined,
          error: error instanceof Error ? error.message : "La réponse a échoué.",
          retryMessage: acknowledged ? undefined : message,
          conversation: {
            ...current.conversation, running: false,
            messages: acknowledged ? current.conversation.messages.map((m) => m.status === "streaming" ? { ...m, status: "interrupted" } : m)
              : prior?.messages ?? [],
          },
        })
      } finally {
        controllers.current.delete(key)
        if (alive.current) void refresh()
      }
    })()
    return key
  }, [put, refresh])

  return <AgentContext.Provider value={{ entries, summaries, nextCursor, historyError, refresh, load, remove, start }}>{children}</AgentContext.Provider>
}

export function useAgent() {
  const value = useContext(AgentContext)
  if (!value) throw new Error("AgentProvider manquant")
  return value
}
