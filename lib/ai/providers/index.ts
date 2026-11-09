import { aiSettings } from "../settings"
import { createProvider } from "./factory"

export type { AIProvider, AgentEvent, AgentEventType, ToolDefinition, ExecuteTool } from "./types"

export async function getProvider(userId: string) {
  const settings = await aiSettings.read(userId)
  if (!settings.provider) throw new Error("Aucun provider IA disponible. Configurez votre connexion personnelle dans les paramètres.")
  const credentials = await aiSettings.credentials(userId, settings.provider)
  if (!credentials) throw new Error("Aucun provider IA disponible. Configurez votre connexion personnelle dans les paramètres.")
  return createProvider(credentials)
}
