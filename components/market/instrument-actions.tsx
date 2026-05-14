"use client"

import { useState } from "react"
import Link from "next/link"
import { BookmarkPlus, BriefcaseBusiness, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function InstrumentActions({ ticker, name, isin }: { ticker: string; name?: string; isin?: string | null }) {
  const [loading, setLoading] = useState(false)

  async function addToWatchlist() {
    setLoading(true)
    try {
      // Prefer provided ISIN prop, otherwise try to resolve a canonical ISIN for this ticker
      let resolvedIsin: string | null = isin ?? null
      if (!resolvedIsin) {
        try {
          const r = await fetch(`/api/market/resolve-isin?ticker=${encodeURIComponent(ticker)}`)
          if (r.ok) {
            const j = await r.json()
            resolvedIsin = j?.isin ?? null
          }
        } catch {
          // ignore
        }
      }
      let addedPrice: number | undefined
      try {
        const quoteRes = await fetch(`/api/market/quote?tickers=${encodeURIComponent(ticker)}`)
        if (quoteRes.ok) {
          const quotes = (await quoteRes.json()) as Record<string, { price?: number }>
          addedPrice = quotes[ticker]?.price
        }
      } catch {
        // If quote lookup fails, still add the item without entry price.
      }

      const isinToSend = resolvedIsin ?? ticker
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isin: isinToSend, name: name ?? ticker, ticker, addedPrice }),
      })
      if (res.ok) {
        toast.success("Ajoute a la watchlist")
      } else {
        const json = await res.json()
        toast.error(json?.error ?? "Erreur")
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
      <Button variant="default" size="sm" onClick={addToWatchlist} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
        {loading ? "Ajout..." : "Ajouter a la watchlist"}
      </Button>

      <Link
        href={`/portfolio/new?ticker=${encodeURIComponent(ticker)}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <BriefcaseBusiness className="h-4 w-4" />
        Ajouter position
      </Link>
    </div>
  )
}
