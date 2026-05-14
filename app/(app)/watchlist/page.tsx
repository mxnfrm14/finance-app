"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowUpDown,
  Bookmark,
  CircleDollarSign,
  Filter,
  Flame,
  Loader2,
  Plus,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ isin: "", name: "", ticker: "", addedPrice: "" })
  const [lookingUpIsin, setLookingUpIsin] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({})
  const [entryPrices, setEntryPrices] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [filterMode, setFilterMode] = useState<"all" | "winners" | "losers" | "added" | "price">("all")
  const isinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchQuotes = useCallback(async (data: WatchlistItem[]) => {
    const tickers = data.map((i) => i.ticker).filter(Boolean) as string[]
    if (tickers.length === 0) return
    try {
      const res = await fetch(`/api/market/quote?tickers=${tickers.join(",")}`)
      if (res.ok) setQuotes(await res.json())
    } catch {
      // ignore quote refresh errors; the list itself should still render
    }
  }, [])

  const fetchEntryPrices = useCallback(async (data: WatchlistItem[]) => {
    const targets = data.filter((item) => item.ticker && item.addedPrice == null)
    if (targets.length === 0) return

    const entries = await Promise.allSettled(
      targets.map(async (item) => {
        const addedAt = new Date(item.addedAt)
        const period1 = new Date(addedAt.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        const period2 = new Date(addedAt.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        const res = await fetch(
          `/api/market/chart?ticker=${encodeURIComponent(item.ticker!)}&period1=${period1}&period2=${period2}&interval=1d`
        )
        if (!res.ok) throw new Error("chart fetch failed")
        const chart = await res.json() as { prices?: Array<{ close?: number | null }> }
        const entry = chart.prices?.find((row) => row.close != null)?.close ?? null
        return { id: item.id, price: entry }
      })
    )

    const next: Record<string, number> = {}
    for (const result of entries) {
      if (result.status === "fulfilled" && result.value.price != null) {
        next[result.value.id] = result.value.price
      }
    }
    if (Object.keys(next).length > 0) setEntryPrices((prev) => ({ ...prev, ...next }))
  }, [])

  const fetchItems = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/watchlist")
      if (!res.ok) {
        setError("Impossible de charger la watchlist")
        return
      }

      const data: WatchlistItem[] = await res.json()
      setItems(data)
      fetchQuotes(data)
      fetchEntryPrices(data)
    } catch {
      setError("Impossible de charger la watchlist")
    } finally {
      setLoading(false)
    }
  }, [fetchQuotes, fetchEntryPrices])

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
      setAddModalOpen(false)
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

  function handleSuggestAddFromSearch() {
    const value = searchTerm.trim()
    const upper = value.toUpperCase()
    const isLikelyIsin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(upper)
    const isLikelyTicker = /^[A-Z0-9.-]{1,15}$/.test(upper)

    setForm((prev) => ({
      ...prev,
      isin: isLikelyIsin ? upper : "",
      ticker: !isLikelyIsin && isLikelyTicker ? upper : "",
      name: !isLikelyIsin && value.length > 0 ? value : "",
      addedPrice: "",
    }))
    setAddModalOpen(true)
  }

  const rows = useMemo(() => {
    return items.map((item) => {
      const quote = item.ticker ? quotes[item.ticker] : undefined
      const currentPrice = quote?.price ?? null
      const entryPrice = item.addedPrice ?? entryPrices[item.id] ?? null
      const evolution = entryPrice != null && currentPrice != null
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : null

      return { item, quote, currentPrice, entryPrice, evolution }
    })
  }, [items, quotes, entryPrices])

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return rows.filter((row) => {
      const haystack = `${row.item.name} ${row.item.isin} ${row.item.ticker ?? ""}`.toLowerCase()
      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch)
      const matchesFilter =
        filterMode === "all" ||
        (filterMode === "winners" && (row.evolution ?? 0) > 0) ||
        (filterMode === "losers" && (row.evolution ?? 0) < 0) ||
        // 'added' and 'price' are sorting modes handled after filtering; keep all rows here
        filterMode === "added" ||
        filterMode === "price"

      // First filter by search and simple filters (winners/losers/all)
      const simpleMatch = matchesSearch && (filterMode === "all" || filterMode === "winners" || filterMode === "losers" ? matchesFilter : matchesSearch)
      return simpleMatch
    })
  }, [rows, searchTerm, filterMode])

  // Apply sorting when requested
  const sortedRows = useMemo(() => {
    if (filterMode === "added") {
      // Sort by addedAt descending (newest first)
      return [...filteredRows].sort((a, b) => new Date(b.item.addedAt).getTime() - new Date(a.item.addedAt).getTime())
    }
    if (filterMode === "price") {
      // Sort by current price descending (nulls last)
      return [...filteredRows].sort((a, b) => {
        const pa = a.currentPrice ?? -Infinity
        const pb = b.currentPrice ?? -Infinity
        return pb - pa
      })
    }
    return filteredRows
  }, [filteredRows, filterMode])

  const stats = useMemo(() => {
    const withTicker = rows.filter((row) => Boolean(row.item.ticker)).length
    const withEntry = rows.filter((row) => row.entryPrice != null).length
    const gainers = rows.filter((row) => (row.evolution ?? 0) > 0).length
    const losers = rows.filter((row) => (row.evolution ?? 0) < 0).length

    return { withTicker, withEntry, gainers, losers }
  }, [rows])

  const filterButtons: Array<{ key: typeof filterMode; label: string; icon: typeof Filter }> = [
    { key: "all", label: "Tous", icon: Filter },
    { key: "winners", label: "En hausse", icon: Flame },
    { key: "losers", label: "En baisse", icon: ArrowUpDown },
    { key: "added", label: "Par ordre d'ajout", icon: Plus },
    { key: "price", label: "Par prix actuel", icon: CircleDollarSign },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <Card className="overflow-hidden border-border/60 bg-linear-to-br from-background via-background to-muted/30">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <Bookmark className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Suivi</p>
                  <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{items.length} instruments</Badge>
                {/* <Badge variant="outline" className="text-profit">{stats.gainers} en hausse</Badge>
                <Badge variant="outline" className="text-loss">{stats.losers} en baisse</Badge> */}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-[14rem]">
              <div className="rounded-xl border bg-card p-2.5 shadow-sm">
                <p className="text-xs text-muted-foreground">Hausse</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-profit">{stats.gainers}</p>
              </div>
              <div className="rounded-xl border bg-card p-2.5 shadow-sm">
                <p className="text-xs text-muted-foreground">Baisse</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-loss">{stats.losers}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-[32rem]">
          <DialogHeader>
            <DialogTitle>Ajouter un instrument</DialogTitle>
            <DialogDescription>
              Renseignez un ISIN, un ticker ou un nom d&apos;instrument. Le champ ISIN peut proposer un remplissage automatique.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="relative">
              <Input
                placeholder="ISIN (ex: FR0010315770)"
                value={form.isin}
                onChange={(e) => setForm((f) => ({ ...f, isin: e.target.value }))}
                required
                className="pr-9"
              />
              {lookingUpIsin && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            <Input
              placeholder="Nom (ex: Amundi CW8)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <Input
                placeholder="Ticker (ex: CW8.PA)"
                value={form.ticker}
                onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
              />
              <Input
                placeholder="Prix d'ajout"
                value={form.addedPrice}
                onChange={(e) => setForm((f) => ({ ...f, addedPrice: e.target.value }))}
                inputMode="decimal"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={adding} className="gap-2">
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ajout...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom, ISIN ou ticker"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="gap-2" onClick={() => setAddModalOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
              {filterButtons.map((button) => {
                const Icon = button.icon
                const active = filterMode === button.key
                return (
                  <Button
                    key={button.key}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className="gap-2"
                    onClick={() => setFilterMode(button.key)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {button.label}
                  </Button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {sortedRows.length} résultat{sortedRows.length !== 1 ? "s" : ""}
          </CardTitle>
          <CardDescription>
            Chaque ligne affiche le prix d&apos;ajout, le cours courant et l&apos;évolution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && !loading && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl border bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : sortedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
              <Bookmark className="mb-3 h-10 w-10 opacity-30" />
              <p className="font-medium">Aucun instrument ne correspond</p>
              <p className="mt-1 text-sm">Modifiez le filtre ou ajoutez un instrument ci-dessus.</p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 gap-2"
                onClick={handleSuggestAddFromSearch}
              >
                <Plus className="h-4 w-4" />
                {searchTerm.trim().length > 0
                  ? `Ajouter "${searchTerm.trim()}"`
                  : "Ajouter un instrument"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {sortedRows.map(({ item, quote, currentPrice, entryPrice, evolution }) => {
                const isLoading = item.ticker && !quote
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold">{item.name}</h3>
                          {item.ticker && <Badge variant="secondary" className="font-mono text-xs">{item.ticker}</Badge>}
                          {evolution != null && (
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                              evolution >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                            )}>
                              {evolution >= 0 ? "En hausse" : "En baisse"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{item.isin}</p>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/market/${encodeURIComponent(item.ticker ?? item.isin)}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            <TrendingUp className="mr-2 h-3.5 w-3.5" />
                            Ouvrir
                          </Link>
                          {item.ticker && (
                            <Link
                              href={`/agent?mode=instrument&target=${item.ticker}`}
                              className={buttonVariants({ variant: "ghost", size: "sm" })}
                            >
                              Analyser
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 lg:min-w-md">
                        <div className="rounded-xl border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground">Prix d&apos;ajout</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums">
                            {entryPrice != null ? fmtPrice(entryPrice, quote?.currency) : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground">Cours actuel</p>
                          {isLoading ? (
                            <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <p className="mt-1 text-sm font-semibold tabular-nums">
                              {currentPrice != null ? fmtPrice(currentPrice, quote?.currency) : "—"}
                            </p>
                          )}
                        </div>
                        <div className={cn(
                          "rounded-xl border p-3",
                          evolution == null ? "bg-muted/20" : evolution >= 0 ? "border-profit/20 bg-profit/10" : "border-loss/20 bg-loss/10"
                        )}>
                          <p className="text-xs text-muted-foreground">Évolution</p>
                          <p className={cn(
                            "mt-1 text-sm font-semibold tabular-nums",
                            evolution == null ? "text-foreground" : evolution >= 0 ? "text-profit" : "text-loss"
                          )}>
                            {evolution != null ? fmtPct(evolution) : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 lg:flex-col lg:items-end lg:justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
