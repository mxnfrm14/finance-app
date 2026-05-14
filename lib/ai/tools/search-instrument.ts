import YahooFinance from "yahoo-finance2"
import type { ToolDefinition } from "@/lib/ai/providers/types"

export const searchInstrumentDefinition: ToolDefinition = {
  name: "search_instrument",
  description: "Recherche un instrument financier par nom, ticker ou ISIN. Retourne les symboles canoniques Yahoo Finance. À utiliser en premier pour résoudre un ticker abrégé (ex: 'CW8' → 'CW8.PA').",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Nom de l'entreprise, ticker ou ISIN (ex: 'LVMH', 'MC.PA', 'FR0000121014', 'CW8')" },
    },
    required: ["query"],
  },
}

export async function searchInstrument(input: unknown) {
  const { query } = input as { query: string }
  const yf = new YahooFinance()

  try {
    const results = await yf.search(query, { quotesCount: 8, newsCount: 0 }, { validateResult: false })
    const quotes = (results as { quotes?: Array<Record<string, unknown>> }).quotes ?? []

    if (quotes.length === 0) {
      // Fallback : tenter une recherche plus courte si la query contient un code bourse
      const shortened = query.split(".")[0]
      if (shortened !== query) {
        const retry = await yf.search(shortened, { quotesCount: 8, newsCount: 0 }, { validateResult: false })
        const retryQuotes = (retry as { quotes?: Array<Record<string, unknown>> }).quotes ?? []
        if (retryQuotes.length > 0) {
          return {
            query,
            results: retryQuotes.slice(0, 8).map((q) => ({
              ticker: q["symbol"],
              name: q["shortname"] ?? q["longname"],
              exchange: q["exchDisp"] ?? q["exchange"],
              type: q["quoteType"],
            })),
          }
        }
      }
      return {
        query,
        results: [],
        message: `Aucun instrument trouvé pour "${query}". Essayez avec un nom d'entreprise, un ISIN ou un ticker complet (ex: CW8.PA au lieu de CW8).`,
      }
    }

    return {
      query,
      results: quotes.slice(0, 8).map((q) => ({
        ticker: q["symbol"],
        name: q["shortname"] ?? q["longname"],
        exchange: q["exchDisp"] ?? q["exchange"],
        type: q["quoteType"],
      })),
    }
  } catch (err) {
    return { error: `Recherche échouée pour "${query}": ${err instanceof Error ? err.message : String(err)}` }
  }
}
