import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { getChartPrices } from "@/lib/market-data/get-chart-prices"
import { fetchQuotes, resolveISINToTicker } from "@/lib/market-data/yahoo-finance"
import { buildPortfolioHistory } from "@/lib/portfolio/value-history"

const MONTHS: Record<string, number> = { "1mo": 1, "3mo": 3, "6mo": 6, "1y": 12, "5y": 60 }

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const period = new URL(request.url).searchParams.get("period") ?? "6mo"
  if (!Object.hasOwn(MONTHS, period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 })
  }

  try {
    const end = new Date()
    const start = new Date(end)
    start.setUTCMonth(start.getUTCMonth() - MONTHS[period])
    // Include the preceding week to seed the last known price on non-trading days.
    const priceStart = new Date(start)
    priceStart.setUTCDate(priceStart.getUTCDate() - 7)
    const positions = await prisma.position.findMany({
      where: { userId: session.user.id, isActive: true },
      select: {
        ticker: true,
        isin: true,
        transactions: {
          where: { date: { lte: end } },
          orderBy: { date: "asc" },
          select: { date: true, type: true, quantity: true, price: true, fees: true }
        }
      }
    })
    const resolved = await Promise.all(positions.map(async (position) => ({
      ...position,
      ticker: position.ticker ?? await resolveISINToTicker(position.isin)
    })))
    const tickers = [...new Set(resolved.flatMap((position) => position.ticker ? [position.ticker] : []))]
    const [quotes, histories] = await Promise.all([
      fetchQuotes(tickers),
      Promise.all(tickers.map(async (ticker) => {
        const result = await getChartPrices(ticker, {
          interval: "1d", period1: priceStart.toISOString(), period2: end.toISOString()
        })
        return [ticker, result.prices ?? []] as const
      }))
    ])
    const historyByTicker = new Map(histories)
    const history = buildPortfolioHistory(resolved.map((position) => {
      const prices = [...(position.ticker ? historyByTicker.get(position.ticker) ?? [] : [])]
      const quote = position.ticker ? quotes.get(position.ticker) : null
      if (quote) prices.push({ date: end.toISOString(), close: quote.price, open: null, high: null, low: null, volume: null })
      return { transactions: position.transactions, prices }
    }), start, end)

    return NextResponse.json({ ...history, currency: "EUR" }, {
      headers: { "Cache-Control": "private, no-store" }
    })
  } catch {
    return NextResponse.json({ error: "Portfolio history unavailable" }, { status: 500 })
  }
}
