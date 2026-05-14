"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Bookmark, Plus, Trash2, TrendingUp, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WatchlistItem {
  id: string
  isin: string
  ticker: string | null
  name: string
  addedPrice: number | null
  addedAt: string
}

interface QuoteData {
  price: number
  currency: string
  change1d: number | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtPrice(price: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
}

function fmtPct(pct: number) {
  return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "\u202f%"
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ isin: "", name: "", ticker: "", addedPrice: "" })
  const [lookingUpIsin, setLookingUpIsin] = useState(false)
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({})
  const isinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchQuotes = useCallback(async (data: WatchlistItem[]) => {
    const tickers = data.map((i) => i.ticker).filter(Boolean) as string[]
    if (tickers.length === 0) return
    const res = await fetch(`/api/market/quote?tickers=${tickers.join(",")}`)
    if (res.ok) setQuotes(await res.json())
  }, [])

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/watchlist")
    if (res.ok) {
      const data: WatchlistItem[] = await res.json()
      setItems(data)
      setLoading(false)
      fetchQuotes(data)
    } else {
      setLoading(false)
    }
  }, [fetchQuotes])

  useEffect(() => { fetchItems() }, [fetchItems])

  // ISIN → auto-fill nom, ticker, prix d'ajout
  useEffect(() => {
    if (isinTimer.current) clearTimeout(isinTimer.current)
    const isin = form.isin.trim()
    if (isin.length < 5) return
    isinTimer.current = setTimeout(async () => {
      setLookingUpIsin(true)
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(isin)}`)
        if (!res.ok) return
        const results: Array<{ ticker: string; name: string; price: number | null }> = await res.json()
        if (results.length === 0) return
        const { ticker, name, price } = results[0]
        setForm((f) => ({
          ...f,
          ticker,
          name,
          addedPrice: price != null ? String(price) : f.addedPrice,
        }))
      } catch {
        // silent
      } finally {
        setLookingUpIsin(false)
      }
    }, 600)
    return () => { if (isinTimer.current) clearTimeout(isinTimer.current) }
  }, [form.isin])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isin: form.isin,
        name: form.name,
        ticker: form.ticker || undefined,
        addedPrice: form.addedPrice ? parseFloat(form.addedPrice) : undefined,
      }),
    })
    setAdding(false)
    if (res.ok) {
      toast.success("Ajouté à la watchlist")
      setForm({ isin: "", name: "", ticker: "", addedPrice: "" })
      fetchItems()
    } else {
      const err = await res.json()
      toast.error(err.error ?? "Erreur lors de l'ajout")
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" })
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id))
      toast.success("Retiré de la watchlist")
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Bookmark className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Watchlist</h1>
          <p className="text-sm text-muted-foreground">Instruments à surveiller</p>
        </div>
      </div>

      {/* Formulaire d'ajout */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un instrument
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-wrap gap-3">
            <div className="relative w-48">
              <Input
                placeholder="ISIN (ex: FR0010315770)"
                value={form.isin}
                onChange={(e) => setForm((f) => ({ ...f, isin: e.target.value }))}
                required
              />
              {lookingUpIsin && (
                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <Input
              placeholder="Nom (ex: Amundi CW8)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="flex-1 min-w-40"
            />
            <Input
              placeholder="Ticker (ex: CW8.PA)"
              value={form.ticker}
              onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
              className="w-36"
            />
            <Button type="submit" disabled={adding}>
              {adding ? "Ajout..." : "Ajouter"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {items.length} instrument{items.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bookmark className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>Aucun instrument en watchlist</p>
              <p className="text-xs mt-1">Ajoutez des instruments à surveiller ci-dessus</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => {
                const quote = item.ticker ? quotes[item.ticker] : undefined
                const currentPrice = quote?.price
                const evolution =
                  item.addedPrice != null && currentPrice != null
                    ? ((currentPrice - item.addedPrice) / item.addedPrice) * 100
                    : null
                const isLoading = item.ticker && !quote

                return (
                  <div key={item.id} className="flex items-center gap-4 py-3">
                    {/* Identité */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{item.name}</span>
                        {item.ticker && (
                          <Badge variant="secondary" className="text-xs shrink-0 font-mono">
                            {item.ticker}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.isin}</p>
                    </div>

                    {/* Prix ajout */}
                    {item.addedPrice != null && (
                      <div className="text-right hidden sm:block shrink-0">
                        <p className="text-xs text-muted-foreground">Ajout</p>
                        <p className="text-sm tabular-nums">
                          {fmtPrice(item.addedPrice, quote?.currency)}
                        </p>
                      </div>
                    )}

                    {/* Prix actuel */}
                    <div className="text-right shrink-0 min-w-[5rem]">
                      <p className="text-xs text-muted-foreground">Actuel</p>
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto mt-0.5" />
                      ) : currentPrice != null ? (
                        <p className="text-sm tabular-nums font-medium">
                          {fmtPrice(currentPrice, quote?.currency)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* Évolution depuis l'ajout */}
                    <div className={cn(
                      "text-right shrink-0 min-w-[4.5rem]",
                      evolution == null && "invisible",
                      evolution != null && evolution >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                    )}>
                      <p className="text-xs opacity-70">Évolution</p>
                      <p className="text-sm tabular-nums font-semibold">
                        {evolution != null ? fmtPct(evolution) : ""}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {item.ticker && (
                        <Link href={`/agent?mode=instrument&target=${item.ticker}`}>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                            <TrendingUp className="h-3 w-3" />
                            Analyser
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
