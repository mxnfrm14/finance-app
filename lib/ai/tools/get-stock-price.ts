import YahooFinance from "yahoo-finance2"
import { resolveSymbol } from "@/lib/market-data/yahoo-finance"
import type { ToolDefinition } from "@/lib/ai/providers/types"

export const getStockPriceDefinition: ToolDefinition = {
  name: "get_stock_price",
  description: "Récupère le cours actuel d'une action ou ETF (prix, variation journalière, capitalisation, volume).",
  input_schema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Symbole boursier (ex: AAPL, MC.PA, BNP.PA, CW8.PA). Utilise search_instrument en cas de doute sur le ticker exact." },
    },
    required: ["ticker"],
  },
}

export async function getStockPrice(input: unknown) {
  const { ticker } = input as { ticker: string }
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })

  const fetchQuote = async (sym: string) => {
    const raw = await yf.quote(sym, {}, { validateResult: false })
    return raw as Record<string, unknown>
  }

  try {
    let q = await fetchQuote(ticker)
    let resolvedTicker = ticker

    // Pas de prix → résoudre le ticker (ex: CW8 → CW8.PA, total → TTE.PA)
    if (q["regularMarketPrice"] == null) {
      const resolved = await resolveSymbol(ticker)
      if (resolved !== ticker) {
        resolvedTicker = resolved
        q = await fetchQuote(resolved)
      }
    }

    if (q["regularMarketPrice"] == null) {
      return {
        error: `Cours introuvable pour "${ticker}". Essayez avec le ticker complet (ex: CW8.PA pour Euronext Paris, MC.PA pour LVMH).`,
      }
    }

    return {
      ticker: resolvedTicker,
      price: q["regularMarketPrice"],
      previousClose: q["regularMarketPreviousClose"],
      change: q["regularMarketChange"],
      changePercent: q["regularMarketChangePercent"],
      volume: q["regularMarketVolume"],
      marketCap: q["marketCap"],
      currency: q["currency"],
      shortName: q["shortName"],
      longName: q["longName"],
      marketState: q["marketState"],
      fiftyTwoWeekHigh: q["fiftyTwoWeekHigh"],
      fiftyTwoWeekLow: q["fiftyTwoWeekLow"],
    }
  } catch (err) {
    return { error: `Impossible de récupérer le cours de ${ticker}: ${err instanceof Error ? err.message : String(err)}` }
  }
}
