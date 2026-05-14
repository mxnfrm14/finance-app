import YahooFinance from "yahoo-finance2"
import type { ToolDefinition } from "@/lib/ai/providers/types"

export const searchNewsDefinition: ToolDefinition = {
  name: "search_news",
  description: "Recherche des actualités financières récentes sur un instrument ou un sujet. Si peu de résultats avec un ticker, réessayer avec le nom de l'entreprise (ex: 'CW8.PA' → 'Amundi MSCI World').",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Terme de recherche : ticker, nom d'entreprise, ou sujet macro (ex: 'MC.PA', 'LVMH', 'taux BCE')" },
      maxResults: { type: "string", description: "Nombre maximum de résultats (défaut: 5, max: 10)" },
    },
    required: ["query"],
  },
}

interface NewsItem {
  title: string
  source: string
  url: string
  publishedAt: string | null
  summary: string
}

async function fetchNewsFromApi(query: string, count: number): Promise<NewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=${count}&quotesCount=0`
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BourseApp/1.0)",
      "Accept": "application/json",
    },
    next: { revalidate: 300 },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const data = await response.json() as {
    news?: Array<{
      title?: string
      link?: string
      publisher?: string
      providerPublishTime?: number
      summary?: string
    }>
  }

  return (data.news ?? []).slice(0, count).map((n) => ({
    title: n.title ?? "",
    source: n.publisher ?? "",
    url: n.link ?? "",
    publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
    summary: n.summary ?? "",
  }))
}

async function fetchNewsFromSdk(query: string, count: number): Promise<NewsItem[]> {
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })
  const results = await yf.search(query, { quotesCount: 0, newsCount: count }, { validateResult: false })
  const news = (results as { news?: Array<Record<string, unknown>> }).news ?? []
  return news.slice(0, count).map((n) => ({
    title: String(n["title"] ?? ""),
    source: String(n["publisher"] ?? ""),
    url: String(n["link"] ?? ""),
    publishedAt: n["providerPublishTime"]
      ? new Date((n["providerPublishTime"] as number) * 1000).toISOString()
      : null,
    summary: String(n["summary"] ?? ""),
  }))
}

export async function searchNews(input: unknown) {
  const { query, maxResults = "5" } = input as { query: string; maxResults?: string }
  const count = Math.min(parseInt(maxResults, 10) || 5, 10)

  // Essai 1 : API directe Yahoo Finance
  try {
    const news = await fetchNewsFromApi(query, count)
    if (news.length > 0) return { query, count: news.length, news }

    // 0 résultats → essai 2 : SDK Yahoo Finance (endpoint légèrement différent)
    const sdkNews = await fetchNewsFromSdk(query, count)
    if (sdkNews.length > 0) return { query, count: sdkNews.length, news: sdkNews }

    return {
      query,
      count: 0,
      news: [],
      message: `Aucune actualité trouvée pour "${query}". Essayez avec le nom complet de l'entreprise ou d'autres mots-clés.`,
    }
  } catch {
    // Essai 2 sur erreur réseau
    try {
      const sdkNews = await fetchNewsFromSdk(query, count)
      if (sdkNews.length > 0) return { query, count: sdkNews.length, news: sdkNews }
      return {
        query,
        count: 0,
        news: [],
        message: `Service d'actualités temporairement indisponible pour "${query}". L'analyse continuera sans les news.`,
      }
    } catch (err2) {
      return {
        query,
        count: 0,
        news: [],
        message: `Impossible de récupérer les actualités: ${err2 instanceof Error ? err2.message : String(err2)}. Continuez l'analyse sans les news.`,
      }
    }
  }
}
