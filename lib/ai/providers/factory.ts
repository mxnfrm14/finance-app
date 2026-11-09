import type { AiProviderName } from "../config"
import { resolveAiBaseUrl } from "../endpoints"
import { AnthropicProvider } from "./anthropic"
import { OpenAIProvider } from "./openai"

export function createProvider(config: {
  provider: AiProviderName; model: string; protocol: string; baseUrl?: string; apiKey?: string
}) {
  const baseURL = resolveAiBaseUrl(config.provider, config.baseUrl)
  if (!config.apiKey && config.provider !== "compatible") {
    throw new Error("Aucun provider IA disponible. Enregistrez votre clé API personnelle dans les paramètres.")
  }
  if (config.provider === "anthropic") return new AnthropicProvider(config.model, config.apiKey!)
  if (config.protocol !== "responses" && config.protocol !== "chat-completions") {
    throw new Error("Protocole IA invalide. Enregistrez à nouveau votre configuration.")
  }
  return new OpenAIProvider({ apiKey: config.apiKey, model: config.model, protocol: config.protocol, baseURL, name: config.provider })
}
