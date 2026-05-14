import type { Metadata } from "next"

import { getChartPrices } from "@/lib/market-data/get-chart-prices"
import { getFundamentals } from "@/lib/market-data/fundamentals"
import MarketDetailClient from "@/components/market/market-detail-client"

type Props = { params: Promise<{ ticker: string }> | { ticker: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params)
  const ticker = resolvedParams.ticker

  const chart = await getChartPrices(ticker, { period: "1mo", interval: "1d" })
  const chartMeta =
    chart && typeof chart === "object" && "meta" in chart
      ? (chart.meta as { shortName?: string; longName?: string } | null)
      : null
  const instrumentName = chartMeta?.shortName ?? chartMeta?.longName ?? ticker

  return {
    title: `${instrumentName} — Marché`,
    description: `Détail de l'instrument ${instrumentName}`,
  }
}

export default async function Page({ params }: Props) {
  const resolvedParams = await Promise.resolve(params)
  const ticker = resolvedParams?.ticker

  if (!ticker) {
    return null
  }

  const [chart, fundamentals] = await Promise.all([
    getChartPrices(ticker, { period: "1y", interval: "1d" }),
    getFundamentals(ticker),
  ])

  const chartData = chart as {
    prices?: Array<{
      date: string
      open: number | null
      high: number | null
      low: number | null
      close: number | null
      volume: number | null
    }>
    ticker?: string
    meta?: {
      currency?: string
      regularMarketPrice?: number | null
      chartPreviousClose?: number | null
      regularMarketChange?: number | null
      regularMarketChangePercent?: number | null
    }
  }
  const prices = chartData.prices ?? []
  const displayTicker = chartData.ticker ?? ticker
  const currency = chartData.meta?.currency ?? "EUR"
  const instrumentName =
    (chartData.meta as { shortName?: string; longName?: string } | null)?.shortName ??
    (chartData.meta as { shortName?: string; longName?: string } | null)?.longName ??
    displayTicker

  return (
    <MarketDetailClient
      ticker={ticker}
      displayTicker={displayTicker}
      instrumentName={instrumentName}
      fundamentals={fundamentals}
      initialPrices={prices}
      initialCurrency={currency}
      initialChartMeta={chartData.meta ?? null}
    />
  )
}
