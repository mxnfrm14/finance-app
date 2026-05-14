import YahooFinance from "yahoo-finance2"
import { resolveSymbol } from "./yahoo-finance"

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] })

export type ChartPriceRow = {
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
}

export async function getChartPrices(
  ticker: string,
  opts?: { period?: string; interval?: string; period1?: string; period2?: string }
) {
  const { period = "6mo", interval = "1wk", period1, period2 } = opts ?? {}

  const end = period2 ? new Date(period2) : new Date()
  let start: Date
  if (period1) start = new Date(period1)
  else {
    start = new Date()
    const months: Record<string, number> = { "1mo": 1, "3mo": 3, "6mo": 6, "1y": 12, "2y": 24, "5y": 60 }
    start.setMonth(start.getMonth() - (months[period] ?? 6))
  }

  const chartOpts: Record<string, unknown> = {
    period1: start.toISOString().split("T")[0],
    period2: end.toISOString().split("T")[0],
    interval,
    return: "array",
  }

  try {
    let result = await yf.chart(ticker, chartOpts as any, { validateResult: false })

    // If no data, try resolving symbol (CW8 -> CW8.PA, etc.)
    if ((!result || (Array.isArray(result.quotes) && result.quotes.length === 0))) {
      const resolved = await resolveSymbol(ticker)
      if (resolved && resolved !== ticker) {
        result = await yf.chart(resolved, chartOpts as any, { validateResult: false })
      }
    }

    // Normalise result shape. When using `return: 'array'`, result has { meta, quotes }
    const quotes = (result?.quotes ?? []) as Array<any>

    const prices: ChartPriceRow[] = quotes.map((q) => ({
      date: q.date, // chart array returns ISO date strings already
      open: q.open ?? null,
      high: q.high ?? null,
      low: q.low ?? null,
      close: q.close ?? null,
      volume: q.volume ?? null,
    }))

    return {
      ticker: result?.meta?.symbol ?? ticker,
      range: result?.meta?.range ?? period,
      interval: result?.meta?.dataGranularity ?? interval,
      meta: result?.meta ?? null,
      events: result?.events ?? null,
      prices,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
