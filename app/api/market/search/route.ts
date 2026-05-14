import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { searchInstruments } from "@/lib/market-data/yahoo-finance"
import { getCachedQuotesByTicker } from "@/lib/market-data/price-cache"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim()
  if (!q) return NextResponse.json({ error: "q requis" }, { status: 400 })

  // Recherche des instruments
  const instruments = await searchInstruments(q)
  if (instruments.length === 0) return NextResponse.json([])

  // Enrichissement avec les prix (passent par le cache 15 min)
  const tickers = instruments.map((i) => i.ticker)
  const quotes = await getCachedQuotesByTicker(tickers)

  const results = instruments.map((i) => {
    const quote = quotes.get(i.ticker)
    return {
      ticker: i.ticker,
      name: i.name,
      type: i.type,
      exchange: i.exchange,
      price: quote?.price ?? null,
      currency: quote?.currency ?? null,
      change1d: quote?.change1d ?? null,
      change1dAbs: quote?.change1dAbs ?? null,
    }
  })

  return NextResponse.json(results)
}
