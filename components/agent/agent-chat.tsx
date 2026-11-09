"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bot, BriefcaseBusiness, Search, Sparkles, Send, Loader2, PanelLeftClose, PanelLeftOpen, Plus, Trash2, X, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useAgent } from "./agent-provider"
import { MessageMarkdown } from "./message-markdown"
import type { ChatAction, ConversationSummary } from "@/lib/ai/conversations"

const PORTFOLIO_PROMPT = "Analyse mon portfolio et donne-moi tes recommandations."
const PROMPTS = [
  { title: "Mon portfolio", items: [
    ["Analyse complète", PORTFOLIO_PROMPT],
    ["Risques actuels", "Quels sont les principaux risques dans mon portfolio en ce moment ?"],
    ["Rééquilibrage", "Mon portfolio est-il bien équilibré ? Que changerais-tu ?"],
  ] },
  { title: "Une valeur", items: [
    ["LVMH", "Analyse LVMH (MC.PA) : cours, fondamentaux et perspectives."],
    ["MSCI World", "Donne-moi une analyse de l’ETF MSCI World (CW8)."],
    ["TotalEnergies", "Analyse TotalEnergies (TTE.PA) avec les dernières actualités."],
  ] },
  { title: "Les marchés", items: [
    ["ETF monde", "Quels ETF monde recommandes-tu pour un investisseur long terme PEA ?"],
    ["Contexte macro", "Quel est le contexte macro actuel et comment positionner son portfolio ?"],
    ["Secteurs porteurs", "Quels secteurs sont les plus porteurs en ce moment ?"],
  ] },
]

const TOOL_NAMES: Record<string, string> = {
  get_stock_price: "Consultation des cours", get_fundamentals: "Analyse des fondamentaux",
  get_historical_prices: "Consultation de l’historique des cours", search_news: "Recherche d’actualités",
  get_portfolio_context: "Consultation du portfolio", search_instrument: "Recherche de la valeur",
  get_etf_holdings: "Analyse de la composition de l’ETF",
}

interface AgentChatProps {
  sessionId?: string
  initialMode?: "portfolio" | "instrument" | "market"
  initialTarget?: string
}

