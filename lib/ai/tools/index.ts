import { getStockPriceDefinition, getStockPrice } from "./get-stock-price"
import { getFundamentalsDefinition, getFundamentalsHandler } from "./get-fundamentals"
import { getHistoricalPricesDefinition, getHistoricalPrices } from "./get-historical-prices"
import { searchNewsDefinition, searchNews } from "./search-news"
import { getPortfolioContextDefinition, createGetPortfolioContext } from "./get-portfolio-context"
import { searchInstrumentDefinition, searchInstrument } from "./search-instrument"
import { getEtfHoldingsDefinition, getEtfHoldings } from "./get-etf-holdings"
import type { ToolDefinition } from "@/lib/ai/providers/types"

export const ALL_TOOL_DEFINITIONS: ToolDefinition[] = [
  getStockPriceDefinition,
  getFundamentalsDefinition,
  getHistoricalPricesDefinition,
  searchNewsDefinition,
  getPortfolioContextDefinition,
  searchInstrumentDefinition,
  getEtfHoldingsDefinition,
]

/** Crée le registry d'exécution des outils pour un userId donné */
export function createToolExecutor(userId: string) {
  const getPortfolioContext = createGetPortfolioContext(userId)

  const registry: Record<string, (input: unknown) => Promise<unknown>> = {
    get_stock_price: getStockPrice,
    get_fundamentals: getFundamentalsHandler,
    get_historical_prices: getHistoricalPrices,
    search_news: searchNews,
    get_portfolio_context: getPortfolioContext,
    search_instrument: searchInstrument,
    get_etf_holdings: getEtfHoldings,
  }

  return async (name: string, input: unknown): Promise<unknown> => {
    const fn = registry[name]
    if (!fn) throw new Error(`Outil inconnu: ${name}`)
    return fn(input)
  }
}
