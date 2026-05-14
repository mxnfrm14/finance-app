"use client"

import { useEffect, useMemo, useState } from "react"
import { BookmarkPlus, BookmarkCheck, BookmarkMinus, BriefcaseBusiness, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AddPositionForm } from "@/components/portfolio/add-position-form"
import { useLanguage } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"

type WatchlistItem = {
  id: string
  isin: string
  ticker: string | null
  name: string
}

export default function InstrumentActions({ ticker, name, isin }: { ticker: string; name?: string; isin?: string | null }) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [watchlistItem, setWatchlistItem] = useState<WatchlistItem | null>(null)
  const [addPosOpen, setAddPosOpen] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch("/api/watchlist")
        if (!res.ok) return
        const items = (await res.json()) as WatchlistItem[]
        if (!alive) return
        const match = items.find((item) => item.ticker === ticker || item.isin === ticker || (isin ? item.isin === isin : false)) ?? null
        setWatchlistItem(match)
      } catch {
        // ignore
      }
    })()
    return () => {
      alive = false
    }
  }, [ticker, isin])

  const inWatchlist = watchlistItem !== null

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
        const item = (await res.json()) as WatchlistItem
        setWatchlistItem(item)
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

  async function removeFromWatchlist() {
    if (!watchlistItem) return
    setLoading(true)
    try {
      const res = await fetch(`/api/watchlist/${watchlistItem.id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Retire de la watchlist")
        setWatchlistItem(null)
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

  const buttonLabel = useMemo(() => {
    if (inWatchlist) return hovered ? "Retirer de la watchlist" : "Dans la watchlist"
    return "Ajouter a la watchlist"
  }, [hovered, inWatchlist])

  const buttonIcon = useMemo(() => {
    if (loading) return <Loader2 className="h-4 w-4 animate-spin" />
    if (!inWatchlist) return <BookmarkPlus className="h-4 w-4" />
    return hovered ? <BookmarkMinus className="h-4 w-4" /> : <BookmarkCheck className="h-4 w-4" />
  }, [hovered, inWatchlist, loading])

  const handleWatchlistClick = async () => {
    if (inWatchlist) {
      await removeFromWatchlist()
      return
    }
    await addToWatchlist()
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
      <Button
        variant="default"
        size="sm"
        onClick={handleWatchlistClick}
        disabled={loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={buttonLabel}
        title={buttonLabel}
      >
        {buttonIcon}
        {loading ? "Veuillez patienter..." : buttonLabel}
      </Button>

      <Dialog open={addPosOpen} onOpenChange={setAddPosOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Plus className="h-4 w-4" />
              Ajouter position
            </Button>
          }
        />
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.portfolio.newPosition}</DialogTitle>
          </DialogHeader>
          <AddPositionForm
            onSuccess={() => setAddPosOpen(false)}
            onCancel={() => setAddPosOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
