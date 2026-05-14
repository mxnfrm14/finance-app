import YahooFinance from "yahoo-finance2"

// yahoo-finance2 v3 utilise une API basée sur les classes
// supprime le message de deprecation pour `historical()` (ripHistorical)
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })

export interface QuoteResult {
  ticker: string
  price: number
  currency: string
  change1d: number | null
  change1dAbs: number | null
}

export async function resolveISINToTicker(isin: string): Promise<string | null> {
  try {
    const results = await yahooFinance.search(isin, { quotesCount: 3, newsCount: 0 }, { validateResult: false })
    const quotes = (results as { quotes?: Array<{ symbol?: string }> }).quotes ?? []
    if (quotes.length > 0 && quotes[0].symbol) return quotes[0].symbol
    if (isin.startsWith("FR")) return isin.slice(0, 12) + ".PA"
    return null
  } catch {
    return null
  }
}

export async function fetchQuotes(tickers: string[]): Promise<Map<string, QuoteResult>> {
  const results = new Map<string, QuoteResult>()
  if (tickers.length === 0) return results
  try {
    const raw = await yahooFinance.quote(tickers, {}, { validateResult: false })
    const arr = Array.isArray(raw) ? raw : [raw]
    for (const q of arr) {
      const quote = q as {
        symbol?: string
        regularMarketPrice?: number
        currency?: string
        regularMarketChangePercent?: number
        regularMarketChange?: number
      }
      if (!quote.symbol) continue
      if (quote.regularMarketPrice == null) continue
      results.set(quote.symbol, {
        ticker: quote.symbol,
        price: quote.regularMarketPrice,
        currency: quote.currency ?? "EUR",
        change1d: quote.regularMarketChangePercent ?? null,
        change1dAbs: quote.regularMarketChange ?? null,
      })
    }
  } catch (err) {
    console.error("Yahoo Finance error:", err)
  }
  return results
}

/**
 * Résout un ticker abrégé vers son symbole canonique Yahoo Finance.
 * Ex: "CW8" → "CW8.PA", "total" → "TTE.PA"
 * Retourne le ticker original si aucune correspondance n'est trouvée.
 */
export async function resolveSymbol(ticker: string): Promise<string> {
  try {
    const results = await yahooFinance.search(ticker, { quotesCount: 3, newsCount: 0 }, { validateResult: false })
    const quotes = (results as { quotes?: Array<{ symbol?: string }> }).quotes ?? []
    return quotes[0]?.symbol ?? ticker
  } catch {
    return ticker
  }
}

export async function searchInstruments(query: string) {
  try {
    const results = await yahooFinance.search(query, { quotesCount: 10, newsCount: 0 }, { validateResult: false })
    const quotes = (results as { quotes?: Array<{ symbol?: string; shortname?: string; longname?: string; typeDisp?: string; exchDisp?: string }> }).quotes ?? []
    return quotes.filter((q) => q.symbol).map((q) => ({
      ticker: q.symbol!,
      name: q.longname ?? q.shortname ?? q.symbol!,
      type: q.typeDisp ?? "EQUITY",
      exchange: q.exchDisp ?? "",
    }))
  } catch {
    return []
  }
}

/**
 * Try to resolve a ticker to an ISIN using Yahoo search results metadata.
 * Returns null if no ISIN-like identifier is available.
 */
export async function resolveTickerToISIN(ticker: string): Promise<string | null> {
  try {
    const results = await yahooFinance.search(ticker, { quotesCount: 5, newsCount: 0 }, { validateResult: false })
    const quotes = (results as any).quotes ?? []
    // Some search results include an `id` or `uuid` field which can be an ISIN-like identifier.
    for (const q of quotes) {
      if (!q) continue
      if (q.symbol && q.symbol.toLowerCase() === ticker.toLowerCase()) {
        if (q.id && typeof q.id === "string" && q.id.match(/^[A-Z]{2}[0-9A-Z]{9}[0-9]$/)) return q.id
        if (q.isin && typeof q.isin === "string") return q.isin
        if (q.uuid && typeof q.uuid === "string" && q.uuid.match(/^[A-Z]{2}[0-9A-Z]{9}[0-9]$/)) return q.uuid
      }
    }
    // Fallback: for French ISINs, try to map FR... -> .PA ticker
    if (ticker.endsWith(".PA")) {
      // No direct ISIN from search; return null
      return null
    }
    return null
  } catch (err) {
    return null
  }
}
