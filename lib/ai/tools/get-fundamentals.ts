import { getFundamentals } from "@/lib/market-data/fundamentals"
import type { ToolDefinition } from "@/lib/ai/providers/types"

export const getFundamentalsDefinition: ToolDefinition = {
  name: "get_fundamentals",
  description: "Récupère les données fondamentales d'une entreprise : valorisation (PE, PEG), rentabilité (ROE, marges), dividendes, bilan. Utile pour l'analyse fondamentale.",
  input_schema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Symbole boursier (ex: AAPL, MC.PA)" },
    },
    required: ["ticker"],
  },
}

export async function getFundamentalsHandler(input: unknown) {
  const { ticker } = input as { ticker: string }
  try {
    return await getFundamentals(ticker)
  } catch (err) {
    return { error: `Impossible de récupérer les fondamentaux de ${ticker}: ${err instanceof Error ? err.message : String(err)}` }
  }
}
