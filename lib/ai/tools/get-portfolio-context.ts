import { prisma } from "@/lib/db/client"
import { computePruFromTransactions } from "@/lib/portfolio/pru-calculator"
import type { ToolDefinition } from "@/lib/ai/providers/types"

export const getPortfolioContextDefinition: ToolDefinition = {
  name: "get_portfolio_context",
  description: "Lit le portfolio de l'utilisateur : positions actives, quantités, PRU, valeur investie par enveloppe (PEA, CTO, AV). Ne retourne pas les prix actuels — utiliser get_stock_price pour ça.",
  input_schema: {
    type: "object",
    properties: {},
  },
}

export function createGetPortfolioContext(userId: string) {
  return async (_input: unknown) => {
    try {
      const positions = await prisma.position.findMany({
        where: { userId, isActive: true },
        include: {
          transactions: { orderBy: { date: "asc" } },
          broker: { select: { name: true } },
        },
      })

      if (positions.length === 0) {
        return {
          positions: [],
          totalInvested: 0,
          byAccountType: {},
          positionCount: 0,
          message: "Le portfolio est vide. Aucune position active trouvée. Invitez l'utilisateur à ajouter des positions via l'onglet Portfolio.",
        }
      }

      const portfolio = positions.map((pos) => {
        const { pru, quantity } = computePruFromTransactions(pos.transactions)
        return {
          isin: pos.isin,
          ticker: pos.ticker,
          name: pos.name,
          assetType: pos.assetType,
          accountType: pos.accountType,
          broker: pos.broker.name,
          quantity: Math.round(quantity * 1000) / 1000,
          pru: Math.round(pru * 100) / 100,
          invested: Math.round(pru * quantity * 100) / 100,
          currency: pos.currency,
        }
      }).filter((p) => p.quantity > 0)

      const totalInvested = portfolio.reduce((s, p) => s + p.invested, 0)
      const byAccountType: Record<string, number> = {}
      for (const p of portfolio) {
        byAccountType[p.accountType] = (byAccountType[p.accountType] ?? 0) + p.invested
      }

      return {
        positions: portfolio,
        totalInvested: Math.round(totalInvested * 100) / 100,
        byAccountType,
        positionCount: portfolio.length,
      }
    } catch (err) {
      return {
        error: `Impossible de lire le portfolio: ${err instanceof Error ? err.message : String(err)}`,
        positions: [],
        totalInvested: 0,
        byAccountType: {},
        positionCount: 0,
      }
    }
  }
}
