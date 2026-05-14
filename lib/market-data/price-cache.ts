import { prisma } from "@/lib/db/client"
import { resolveISINToTicker, fetchQuotes } from "./yahoo-finance"

const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export async function refreshPrices(isins: string[]): Promise<void> {
  if (isins.length === 0) return

  const positions = await prisma.position.findMany({
    where: { isin: { in: isins }, isActive: true },
    select: { isin: true, ticker: true },
  })
  const tickerByIsin = new Map(positions.map((p) => [p.isin, p.ticker]))

  // Résoudre les tickers manquants — en parallèle
  const toResolve = isins.filter((isin) => !tickerByIsin.get(isin))
  if (toResolve.length > 0) {
    const resolved = await Promise.all(
      toResolve.map((isin) =>
        resolveISINToTicker(isin).then((ticker) => ({ isin, ticker }))
      )
    )
    // Mettre à jour les positions sans ticker en une seule passe (updateMany par isin)
    await Promise.all(
      resolved
        .filter(({ ticker }) => Boolean(ticker))
        .map(({ isin, ticker }) => {
          tickerByIsin.set(isin, ticker!)
          return prisma.position.updateMany({
            where: { isin, ticker: null },
            data: { ticker: ticker! },
          })
        })
    )
  }

  const validTickers = [
    ...new Set(
      isins
        .map((isin) => tickerByIsin.get(isin))
        .filter((t): t is string => Boolean(t))
    ),
  ]
  const quotes = await fetchQuotes(validTickers)

  // Construire la map inverse ticker -> isins
  const isinsByTicker = new Map<string, string[]>()
  for (const [isin, ticker] of tickerByIsin.entries()) {
    if (!ticker) continue
    isinsByTicker.set(ticker, [...(isinsByTicker.get(ticker) ?? []), isin])
  }

  // Paralléliser tous les upserts de cache prix
  const upsertOps: Promise<unknown>[] = []
  for (const [ticker, quote] of quotes.entries()) {
    const affectedIsins = isinsByTicker.get(ticker) ?? []
    for (const isin of affectedIsins) {
      upsertOps.push(
        prisma.priceCache.upsert({
          where: { isin },
          update: {
            ticker,
            lastPrice: quote.price,
            currency: quote.currency,
            change1d: quote.change1d,
            change1dAbs: quote.change1dAbs,
            source: "yahoo",
          },
          create: {
            isin,
            ticker,
            lastPrice: quote.price,
            currency: quote.currency,
            change1d: quote.change1d,
            change1dAbs: quote.change1dAbs,
            source: "yahoo",
          },
        })
      )
    }
  }
  await Promise.all(upsertOps)
}

/**
 * Cache de prix par ticker (pour la page marché).
 * Utilise la colonne `isin` comme clé car le schéma n'a qu'une PK.
 * Les tickers de marché (^FCHI, CW8.PA, AAPL…) sont stockés tels quels.
 */
export async function getCachedQuotesByTicker(
  tickers: string[]
): Promise<Map<string, { price: number; currency: string; change1d: number | null; change1dAbs: number | null }>> {
  if (tickers.length === 0) return new Map()

  const now = Date.now()
  const cached = await prisma.priceCache.findMany({ where: { isin: { in: tickers } } })
  const cachedMap = new Map(cached.map((c) => [c.isin, c]))

  const stale = tickers.filter((t) => {
    const entry = cachedMap.get(t)
    if (!entry) return true
    return now - entry.fetchedAt.getTime() > CACHE_TTL_MS
  })

  if (stale.length > 0) {
    const fresh = await fetchQuotes(stale)
    // Paralléliser tous les upserts
    await Promise.all(
      [...fresh.entries()].map(([ticker, quote]) =>
        prisma.priceCache.upsert({
          where: { isin: ticker },
          update: { ticker, lastPrice: quote.price, currency: quote.currency, change1d: quote.change1d, change1dAbs: quote.change1dAbs },
          create: { isin: ticker, ticker, lastPrice: quote.price, currency: quote.currency, change1d: quote.change1d, change1dAbs: quote.change1dAbs },
        })
      )
    )
    const fetchedAt = new Date()
    for (const [ticker, quote] of fresh.entries()) {
      cachedMap.set(ticker, {
        isin: ticker, ticker,
        lastPrice: quote.price, currency: quote.currency,
        change1d: quote.change1d, change1dAbs: quote.change1dAbs,
        fetchedAt, source: "yahoo",
      })
    }
  }

  const result = new Map<string, { price: number; currency: string; change1d: number | null; change1dAbs: number | null }>()
  for (const ticker of tickers) {
    const entry = cachedMap.get(ticker)
    if (entry) result.set(ticker, { price: entry.lastPrice, currency: entry.currency, change1d: entry.change1d, change1dAbs: entry.change1dAbs })
  }
  return result
}

export async function getCachedPrices(isins: string[]) {
  const cached = await prisma.priceCache.findMany({ where: { isin: { in: isins } } })
  const now = Date.now()
  // Utiliser une Map pour éviter le scan linéaire O(n²) avec .find()
  const cachedByIsin = new Map(cached.map((c) => [c.isin, c]))
  const staleIsins = isins.filter((isin) => {
    const entry = cachedByIsin.get(isin)
    if (!entry) return true
    return now - entry.fetchedAt.getTime() > CACHE_TTL_MS
  })
  if (staleIsins.length > 0) {
    await refreshPrices(staleIsins)
    return prisma.priceCache.findMany({ where: { isin: { in: isins } } })
  }
  return cached
}
