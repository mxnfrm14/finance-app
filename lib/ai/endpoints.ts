import { PROVIDER_DEFAULTS, type AiProviderName } from "./config"

// Additional destinations are an operator decision: users must not gain arbitrary
// access to the home server's LAN, metadata services or other local services.
const PUBLIC_ORIGINS = [
  "https://openrouter.ai", "https://api.mistral.ai", "https://api.groq.com",
  "https://api.deepseek.com", "https://api.x.ai", "https://generativelanguage.googleapis.com",
  "https://integrate.api.nvidia.com", "https://api.openai.com",
]

export function resolveAiBaseUrl(provider: AiProviderName, baseUrl?: string): string {
  const custom = provider === "compatible"
  const raw = custom ? baseUrl : PROVIDER_DEFAULTS[provider].baseUrl
  let url: URL
  try { url = new URL(raw ?? "") } catch { throw new Error("URL de l’API invalide.") }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("L’URL doit utiliser HTTP(S), sans identifiants, paramètres ni fragment.")
  }
  if (custom) {
    const allowed = [...PUBLIC_ORIGINS, ...(process.env.AI_ALLOWED_API_ORIGINS ?? "").split(",").map((v) => v.trim()).filter(Boolean)]
    if (!allowed.includes(url.origin)) {
      throw new Error("Ce serveur IA doit être autorisé par l’administrateur dans AI_ALLOWED_API_ORIGINS.")
    }
  }
  return url.toString().replace(/\/+$/, "")
}

export function createAiFetch(baseUrl: string, fetchImpl: typeof fetch = fetch): typeof fetch {
  const base = new URL(baseUrl)
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.origin !== base.origin || !(url.pathname === base.pathname || url.pathname.startsWith(`${base.pathname.replace(/\/$/, "")}/`))) {
      throw new Error("Destination IA non autorisée.")
    }
    // Never forward a personal API key to a redirect destination.
    return fetchImpl(input, { ...init, redirect: "error" })
  }
}