export function AgentChat({ sessionId, initialMode, initialTarget = "" }: AgentChatProps) {
  const { entries, summaries, nextCursor, historyError, refresh, load, remove, start } = useAgent()
  const router = useRouter()
  const pathname = usePathname()
  const [localKey, setLocalKey] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [action, setAction] = useState<ChatAction>()
  const [target, setTarget] = useState("")
  const [panel, setPanel] = useState<"instrument" | "quick" | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loading, setLoading] = useState(!!sessionId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const nearBottom = useRef(true)
  const pendingNavigation = useRef<{ key: string; href: string } | null>(null)

  const entry = localKey ? entries[localKey] : Object.values(entries).find((item) => item.conversation.id === sessionId)
  const conversation = entry?.conversation
  const messages = conversation?.messages ?? []
  const hasMessages = messages.length > 0
  const busy = !!entry?.pending || !!conversation?.running
  const selectedId = conversation?.id.startsWith("draft:") ? undefined : conversation?.id ?? sessionId

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("agent-history-collapsed") === "true") } catch { /* optional preference */ }
  }, [])

  useEffect(() => {
    if (pathname !== "/agent") return
    setLocalKey(null)
    setInput(!sessionId && initialMode === "portfolio" ? PORTFOLIO_PROMPT
      : !sessionId && initialMode === "instrument" && initialTarget ? `Analyse ${initialTarget} : cours, fondamentaux et perspectives.` : "")
    setAction(!sessionId && initialMode === "portfolio" ? { mode: "portfolio" }
      : !sessionId && initialMode === "instrument" && initialTarget ? { mode: "instrument", target: initialTarget } : undefined)
    setTarget(initialTarget)
    setPanel(!sessionId && initialMode === "instrument" && !initialTarget ? "instrument" : null)
    setLoadError(null)
    nearBottom.current = true
  }, [sessionId, initialMode, initialTarget, pathname])

  useEffect(() => {
    let active = true
    setLoading(!!sessionId)
    if (sessionId) void load(sessionId).catch((error) => {
      if (active) setLoadError(error instanceof Error ? error.message : "Conversation indisponible.")
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sessionId, load])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, 10_000)
    return () => clearInterval(timer)
  }, [refresh])

  // A run from another tab (or before a reload) is followed through persisted checkpoints.
  useEffect(() => {
    if (!selectedId || !conversation?.running || entry?.pending) return
    const timer = setInterval(() => { void load(selectedId).catch(() => {}) }, 5000)
    return () => clearInterval(timer)
  }, [selectedId, conversation?.running, entry?.pending, load])

  useEffect(() => {
    if (localKey && selectedId && selectedId !== sessionId && pathname === "/agent"
      && pendingNavigation.current?.key === localKey && pendingNavigation.current.href === window.location.href) {
      pendingNavigation.current = null
      router.replace(`/agent?sessionId=${encodeURIComponent(selectedId)}`, { scroll: false })
    }
  }, [localKey, selectedId, sessionId, pathname, router])

  useEffect(() => {
    if (nearBottom.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, entry?.currentTool])

  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = "auto"
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
  }, [input])

  function newChat() {
    pendingNavigation.current = null
    setLocalKey(null); setInput(""); setAction(undefined); setPanel(null); setTarget("")
    setMobileOpen(false); setLoadError(null); setLoading(false)
    router.push("/agent", { scroll: false })
  }

  function prepare(prompt: string, nextAction?: ChatAction) {
    setInput(prompt); setAction(nextAction); setPanel(null)
    textareaRef.current?.focus()
  }

  function submit() {
    if (!input.trim() || busy || loading || loadError) return
    const key = start(input.trim(), selectedId, action)
    if (!selectedId) pendingNavigation.current = { key, href: window.location.href }
    setLocalKey(key); setInput(""); setAction(undefined); setPanel(null)
    nearBottom.current = true
  }

  function toggleSidebar() {
    setCollapsed((previous) => {
      try { localStorage.setItem("agent-history-collapsed", String(!previous)) } catch { /* optional preference */ }
      return !previous
    })
  }

  async function deleteConversation() {
    if (!deleting) return
    setDeleteBusy(true); setDeleteError(null)
    try {
      await remove(deleting.id)
      if (selectedId === deleting.id) newChat()
      setDeleting(null)
    } catch (error) { setDeleteError(error instanceof Error ? error.message : "Suppression impossible.") }
    finally { setDeleteBusy(false) }
  }

  const history = <div className="flex h-full min-h-0 flex-col gap-4 p-3">
    <div className="flex items-center justify-between px-1 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversations</span>
      <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" onClick={toggleSidebar} aria-label="Replier l’historique"><PanelLeftClose className="size-4" /></Button>
    </div>
    <Button variant="outline" className="w-full justify-start gap-2" onClick={newChat}><Plus className="size-4" />Nouveau chat</Button>
    {historyError && <div role="alert" className="px-2 text-xs text-destructive">{historyError}<button className="mt-1 block underline" onClick={() => void refresh()}>Réessayer</button></div>}
    <nav aria-label="Historique des conversations" className="min-h-0 flex-1 space-y-1 overflow-y-auto">
      {!summaries.length && !historyError && <p className="px-2 py-6 text-sm leading-relaxed text-muted-foreground">Vos conversations apparaîtront ici après votre premier message.</p>}
      {summaries.map((item) => {
        const live = Object.values(entries).find((value) => value.conversation.id === item.id)
        const running = live?.pending || item.running
        return <div key={item.id} className={cn("group flex items-center gap-1 rounded-lg pr-1 hover:bg-muted", selectedId === item.id && "bg-primary/8")}>
          <Link href={`/agent?sessionId=${encodeURIComponent(item.id)}`} onClick={() => setMobileOpen(false)} aria-current={selectedId === item.id ? "page" : undefined} className="min-w-0 flex-1 rounded-lg px-2.5 py-2.5">
            <span className="flex items-center gap-2 text-sm">
              {running ? <Loader2 aria-label="Réponse en cours" className="size-3.5 shrink-0 animate-spin text-primary" /> : <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />}
              <span className="truncate">{item.title}</span>
            </span>
            <span className="mt-1 block pl-5.5 text-[11px] text-muted-foreground">{running ? "Réponse en cours…" : new Date(item.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
          </Link>
          <Button variant="ghost" size="icon-sm" disabled={!!running} aria-label={`Supprimer ${item.title}`} onClick={() => { setDeleting(item); setDeleteError(null) }} className="shrink-0 text-muted-foreground lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"><Trash2 className="size-3.5" /></Button>
        </div>
      })}
      {nextCursor && <Button variant="ghost" className="w-full text-xs" disabled={historyLoading} onClick={async () => { setHistoryLoading(true); await refresh(nextCursor); setHistoryLoading(false) }}>{historyLoading ? "Chargement…" : "Voir plus"}</Button>}
    </nav>
  </div>

  const composer = <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-3 sm:px-6">
    <div className="mb-3 flex flex-wrap justify-center gap-2">
      <Button variant="outline" size="sm" disabled={busy} className="rounded-full text-xs" onClick={() => prepare(PORTFOLIO_PROMPT, { mode: "portfolio" })}><BriefcaseBusiness className="size-3.5" />Analyser mon portfolio</Button>
      <Button variant="outline" size="sm" disabled={busy} className="rounded-full text-xs" aria-expanded={panel === "instrument"} onClick={() => setPanel(panel === "instrument" ? null : "instrument")}><Search className="size-3.5" />Rechercher une valeur</Button>
      <Button variant="outline" size="sm" disabled={busy} className="rounded-full text-xs" aria-expanded={panel === "quick"} onClick={() => setPanel(panel === "quick" ? null : "quick")}><Sparkles className="size-3.5" />Questions rapides</Button>
    </div>
    {panel && <div className="relative mb-3 rounded-xl border bg-card p-4 pr-10 shadow-sm">
      <Button variant="ghost" size="icon-sm" aria-label="Fermer les suggestions" className="absolute right-1 top-1" onClick={() => setPanel(null)}><X className="size-3.5" /></Button>
      {panel === "instrument" ? <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); if (target.trim()) prepare(`Analyse ${target.trim()} : cours, fondamentaux et perspectives.`, { mode: "instrument", target: target.trim() }) }}>
        <label htmlFor="agent-target" className="w-full text-xs font-medium">Nom, ticker ou ISIN</label>
        <Input autoFocus id="agent-target" value={target} maxLength={200} onChange={(event) => setTarget(event.target.value)} placeholder="Ex. LVMH, MC.PA, FR0000121014" className="min-w-36 flex-1" />
        <Button type="submit" variant="secondary" disabled={!target.trim()}>Préparer la question</Button>
      </form> : <div className="grid gap-4 sm:grid-cols-3">
        {PROMPTS.map((group) => <div key={group.title}><p className="mb-2 text-xs font-semibold text-muted-foreground">{group.title}</p><div className="flex flex-col gap-1">{group.items.map(([label, prompt]) => <button key={label} onClick={() => prepare(prompt)} className="rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted">{label}</button>)}</div></div>)}
      </div>}
    </div>}
    <form onSubmit={(event) => { event.preventDefault(); submit() }} className="rounded-2xl border border-input bg-card p-3 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
      <Textarea ref={textareaRef} value={input} maxLength={4000} rows={2} disabled={busy || loading || !!loadError} aria-label="Message pour l’assistant IA" placeholder="Que souhaitez-vous explorer ?" onChange={(event) => { setInput(event.target.value); setAction(undefined) }}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit() } }}
        className="max-h-40 min-h-14 resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0" />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{busy ? "Réponse en cours…" : "Entrée pour envoyer · Maj+Entrée pour un saut de ligne"}</span>
        <Button type="submit" size="icon-sm" disabled={busy || loading || !!loadError || !input.trim()} aria-label="Envoyer le message">{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</Button>
      </div>
    </form>
  </div>

  return <main className="agent-workspace flex h-full min-h-0 overflow-hidden">
    {!collapsed && <aside className="hidden w-64 shrink-0 border-r bg-muted/20 lg:block">{history}</aside>}
    <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
      <DialogContent className="inset-y-0 left-0 flex h-dvh w-80 max-w-[88vw] translate-x-0 translate-y-0 flex-col rounded-none p-0 pt-10" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Historique des conversations</DialogTitle>{history}
      </DialogContent>
    </Dialog>
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Ouvrir l’historique" onClick={() => setMobileOpen(true)}><PanelLeftOpen className="size-4" /></Button>
        {collapsed && <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" aria-label="Déplier l’historique" onClick={toggleSidebar}><PanelLeftOpen className="size-4" /></Button>}
        <Bot className="size-5 shrink-0 text-primary" />
        <h1 className="min-w-0 flex-1 truncate font-semibold">{hasMessages ? conversation?.title : "Agent IA"}</h1>
        <Button variant="ghost" size="sm" aria-label="Nouveau chat" onClick={newChat}><Plus className="size-4" /><span className="hidden sm:inline">Nouveau chat</span></Button>
      </header>
      {loadError && <div role="alert" className="m-4 rounded-lg border border-destructive/20 p-3 text-sm text-destructive">{loadError}<Button variant="ghost" size="sm" onClick={() => { if (sessionId) { setLoadError(null); setLoading(true); void load(sessionId).catch((error) => setLoadError(error.message)).finally(() => setLoading(false)) } }}>Réessayer</Button></div>}
      {entry?.error && <div role="alert" className="mx-4 mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">{entry.error}<Link href="/settings" className="ml-2 text-primary underline">Paramètres IA</Link>{entry.retryMessage && <button className="ml-2 text-primary underline" onClick={() => prepare(entry.retryMessage!)}>Remettre la question</button>}</div>}
      {!hasMessages ? <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-6">
        <div className="px-6 text-center"><div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10"><Sparkles className="size-7 text-primary" /></div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{loading ? "Chargement de la conversation…" : "Parlons de vos investissements"}</h2>
          <p className="mb-5 mt-3 text-sm text-muted-foreground">Votre portfolio, une valeur, les marchés. Une seule conversation.</p>
        </div>{composer}
      </div> : <>
        <div ref={scrollRef} onScroll={() => { const node = scrollRef.current; if (node) nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100 }} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-6">{messages.map((message) => <div key={message.id} className={cn("flex gap-3", message.role === "user" && "justify-end")}>
            {message.role === "assistant" && <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10"><Bot className="size-4 text-primary" /></div>}
            <div className={cn("min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed", message.role === "user" ? "max-w-[85%] rounded-tr-sm bg-primary text-primary-foreground" : "flex-1 rounded-tl-sm bg-card ring-1 ring-border")}>
              {message.content && <MessageMarkdown content={message.content} />}
              {message.status === "streaming" && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />{entry?.currentTool ? TOOL_NAMES[entry.currentTool] ?? "Consultation des données" : "Réflexion en cours…"}</p>}
              {(message.status === "interrupted" || message.status === "failed") && <p className="mt-2 text-xs text-muted-foreground">{message.error ?? (message.status === "failed" ? "La réponse a échoué." : "Réponse interrompue. Le texte enregistré a été conservé.")}</p>}
            </div>
          </div>)}</div>
        </div><div className="shrink-0 border-t bg-background">{composer}</div>
      </>}
    </section>
    <Dialog open={!!deleting} onOpenChange={(open) => { if (!open && !deleteBusy) setDeleting(null) }}>
      <DialogContent><DialogTitle>Supprimer cette conversation ?</DialogTitle><DialogDescription>« {deleting?.title} » et ses messages seront supprimés définitivement.</DialogDescription>
        {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
        <DialogFooter><Button variant="outline" disabled={deleteBusy} onClick={() => setDeleting(null)}>Annuler</Button><Button variant="destructive" disabled={deleteBusy} onClick={() => void deleteConversation()}>{deleteBusy ? "Suppression…" : "Supprimer"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </main>
}
