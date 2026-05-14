import YahooFinance from "yahoo-finance2"
import { resolveSymbol } from "@/lib/market-data/yahoo-finance"
import type { ToolDefinition } from "@/lib/ai/providers/types"

export const getEtfHoldingsDefinition: ToolDefinition = {
  name: "get_etf_holdings",
  description: "Récupère la composition d'un ETF : top holdings, secteurs, géographies. Utile pour analyser la diversification et les chevauchements entre ETFs.",
  input_schema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Ticker de l'ETF (ex: CW8.PA, EWLD.PA, SPY, QQQ)" },
    },
    required: ["ticker"],
  },
}

async function fetchEtfHoldings(ticker: string, yf: InstanceType<typeof YahooFinance>) {
  const summary = await yf.quoteSummary(
    ticker,
    { modules: ["topHoldings", "fundProfile"] },
    { validateResult: false }
  )

  const raw = summary as Record<string, unknown>
  const topHoldings = raw["topHoldings"] as Record<string, unknown> | null
  const fundProfile = raw["fundProfile"] as Record<string, unknown> | null

  if (!topHoldings) return null

  return {
    ticker,
    holdings: topHoldings["holdings"] ?? [],
    sectorWeightings: topHoldings["sectorWeightings"] ?? [],
    equityHoldings: topHoldings["equityHoldings"] ?? null,
    bondRatings: topHoldings["bondRatings"] ?? [],
    category: (fundProfile as Record<string, unknown> | null)?.["categoryName"] ?? null,
    familyName: (fundProfile as Record<string, unknown> | null)?.["family"] ?? null,
  }
}

export async function getEtfHoldings(input: unknown) {
  const { ticker } = input as { ticker: string }
  const yf = new YahooFinance()

  try {
    const result = await fetchEtfHoldings(ticker, yf)
    if (result) return result

    // topHoldings null → essayer la résolution du ticker (CW8 → CW8.PA)
    const resolved = await resolveSymbol(ticker)
    if (resolved !== ticker) {
      const retryResult = await fetchEtfHoldings(resolved, yf)
      if (retryResult) return retryResult
    }

    return {
      warning: `Aucune donnée de composition disponible pour "${ticker}". Cet instrument est peut-être une action et non un ETF, ou les données ne sont pas disponibles via Yahoo Finance.`,
    }
  } catch (err) {
    // En cas d'erreur (ticker non trouvé), essayer la résolution
    try {
      const resolved = await resolveSymbol(ticker)
      if (resolved !== ticker) {
        const retryResult = await fetchEtfHoldings(resolved, yf)
        if (retryResult) return retryResult
      }
    } catch {
      // ignore
    }
    return { error: `Impossible de récupérer la composition de "${ticker}": ${err instanceof Error ? err.message : String(err)}` }
  }
}
