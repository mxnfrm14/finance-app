import { z } from "zod"

export const PROVIDERS = ["anthropic", "openai", "compatible", "nvidia"] as const
export type AiProviderName = typeof PROVIDERS[number]
export type AiProtocol = "messages" | "responses" | "chat-completions"

export const PROVIDER_LABELS: Record<AiProviderName, string> = {
  anthropic: "Anthropic — clé API",
  openai: "OpenAI — clé API",
  compatible: "API compatible OpenAI",
  nvidia: "NVIDIA NIM",
}

export const PROVIDER_DEFAULTS: Record<AiProviderName, { baseUrl: string; protocol: AiProtocol }> = {
  anthropic: { baseUrl: "https://api.anthropic.com", protocol: "messages" },
  openai: { baseUrl: "https://api.openai.com/v1", protocol: "responses" },
  compatible: { baseUrl: "", protocol: "responses" },
  nvidia: { baseUrl: "https://integrate.api.nvidia.com/v1", protocol: "chat-completions" },
}

export const aiConfigSchema = z.object({
  provider: z.enum(PROVIDERS),
  model: z.string().trim().min(1, "Choisissez un modèle.").max(200),
  protocol: z.enum(["messages", "responses", "chat-completions"]),
  baseUrl: z.string().trim().max(2048).optional(),
  apiKey: z.string().trim().max(8192).optional(),
  removeApiKey: z.boolean().optional(),
}).superRefine((value, ctx) => {
  const required = PROVIDER_DEFAULTS[value.provider].protocol
  if (value.provider !== "compatible" && value.protocol !== required) {
    ctx.addIssue({ code: "custom", path: ["protocol"], message: "Protocole incompatible avec ce fournisseur." })
  }
  if (value.provider === "compatible" && value.protocol === "messages") {
    ctx.addIssue({ code: "custom", path: ["protocol"], message: "Choisissez Responses ou Chat Completions." })
  }
  if (value.provider === "compatible" && !value.baseUrl) {
    ctx.addIssue({ code: "custom", path: ["baseUrl"], message: "URL de l’API requise." })
  }
  if (value.removeApiKey && value.apiKey) {
    ctx.addIssue({ code: "custom", path: ["apiKey"], message: "Choisissez entre remplacer et supprimer la clé." })
  }
})

export type AiConfigInput = z.infer<typeof aiConfigSchema>
export interface PublicAiConnection {
  provider: AiProviderName
  model: string
  protocol: AiProtocol
  baseUrl: string
  hasApiKey: boolean
}
export interface PublicAiSettings {
  provider: AiProviderName | null
  connections: PublicAiConnection[]
}
