import YahooFinance from "yahoo-finance2"
import { resolveSymbol } from "./yahoo-finance"

const yahooFinance = new YahooFinance()

export interface FundamentalsResult {
  ticker: string
  // Valorisation
  peRatio: number | null
  forwardPE: number | null
  eps: number | null
  priceToBook: number | null
  // Dividende
  dividendYield: number | null
  dividendRate: number | null
  // Risque
  beta: number | null
  // 52 semaines
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  // Descriptif
  sector: string | null
  industry: string | null
  description: string | null
  // Liquidité
  marketCap: number | null
  averageVolume: number | null
}

async function fetchFundamentals(ticker: string): Promise<FundamentalsResult> {
  const rawSummary = await yahooFinance.quoteSummary(
    ticker,
    { modules: ["summaryDetail", "assetProfile", "defaultKeyStatistics", "financialData"] },
    { validateResult: false }
  )

  const summary = rawSummary as Record<string, Record<string, unknown> | undefined>
  const sd = summary.summaryDetail
  const ap = summary.assetProfile
  const ks = summary.defaultKeyStatistics

  return {
    ticker,
    peRatio: (sd?.trailingPE as number) ?? null,
    forwardPE: (sd?.forwardPE as number) ?? null,
    eps: (ks?.trailingEps as number) ?? null,
    priceToBook: (ks?.priceToBook as number) ?? null,
    dividendYield: (sd?.dividendYield as number) ?? null,
    dividendRate: (sd?.dividendRate as number) ?? null,
    beta: (sd?.beta as number) ?? null,
    fiftyTwoWeekHigh: (sd?.fiftyTwoWeekHigh as number) ?? null,
    fiftyTwoWeekLow: (sd?.fiftyTwoWeekLow as number) ?? null,
    sector: (ap?.sector as string) ?? null,
    industry: (ap?.industry as string) ?? null,
    description: (ap?.longBusinessSummary as string) ?? null,
    marketCap: (sd?.marketCap as number) ?? null,
    averageVolume: (sd?.averageVolume as number) ?? null,
  }
}

export async function getFundamentals(ticker: string): Promise<FundamentalsResult | null> {
  try {
    return await fetchFundamentals(ticker)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ""
    // Ticker non trouvé → tenter la résolution (CW8 → CW8.PA, etc.)
    if (msg.includes("not found") || msg.includes("Not Found") || msg.includes("No fundamentals")) {
      try {
        const resolved = await resolveSymbol(ticker)
        if (resolved !== ticker) {
          return await fetchFundamentals(resolved)
        }
      } catch (err2) {
        console.error(`Fundamentals error for resolved ${ticker}:`, err2)
      }
    }
    console.error(`Fundamentals error for ${ticker}:`, err)
    return null
  }
}
