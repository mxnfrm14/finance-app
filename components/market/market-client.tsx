"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, Search, Bot, BarChart3, Layers, Loader2, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteData {
  price: number | null
  currency: string | null
  change1d: number | null
  change1dAbs: number | null
}

interface SearchResult extends QuoteData {
  ticker: string
  name: string
  type: string
  exchange: string
}

interface StaticInstrument {
  ticker: string
  name: string
  category: "index" | "etf"
  description: string
}

// ─── Données statiques ────────────────────────────────────────────────────────

const INDICES: StaticInstrument[] = [
  { ticker: "^FCHI",     name: "CAC 40",           category: "index", description: "Indice phare de la Bourse de Paris" },
  { ticker: "^STOXX50E", name: "Eurostoxx 50",      category: "index", description: "50 plus grandes entreprises zone euro" },
  { ticker: "^GSPC",     name: "S&P 500",           category: "index", description: "500 plus grandes capitalisations US" },
  { ticker: "^IXIC",     name: "NASDAQ Composite",  category: "index", description: "Indice technologique américain" },
]

const POPULAR_ETFS: StaticInstrument[] = [
  { ticker: "CW8.PA",  name: "Amundi MSCI World",  category: "etf", description: "MSCI World — éligible PEA" },
  { ticker: "EWLD.PA", name: "iShares MSCI World",  category: "etf", description: "MSCI World — réplication physique" },
  { ticker: "PANX.PA", name: "Amundi NASDAQ-100",   category: "etf", description: "NASDAQ-100 — éligible PEA" },
  { ticker: "500.PA", name: "Amundi S&P 500",      category: "etf", description: "S&P 500 — éligible PEA" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(price: number | null, currency: string | null) {
  if (price === null) return "—"
  const cur = currency ?? "EUR"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)
}

function fmtChange(pct: number | null) {
  if (pct === null) return null
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
}

// ─── Badge variation ──────────────────────────────────────────────────────────

function ChangeBadge({ change1d }: { change1d: number | null }) {
  if (change1d === null) return <span className="text-xs text-muted-foreground">—</span>
  const pos = change1d > 0
  const neu = change1d === 0
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
      pos ? "text-profit" : neu ? "text-muted-foreground" : "text-loss"
    )}>
      {pos ? <ArrowUpRight className="h-3 w-3" /> : neu ? <Minus className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {fmtChange(change1d)}
    </span>
  )
}

// ─── Carte instrument statique ────────────────────────────────────────────────

function InstrumentCard({ instrument, quote, loading }: {
  instrument: StaticInstrument
  quote: QuoteData | null
  loading: boolean
}) {
  const router = useRouter()
  const isEtf = instrument.category === "etf"
  const goToInstrument = () => router.push(`/market/${encodeURIComponent(instrument.ticker)}`)

  return (
    <Card className="flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1",
            isEtf ? "bg-blue-500/10 text-blue-500 ring-blue-500/10" : "bg-primary/10 text-primary ring-primary/10"
          )}>
            {isEtf
              ? <Layers className="h-4 w-4" />
              : <BarChart3 className="h-4 w-4" />
            }
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold truncate leading-snug">{instrument.name}</CardTitle>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{instrument.ticker}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 flex-1">
        {/* Prix — ligne dédiée, pas de concurrence avec le nom */}
        <div className="flex items-center justify-between gap-2">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <p className="text-base font-semibold tabular-nums truncate">
                {fmtPrice(quote?.price ?? null, quote?.currency ?? null)}
              </p>
              <ChangeBadge change1d={quote?.change1d ?? null} />
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{instrument.description}</p>
        <Button variant="outline" size="sm" className="w-full gap-1.5 mt-auto"
          onClick={goToInstrument}>
          <TrendingUp className="h-3.5 w-3.5" />
          Voir le détail
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Résultats de recherche ───────────────────────────────────────────────────

function SearchResults({ results, loading, query }: {
  results: SearchResult[]
  loading: boolean
  query: string
}) {
  const router = useRouter()
  if (!query) return null

  const openInstrument = (ticker: string) => router.push(`/market/${encodeURIComponent(ticker)}`)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Résultats pour &ldquo;{query}&rdquo;</CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <CardDescription>
          Cours, variation et accès rapide au détail de l&apos;instrument.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!loading && results.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Aucun résultat trouvé.
          </div>
        ) : null}

        {results.length > 0 && (
          <div className="overflow-hidden rounded-2xl border bg-background/70">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Instrument</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Bourse</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Cours</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Var. 1j</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map((r) => (
                <tr
                  key={r.ticker}
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => openInstrument(r.ticker)}
                >
                  <td className="px-4 py-3 max-w-0 w-full">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.ticker}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">{r.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{r.exchange}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {fmtPrice(r.price, r.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChangeBadge change1d={r.change1d} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                      onClick={(e) => { e.stopPropagation(); openInstrument(r.ticker) }}>
                      <TrendingUp className="h-3 w-3" />
                      Détail
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function MarketClient() {
  const [query, setQuery] = useState("")
  const [searchQuery, setSearchQuery] = useState("") // query soumise
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Prix des instruments statiques
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({})
  const [quotesLoading, setQuotesLoading] = useState(true)

  // Charger les prix des cartes au montage
  useEffect(() => {
    const allTickers = [...INDICES, ...POPULAR_ETFS].map((i) => i.ticker)
    fetch(`/api/market/quote?tickers=${allTickers.join(",")}`)
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, QuoteData>) => setQuotes(data))
      .catch(() => {})
      .finally(() => setQuotesLoading(false))
  }, [])

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setSearchQuery(trimmed)
    setSearchResults([])
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/market/search?q=${encodeURIComponent(trimmed)}`)
      if (res.ok) setSearchResults(await res.json())
    } finally {
      setSearchLoading(false)
    }
  }, [query])

  // Recherche live à la frappe (debounce 400ms)
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) { setSearchQuery(""); setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearchQuery(trimmed)
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(trimmed)}`)
        if (res.ok) setSearchResults(await res.json())
      } finally {
        setSearchLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marché</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recherchez un instrument pour voir son cours et l&apos;analyser avec l&apos;IA.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ticker, ISIN ou nom — ex: total, MC.PA, CW8…"
            className="pl-8"
            autoFocus
          />
        </div>
        {searchLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />}
      </form>

      <SearchResults results={searchResults} loading={searchLoading} query={searchQuery} />

      {!searchQuery && (
        <>
          <Separator />

          <section>
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Indices de référence</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {INDICES.map((i) => (
                <InstrumentCard key={i.ticker} instrument={i} quote={quotes[i.ticker] ?? null} loading={quotesLoading} />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">ETF populaires</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {POPULAR_ETFS.map((i) => (
                <InstrumentCard key={i.ticker} instrument={i} quote={quotes[i.ticker] ?? null} loading={quotesLoading} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
