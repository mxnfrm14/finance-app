"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bot, TrendingUp, BarChart3, Send, Loader2, Zap, AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentMode = "portfolio" | "instrument" | "market"

type Message = {
  role: "user" | "assistant"
  content: string
  isError?: boolean
}

type SSEEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; toolName: string; input: unknown }
  | { type: "tool_result"; toolName: string; result: unknown }
  | { type: "done" }
  | { type: "error"; error: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_stock_price: "cours de l'action",
  get_fundamentals: "données fondamentales",
  get_historical_prices: "historique des cours",
  search_news: "actualités",
  get_portfolio_context: "portfolio",
  search_instrument: "instrument",
  get_etf_holdings: "composition ETF",
}

const MODE_CONFIG: Record<
  AgentMode,
  { icon: React.ElementType; label: string; description: string }
> = {
  portfolio: {
    icon: Bot,
    label: "Portfolio",
    description: "Analyser mon portfolio",
  },
  instrument: {
    icon: TrendingUp,
    label: "Instrument",
    description: "Analyser un instrument",
  },
  market: {
    icon: BarChart3,
    label: "Marché",
    description: "Vue du marché",
  },
}

const QUICK_PROMPTS: Record<AgentMode, { text: string; prompt: string }[]> = {
  portfolio: [
    { text: "Analyse mon portfolio", prompt: "Analyse mon portfolio et donne-moi tes recommandations." },
    { text: "Risques actuels", prompt: "Quels sont les principaux risques dans mon portfolio en ce moment ?" },
    { text: "Rééquilibrage", prompt: "Mon portfolio est-il bien équilibré ? Que changerais-tu ?" },
  ],
  instrument: [
    { text: "Analyse LVMH (MC.PA)", prompt: "Analyse LVMH (MC.PA) : cours, fondamentaux et perspectives." },
    { text: "Analyse MSCI World", prompt: "Donne-moi une analyse de l'ETF MSCI World (CW8)." },
    { text: "Analyse TotalEnergies", prompt: "Analyse TotalEnergies (TTE.PA) avec les dernières actualités." },
  ],
  market: [
    { text: "Quels ETF monde recommandes-tu ?", prompt: "Quels ETF monde recommandes-tu pour un investisseur long terme PEA ?" },
    { text: "Contexte macro actuel", prompt: "Quel est le contexte macro actuel et comment positionner son portfolio ?" },
    { text: "Secteurs porteurs", prompt: "Quels secteurs sont les plus porteurs en ce moment ?" },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const THINKING_MESSAGES = [
  "Réflexion en cours",
  "Analyse des données",
  "Consultation des sources",
  "Traitement de la requête",
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThinkingPill({ currentTool }: { currentTool: string | null }) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [dots, setDots] = useState(".")

  useEffect(() => {
    const msgTimer = setInterval(() => setMsgIdx((i) => (i + 1) % THINKING_MESSAGES.length), 2000)
    const dotTimer = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 450)
    return () => { clearInterval(msgTimer); clearInterval(dotTimer) }
  }, [])

  const label = currentTool
    ? `Récupération ${TOOL_DISPLAY_NAMES[currentTool] ?? currentTool.replace(/_/g, " ")}`
    : THINKING_MESSAGES[msgIdx]

  return (
    <div className="flex items-start gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
        <Bot className="size-3.5 text-primary" />
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin shrink-0" />
        <span className="tabular-nums">{label}<span className="opacity-60">{dots}</span></span>
      </div>
    </div>
  )
}

// ─── Error parsing ────────────────────────────────────────────────────────────

interface ErrorInfo {
  title: string
  description: string
  action?: { label: string; href: string }
}

function parseErrorInfo(raw: string): ErrorInfo {
  if (raw === "AUTH_ERROR" || raw.includes("authentication_error") || raw.includes("invalid x-api-key") || raw.includes("401")) {
    return {
      title: "Clé API invalide",
      description: "La clé API configurée est invalide ou expirée. Vérifiez qu'elle est correcte et qu'elle dispose des droits nécessaires.",
      action: { label: "Configurer dans Paramètres →", href: "/settings" },
    }
  }
  if (raw === "RATE_LIMIT" || raw.includes("rate_limit") || raw.includes("429")) {
    return {
      title: "Limite de requêtes atteinte",
      description: "Trop de requêtes envoyées au service IA. Attendez quelques secondes puis réessayez.",
    }
  }
  if (raw.includes("Aucun provider IA disponible") || raw.includes("provider")) {
    return {
      title: "Aucun provider IA configuré",
      description: "Aucune clé API n'est configurée. Ajoutez votre clé Anthropic, OpenAI ou configurez une instance Ollama.",
      action: { label: "Configurer dans Paramètres →", href: "/settings" },
    }
  }
  if (raw.includes("Max iterations")) {
    return {
      title: "Limite d'analyse atteinte",
      description: "L'agent a effectué trop d'étapes sans aboutir. Reformulez votre question de façon plus précise.",
    }
  }
  if (raw.includes("ECONNREFUSED") || raw.includes("fetch failed") || raw.includes("network")) {
    return {
      title: "Impossible de contacter le service IA",
      description: "Vérifiez votre connexion internet. Si vous utilisez Ollama, assurez-vous que l'instance est démarrée.",
    }
  }
  return {
    title: "Erreur inattendue",
    description: "Une erreur est survenue lors de l'analyse. Réessayez ou contactez l'administrateur si le problème persiste.",
  }
}

function ErrorMessage({ content }: { content: string }) {
  const router = useRouter()
  const { title, description, action } = parseErrorInfo(content)

  return (
    <div className="flex items-start gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 mt-0.5">
        <AlertCircle className="size-3.5 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm bg-destructive/5 ring-1 ring-destructive/20 px-4 py-3 shadow-sm space-y-1">
          <p className="text-sm font-medium text-destructive">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          {action && (
            <button
              onClick={() => router.push(action.href)}
              className="text-xs text-primary hover:underline underline-offset-2 mt-1 block"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
      </div>
    </div>
  )
}

function AssistantMessage({
  content,
  isStreaming,
  currentTool,
}: {
  content: string
  isStreaming?: boolean
  currentTool?: string | null
}) {
  // Pas encore de texte → pastille animée uniquement
  if (isStreaming && !content) {
    return <ThinkingPill currentTool={currentTool ?? null} />
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
        <Bot className="size-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm bg-card ring-1 ring-foreground/10 px-4 py-2.5 shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-card-foreground">
            {content}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({
  mode,
  onQuickPrompt,
}: {
  mode: AgentMode
  onQuickPrompt: (prompt: string) => void
}) {
  const config = MODE_CONFIG[mode]
  const prompts = QUICK_PROMPTS[mode]

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
        <config.icon className="size-7 text-primary" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-foreground">Agent IA — {config.description}</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {mode === "portfolio" && "Posez une question sur votre portefeuille ou demandez une analyse complète."}
          {mode === "instrument" && "Entrez un ticker ou ISIN, puis posez votre question sur l'instrument."}
          {mode === "market" && "Interrogez l'agent sur les tendances du marché, les ETF et le contexte macro."}
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {prompts.map(({ text, prompt }) => (
          <button
            key={text}
            onClick={() => onQuickPrompt(prompt)}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left shadow-sm"
          >
            <Zap className="size-3.5 text-muted-foreground shrink-0" />
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AgentChatProps {
  initialMode?: AgentMode
  initialTarget?: string
}

export function AgentChat({ initialMode = "portfolio", initialTarget = "" }: AgentChatProps) {
  const [mode, setMode] = useState<AgentMode>(initialMode)
  const [target, setTarget] = useState(initialTarget)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentTool, setCurrentTool] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Auto-scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, currentTool])

  // ── Reset on mode change ────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentTool(null)
  }, [mode])

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (messageText: string) => {
      const trimmed = messageText.trim()
      if (!trimmed || isStreaming) return

      const userMessage: Message = { role: "user", content: trimmed }

      // Build history (last 10 exchanges = 20 messages, excluding current)
      const historyMessages = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setIsStreaming(true)
      setCurrentTool(null)

      // Placeholder message vide — la pastille s'affiche tant que content === ""
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])

      try {
        const payload = {
          message: trimmed,
          mode,
          ...(mode === "instrument" && target.trim() ? { target: target.trim() } : {}),
          history: historyMessages,
        }

        const res = await fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let assistantContent = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine.startsWith("data:")) continue
            const jsonStr = trimmedLine.slice(5).trim()
            if (!jsonStr) continue

            let event: SSEEvent
            try { event = JSON.parse(jsonStr) } catch { continue }

            if (event.type === "text") {
              assistantContent += event.text
              setCurrentTool(null) // le texte démarre → cacher la pastille
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: assistantContent }
                }
                return updated
              })
            } else if (event.type === "tool_start") {
              setCurrentTool(event.toolName) // met à jour le texte de la pastille
            } else if (event.type === "tool_result") {
              setCurrentTool(null) // outil terminé → retour texte générique
            } else if (event.type === "done") {
              break
            } else if (event.type === "error") {
              throw new Error(event.error)
            }
          }
        }

        // Flush any remaining buffer content
        if (buffer.trim().startsWith("data:")) {
          const jsonStr = buffer.trim().slice(5).trim()
          if (jsonStr) {
            try {
              const event: SSEEvent = JSON.parse(jsonStr)
              if (event.type === "text") {
                assistantContent += event.text
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = { ...last, content: assistantContent }
                  }
                  return updated
                })
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Erreur inconnue"
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: errorMessage,
              isError: true,
            }
          }
          return updated
        })
      } finally {
        setIsStreaming(false)
        setCurrentTool(null)
        textareaRef.current?.focus()
      }
    },
    [isStreaming, messages, mode, target]
  )

  const handleSubmit = () => sendMessage(input)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleModeChange = (newMode: AgentMode) => {
    setMode(newMode)
    setMessages([])
    setCurrentTool(null)
    setInput("")
  }

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt)
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">Agent IA</h1>
              <p className="text-xs text-muted-foreground leading-tight">Analyse financière</p>
            </div>
          </div>

          {hasMessages && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Nouvelle conversation
            </button>
          )}
        </div>

        {/* Mode selector */}
        <div className="flex gap-1.5">
          {(Object.entries(MODE_CONFIG) as [AgentMode, typeof MODE_CONFIG[AgentMode]][]).map(
            ([key, config]) => {
              const Icon = config.icon
              const isActive = mode === key
              return (
                <button
                  key={key}
                  onClick={() => handleModeChange(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {config.description}
                </button>
              )
            }
          )}
        </div>

        {/* Instrument target input */}
        {mode === "instrument" && (
          <div className="flex items-center gap-2">
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Ticker ou ISIN (ex: MC.PA, FR0000131104)"
              className="h-8 text-sm max-w-xs"
            />
            {target && (
              <Badge variant="secondary" className="text-xs">
                {target.trim().toUpperCase()}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4"
      >
        {!hasMessages ? (
          <EmptyState mode={mode} onQuickPrompt={handleQuickPrompt} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-5">
            {messages.map((message, index) => {
              const isLastAssistant =
                message.role === "assistant" && index === messages.length - 1

              if (message.role === "user") {
                return <UserMessage key={index} content={message.content} />
              }

              if (message.isError) {
                return <ErrorMessage key={index} content={message.content} />
              }

              return (
                <AssistantMessage
                  key={index}
                  content={message.content}
                  isStreaming={isLastAssistant && isStreaming}
                  currentTool={isLastAssistant && isStreaming ? currentTool : null}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <div
            className={cn(
              "flex items-end gap-2 rounded-xl border bg-card px-3 py-2 transition-colors shadow-sm",
              isStreaming ? "border-border" : "border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
            )}
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "portfolio"
                  ? "Posez une question sur votre portefeuille..."
                  : mode === "instrument"
                  ? "Posez une question sur cet instrument..."
                  : "Posez une question sur le marché..."
              }
              disabled={isStreaming}
              rows={1}
              className={cn(
                "flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none outline-none",
                "focus-visible:border-0 focus-visible:ring-0 focus-visible:outline-none",
                "min-h-[24px] max-h-32 leading-6 placeholder:text-muted-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            />
            <Button
              onClick={handleSubmit}
              disabled={isStreaming || !input.trim()}
              size="icon-sm"
              className="shrink-0 mb-0.5"
            >
              {isStreaming ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Entrée pour envoyer · Maj+Entrée pour un saut de ligne
          </p>
        </div>
      </div>
    </div>
  )
}
