import { getChartPrices } from "@/lib/market-data/get-chart-prices"
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

  try {
    const data = await getChartPrices(ticker, { period, interval })
    if ((data as any).error) return { error: (data as any).error }

    const prices = ((data as any).prices ?? []).slice(-50)
    const first = prices.length > 0 ? prices[0].close ?? 0 : 0
    const last = prices.length > 0 ? prices[prices.length - 1].close ?? 0 : 0
    const perfPct = first > 0 ? ((last - first) / first) * 100 : 0

    return { ticker: (data as any).ticker ?? ticker, period, interval, prices, performancePct: perfPct.toFixed(2) }
  } catch (err) {
    return { error: `Impossible de récupérer l'historique de ${ticker}: ${err instanceof Error ? err.message : String(err)}` }
  }
}
