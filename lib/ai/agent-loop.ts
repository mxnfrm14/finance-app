import { getProvider } from "./providers"
import { ALL_TOOL_DEFINITIONS, createToolExecutor } from "./tools"
import type { AgentEvent } from "./providers/types"

export type { AgentEvent }

export interface AgentRequest {
  message: string
  mode: "portfolio" | "instrument" | "market"
  target?: string   // ticker/ISIN pour mode "instrument"
  userId: string
  history?: Array<{ role: "user" | "assistant"; content: string }>
}

function buildSystemPrompt(mode: AgentRequest["mode"], target?: string): string {
  const today = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" })
  const base = `Tu es un analyste financier expert. Aujourd'hui c'est le ${today}. Tu réponds toujours en français.
Tu as accès à des outils pour récupérer des données de marché en temps réel.
Tes analyses sont factuelles, nuancées et pédagogiques. Tu mentionnes toujours les risques.
Tu ne fournis pas de conseils d'investissement personnalisés au sens légal du terme — tu fournis une analyse de marché.

Règles importantes sur les données :
- Si un outil retourne une erreur ou des données vides, RÉESSAIE avec un ticker alternatif (ex: ajouter ".PA" pour Euronext Paris) ou un libellé différent avant de conclure.
- Pour les ETF : les fondamentaux (PE, EPS, beta) sont souvent null ou non disponibles — c'est normal. Concentre-toi sur le cours, la performance historique et la composition.
- Si les données sont insuffisantes pour une recommandation fiable, dis-le explicitement : "Données insuffisantes pour une recommandation." Ne formule JAMAIS un BUY/HOLD/SELL avec un score de conviction < 3 sans au moins le cours et une donnée contextuelle.`

  if (mode === "portfolio") {
    return `${base}

Tu analyses le portfolio de l'utilisateur. Commence par appeler get_portfolio_context pour voir les positions actuelles.
Ensuite, pour chaque position significative, récupère le cours actuel avec get_stock_price.
Donne une analyse globale : diversification, concentration des risques, performance estimée, suggestions de rééquilibrage.`
  }

  if (mode === "instrument" && target) {
    return `${base}

L'utilisateur veut analyser l'instrument : ${target}
IMPORTANT : si le ticker ne contient pas de point (ex: "CW8", "total", "bnp"), commence par appeler
search_instrument pour trouver le ticker canonique Yahoo Finance (ex: CW8 → CW8.PA, total → TTE.PA).
Utilise ce ticker canonique pour tous les appels suivants.
Enchaîne ensuite : get_stock_price → get_fundamentals → search_news → get_historical_prices (6 mois).
Conclue avec une recommandation BUY / HOLD / SELL avec score de conviction (1-10) et les risques principaux.`
  }

  return `${base}

L'utilisateur pose une question sur les marchés financiers en général.
Utilise search_instrument pour trouver les tickers si l'utilisateur mentionne des actifs spécifiques.
Tu peux suggérer des ETFs adaptés à différents profils de risque.`
}

export async function* runAgentStream(req: AgentRequest): AsyncGenerator<AgentEvent> {
  const executor = createToolExecutor(req.userId)
  const provider = await getProvider()

  const systemPrompt = buildSystemPrompt(req.mode, req.target)

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...(req.history ?? []),
    { role: "user", content: req.message },
  ]

  yield* provider.runAgentStream(messages, ALL_TOOL_DEFINITIONS, systemPrompt, executor)
}
