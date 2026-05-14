import { prisma } from "@/lib/db/client"
import { computePruFromTransactions } from "@/lib/portfolio/pru-calculator"
import { fetchQuotes, resolveISINToTicker } from "@/lib/market-data/yahoo-finance"

export interface PositionSummary {
  id: string
  isin: string
  ticker: string | null
  name: string
  assetType: string
  accountType: string
  quantity: number
  pru: number
  currentPrice: number | null
  currentValue: number | null
  invested: number
  pnl: number | null
  pnlPct: number | null
  currency: string
  change1d: number | null
  change1dAbs: number | null
  brokerId: string
  brokerName: string
}

export interface PortfolioSummary {
  positions: PositionSummary[]
  totalInvested: number
  totalValue: number
  totalPnl: number
  totalPnlPct: number
  byAccountType: Record<string, { invested: number; value: number; pnl: number }>
}

/**
 * Calcule le résumé complet du portfolio depuis les transactions (pas les champs statiques Position).
 * RÈGLE : ne jamais utiliser Position.pru ou Position.quantity pour le P&L.
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const positions = await prisma.position.findMany({
    where: { userId, isActive: true },
    include: {
      transactions: {
        orderBy: { date: "asc" },
        select: { type: true, quantity: true, price: true, fees: true },
      },
      broker: { select: { id: true, name: true } },
    },
  })

  // Calcul PRU/qty depuis transactions pour chaque position active
  const computed = positions.map((pos) => ({
    pos,
    ...computePruFromTransactions(pos.transactions),
  })).filter(({ quantity }) => quantity > 0)

  // Résolution ISIN → ticker si nécessaire, puis fetch groupé
  // Paralléliser toutes les résolutions au lieu de les faire séquentiellement
  const tickerMap = new Map<string, string>() // positionId → ticker
  const withoutTicker = computed.filter(({ pos }) => !pos.ticker)

  // Positions déjà avec ticker : on les ajoute directement
  for (const { pos } of computed) {
    if (pos.ticker) tickerMap.set(pos.id, pos.ticker)
  }

  // Résolutions ISIN manquantes en parallèle
  if (withoutTicker.length > 0) {
    const resolutions = await Promise.all(
      withoutTicker.map(({ pos }) =>
        resolveISINToTicker(pos.isin).then((resolved) => ({ posId: pos.id, resolved }))
      )
    )
    for (const { posId, resolved } of resolutions) {
      if (resolved) tickerMap.set(posId, resolved)
    }
  }

  const uniqueTickers = [...new Set(tickerMap.values())]
  const quotes = uniqueTickers.length > 0
    ? await fetchQuotes(uniqueTickers).catch(() => new Map())
    : new Map()

  const summaries: PositionSummary[] = []

  for (const { pos, pru, quantity } of computed) {
    const invested = pru * quantity
    const ticker = tickerMap.get(pos.id) ?? null
    const quote = ticker ? quotes.get(ticker) ?? null : null

    const currentPrice = quote?.price ?? null
    const change1d = quote?.change1d ?? null
    const change1dAbs = quote?.change1dAbs ?? null
    const currentValue = currentPrice !== null ? currentPrice * quantity : null
    const pnl = currentValue !== null ? currentValue - invested : null
    const pnlPct = pnl !== null && invested > 0 ? (pnl / invested) * 100 : null

    summaries.push({
      id: pos.id,
      isin: pos.isin,
      ticker: ticker ?? pos.ticker,
      name: pos.name,
      assetType: pos.assetType,
      accountType: pos.accountType,
      quantity,
      pru,
      currentPrice,
      currentValue,
      invested,
      pnl,
      pnlPct,
      currency: pos.currency,
      change1d,
      change1dAbs,
      brokerId: pos.broker.id,
      brokerName: pos.broker.name,
    })
  }

  const totalInvested = summaries.reduce((s, p) => s + p.invested, 0)
  const totalValue = summaries.reduce((s, p) => s + (p.currentValue ?? p.invested), 0)
  const totalPnl = totalValue - totalInvested
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  const byAccountType: Record<string, { invested: number; value: number; pnl: number }> = {}
  for (const p of summaries) {
    const acc = byAccountType[p.accountType] ?? { invested: 0, value: 0, pnl: 0 }
    acc.invested += p.invested
    acc.value += p.currentValue ?? p.invested
    acc.pnl += p.pnl ?? 0
    byAccountType[p.accountType] = acc
  }

  return { positions: summaries, totalInvested, totalValue, totalPnl, totalPnlPct, byAccountType }
}

/**
 * Met à jour les champs pru/quantity en cache sur la Position (pour lecture rapide).
 * À appeler après chaque mutation de transaction.
 */
export async function syncPositionCache(positionId: string) {
  const txs = await prisma.transaction.findMany({
    where: { positionId },
    orderBy: { date: "asc" },
  })
  const { pru, quantity } = computePruFromTransactions(txs)
  await prisma.position.update({
    where: { id: positionId },
    data: { pru, quantity },
  })
  return { pru, quantity }
}
