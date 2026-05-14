import { prisma } from "@/lib/db/client"
import { AnthropicProvider } from "./anthropic"
import { OpenAIProvider } from "./openai"
import type { AIProvider } from "./types"

export type { AIProvider, AgentEvent, AgentEventType, ToolDefinition, ExecuteTool } from "./types"

async function getConfig(): Promise<Record<string, string>> {
  const rows = await prisma.appConfig.findMany()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

/**
 * Retourne le provider IA configuré avec fallback automatique.
 * Ordre : configured → anthropic → openai → ollama → throw
 */
export async function getProvider(): Promise<AIProvider> {
  const cfg = await getConfig()

  const providerName = cfg["ai_provider"] ?? "anthropic"
  const model = cfg["ai_model"] ?? "claude-opus-4-6"
  const anthropicKey = cfg["anthropic_api_key"] ?? process.env.ANTHROPIC_API_KEY
  const openaiKey = cfg["openai_api_key"] ?? process.env.OPENAI_API_KEY
  const nvidiaKey = cfg["nvidia_api_key"] ?? process.env.NVIDIA_API_KEY
  const ollamaUrl = cfg["ollama_base_url"] ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
  const ollamaModel = cfg["ollama_model"] ?? "llama3.1"

  const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

  const candidates: AIProvider[] = []

  if (providerName === "anthropic") {
    candidates.push(new AnthropicProvider(model, anthropicKey))
    if (openaiKey) candidates.push(new OpenAIProvider({ apiKey: openaiKey, model: cfg["openai_model"] ?? "gpt-4o", name: "openai" }))
    if (nvidiaKey) candidates.push(new OpenAIProvider({ apiKey: nvidiaKey, baseURL: NVIDIA_BASE_URL, model: cfg["nvidia_model"] ?? "meta/llama-3.3-70b-instruct", name: "nvidia" }))
  } else if (providerName === "openai" && openaiKey) {
    candidates.push(new OpenAIProvider({ apiKey: openaiKey, model: cfg["openai_model"] ?? "gpt-4o", name: "openai" }))
    candidates.push(new AnthropicProvider(undefined, anthropicKey))
  } else if (providerName === "nvidia" && nvidiaKey) {
    candidates.push(new OpenAIProvider({ apiKey: nvidiaKey, baseURL: NVIDIA_BASE_URL, model: cfg["nvidia_model"] ?? "meta/llama-3.3-70b-instruct", name: "nvidia" }))
    candidates.push(new AnthropicProvider(undefined, anthropicKey))
  } else if (providerName === "ollama") {
    candidates.push(new OpenAIProvider({ baseURL: `${ollamaUrl}/v1`, model: ollamaModel, name: "ollama" }))
    candidates.push(new AnthropicProvider(undefined, anthropicKey))
  } else {
    // Fallback order
    candidates.push(new AnthropicProvider(undefined, anthropicKey))
    if (openaiKey) candidates.push(new OpenAIProvider({ apiKey: openaiKey, model: "gpt-4o", name: "openai" }))
    if (nvidiaKey) candidates.push(new OpenAIProvider({ apiKey: nvidiaKey, baseURL: NVIDIA_BASE_URL, model: cfg["nvidia_model"] ?? "meta/llama-3.3-70b-instruct", name: "nvidia" }))
    candidates.push(new OpenAIProvider({ baseURL: `${ollamaUrl}/v1`, model: ollamaModel, name: "ollama" }))
  }

  for (const candidate of candidates) {
    if (await candidate.isAvailable()) return candidate
  }

  throw new Error("Aucun provider IA disponible. Configurez une clé API dans les paramètres.")
}
