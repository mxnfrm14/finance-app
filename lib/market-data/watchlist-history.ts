import YahooFinance from "yahoo-finance2"

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })

export type HistoricalPerf = {
  isin: string
  ytdPrice: number | null
  y1Price: number | null
}

/**
 * Récupère les prix de référence YTD et 1 an pour les éléments de la watchlist.
 * Fenêtres de 5 jours autour de chaque date de référence pour minimiser le volume de données.
 * Les erreurs sont non-fatales — null = "N/A" dans l'UI.
 */
export async function fetchHistoricalPerf(
  items: Array<{ isin: string; ticker: string }>
): Promise<Map<string, HistoricalPerf>> {
  const results = new Map<string, HistoricalPerf>()
  if (items.length === 0) return results

  const now = new Date()
  const jan1 = new Date(now.getFullYear(), 0, 1)
  const y1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  const fiveDays = 5 * 24 * 60 * 60 * 1000

  await Promise.allSettled(
    items.map(async ({ isin, ticker }) => {
      try {
        const [ytdResult, y1Result] = await Promise.allSettled([
          yahooFinance.historical(
            ticker,
            { period1: jan1, period2: new Date(jan1.getTime() + fiveDays), interval: "1d" },
            { validateResult: false }
          ),
          yahooFinance.historical(
            ticker,
            { period1: y1, period2: new Date(y1.getTime() + fiveDays), interval: "1d" },
            { validateResult: false }
          ),
        ])

        results.set(isin, {
          isin,
          ytdPrice:
            ytdResult.status === "fulfilled" && ytdResult.value.length > 0
              ? ytdResult.value[0].close
              : null,
          y1Price:
            y1Result.status === "fulfilled" && y1Result.value.length > 0
              ? y1Result.value[0].close
              : null,
        })
      } catch {
        results.set(isin, { isin, ytdPrice: null, y1Price: null })
      }
    })
  )

  return results
}
