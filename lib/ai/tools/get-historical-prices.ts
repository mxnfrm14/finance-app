import YahooFinance from "yahoo-finance2"
import { resolveSymbol } from "@/lib/market-data/yahoo-finance"
import type { ToolDefinition } from "@/lib/ai/providers/types"

export const getHistoricalPricesDefinition: ToolDefinition = {
  name: "get_historical_prices",
  description: "Récupère l'historique des cours OHLCV d'un instrument sur une période donnée. Utile pour calculer la performance, la volatilité, les tendances.",
  input_schema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Symbole boursier" },
      period: {
        type: "string",
        description: "Période de l'historique",
        enum: ["1mo", "3mo", "6mo", "1y", "2y", "5y"],
      },
      interval: {
        type: "string",
        description: "Granularité des données",
        enum: ["1d", "1wk", "1mo"],
      },
    },
    required: ["ticker"],
  },
}

export async function getHistoricalPrices(input: unknown) {
  const { ticker, period = "6mo", interval = "1wk" } = input as {
    ticker: string
    period?: string
    interval?: string
  }

  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })
  const end = new Date()
  const start = new Date()

  const months: Record<string, number> = { "1mo": 1, "3mo": 3, "6mo": 6, "1y": 12, "2y": 24, "5y": 60 }
  start.setMonth(start.getMonth() - (months[period] ?? 6))

  const fetchHistory = async (sym: string) => {
    return yf.historical(
      sym,
      { period1: start.toISOString().split("T")[0], period2: end.toISOString().split("T")[0], interval: interval as "1d" | "1wk" | "1mo" },
      { validateResult: false }
    )
  }

  try {
    let history = await fetchHistory(ticker)
    let resolvedTicker = ticker

    // Historique vide → résoudre le ticker
    if (!history || history.length === 0) {
      const resolved = await resolveSymbol(ticker)
      if (resolved !== ticker) {
        resolvedTicker = resolved
        history = await fetchHistory(resolved)
      }
    }

    if (!history || history.length === 0) {
      return { error: `Aucun historique disponible pour "${ticker}". Vérifiez le ticker (ex: CW8.PA pour Euronext Paris).` }
    }

    type HistoricalRow = { date: Date; open: number; high: number; low: number; close: number; volume: number }
    const prices = (history as HistoricalRow[]).slice(-50).map((h) => ({
      date: h.date.toISOString().split("T")[0],
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume,
    }))

    const first = prices[0].close
    const last = prices[prices.length - 1].close
    const perfPct = first > 0 ? ((last - first) / first) * 100 : 0

    return { ticker: resolvedTicker, period, interval, prices, performancePct: perfPct.toFixed(2) }
  } catch (err) {
    return { error: `Impossible de récupérer l'historique de ${ticker}: ${err instanceof Error ? err.message : String(err)}` }
  }
}
