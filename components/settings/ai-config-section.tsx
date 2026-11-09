"use client"

import { useEffect, useState } from "react"
import { Cpu, Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROVIDERS, PROVIDER_DEFAULTS, PROVIDER_LABELS, type AiConfigInput, type AiProviderName, type AiProtocol, type PublicAiSettings } from "@/lib/ai/config"

function emptyConfig(provider: AiProviderName): AiConfigInput {
  return { provider, ...PROVIDER_DEFAULTS[provider], model: "", apiKey: "" }
}

export function AiConfigSection() {
  const [settings, setSettings] = useState<PublicAiSettings>({ provider: null, connections: [] })
  const [draft, setDraft] = useState<AiConfigInput>(emptyConfig("anthropic"))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<"save" | "test" | "delete" | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState("")
  const connection = settings.connections.find((c) => c.provider === draft.provider)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/settings/ai", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Impossible de charger les connexions IA.")
        return data as PublicAiSettings
      })
      .then((data) => {
        setSettings(data)
        const saved = data.connections.find((c) => c.provider === data.provider)
        if (saved) setDraft({ provider: saved.provider, model: saved.model, protocol: saved.protocol, baseUrl: saved.baseUrl, apiKey: "" })
      })
      .catch((err) => { if (!controller.signal.aborted) setLoadError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  function edit(patch: Partial<AiConfigInput>) {
    setDraft((value) => ({ ...value, ...patch }))
    setTestResult("")
    setError("")
  }

  function selectProvider(provider: AiProviderName) {
    const saved = settings.connections.find((c) => c.provider === provider)
    setDraft(saved ? { provider, model: saved.model, protocol: saved.protocol, baseUrl: saved.baseUrl, apiKey: "" } : emptyConfig(provider))
    setShowKey(false)
    setError("")
    setTestResult("")
  }

  async function perform(action: "save" | "test" | "delete") {
    setBusy(action)
    setError("")
    setTestResult("")
    try {
      const res = await fetch(`/api/settings/ai${action === "test" ? "/test" : ""}`, {
        method: action === "delete" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "delete" ? { provider: draft.provider } : draft),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error === "AUTH_ERROR" ? "Clé API invalide ou expirée." : data.error === "RATE_LIMIT" ? "Quota ou limite de requêtes atteint." : data.error ?? "La requête a échoué.")
      if (action === "test") {
        setTestResult(data.message)
      } else {
        setSettings(data)
        setDraft((value) => action === "delete" ? emptyConfig(value.provider) : { ...value, apiKey: "" })
        setShowKey(false)
        toast.success(action === "delete" ? "Connexion personnelle supprimée" : "Configuration personnelle enregistrée")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "La requête a échoué.")
    } finally { setBusy(null) }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><Cpu className="size-4 text-muted-foreground" /><CardTitle>Connexions IA personnelles</CardTitle></div>
        <CardDescription>Votre clé et vos préférences sont propres à votre compte. Chaque fournisseur conserve sa propre configuration.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading && <p className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />Chargement des connexions…</p>}
        {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
        <form onSubmit={(event) => { event.preventDefault(); void perform("save") }}>
          <fieldset disabled={loading || !!loadError || !!busy} className="flex flex-col gap-4 disabled:opacity-60">
            <div className="space-y-1.5">
              <Label htmlFor="ai-provider">Fournisseur</Label>
              <Select value={draft.provider} onValueChange={(value) => { if (value) selectProvider(value as AiProviderName) }}>
                <SelectTrigger id="ai-provider" className="w-full max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map((provider) => <SelectItem key={provider} value={provider}>{PROVIDER_LABELS[provider]}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Connexion active : {settings.provider ? PROVIDER_LABELS[settings.provider] : "aucune"}. Enregistrer active le fournisseur choisi.</p>
            </div>
            {draft.provider === "compatible" && <>
              <div className="space-y-1.5">
                <Label htmlFor="ai-url">URL de base de l’API</Label>
                <Input id="ai-url" type="url" required placeholder="https://votre-fournisseur.example/v1" value={draft.baseUrl ?? ""} onChange={(e) => edit({ baseUrl: e.target.value })} className="max-w-lg" />
                <p className="text-xs text-muted-foreground">Utilisez l’URL fournie par votre service, sans ajouter /responses ou /chat/completions.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-protocol">Format accepté par votre fournisseur</Label>
                <Select value={draft.protocol} onValueChange={(value) => { if (value) edit({ protocol: value as AiProtocol }) }}>
                  <SelectTrigger id="ai-protocol" className="w-full max-w-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="responses">Responses</SelectItem><SelectItem value="chat-completions">Chat Completions</SelectItem></SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">La compatibilité Chat Completions ne garantit pas celle de Responses.</p>
              </div>
            </>}
            <div className="space-y-1.5">
              <Label htmlFor="ai-key">Clé API personnelle{draft.provider === "compatible" ? " (facultative si votre serveur n’en demande pas)" : ""}</Label>
              <div className="relative max-w-lg">
                <Input id="ai-key" type={showKey ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder={connection?.hasApiKey ? "Clé enregistrée — laisser vide pour la conserver" : "Votre clé API"} value={draft.apiKey ?? ""} onChange={(e) => edit({ apiKey: e.target.value })} className="pr-10" />
                <button type="button" aria-label={showKey ? "Masquer la clé API" : "Afficher la clé API"} onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </div>
              <p className="text-xs text-muted-foreground">{connection?.hasApiKey ? "Une clé chiffrée est enregistrée pour ce fournisseur. " : ""}La clé enregistrée n’est jamais renvoyée au navigateur.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-model">Identifiant du modèle</Label>
              <Input id="ai-model" required maxLength={200} value={draft.model} onChange={(e) => edit({ model: e.target.value })} placeholder="Identifiant exact fourni par votre service" className="max-w-lg" />
              <p className="text-xs text-muted-foreground">Choisissez un modèle accessible à votre compte et prenant en charge les appels d’outils.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm">{busy === "save" && <Loader2 className="size-4 animate-spin" />}Enregistrer</Button>
              <Button type="button" variant="outline" size="sm" disabled={!draft.model.trim()} onClick={() => void perform("test")}>{busy === "test" && <Loader2 className="size-4 animate-spin" />}Tester la connexion</Button>
              {connection && <Button type="button" variant="ghost" size="sm" onClick={() => void perform("delete")}>{busy === "delete" && <Loader2 className="size-4 animate-spin" />}Supprimer cette connexion</Button>}
            </div>
            <p className="text-xs text-muted-foreground">Le test envoie une courte requête avec un outil de vérification et peut consommer du crédit API. Il ne sauvegarde pas la configuration.</p>
          </fieldset>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {testResult && <p role="status" className="text-sm text-green-600 dark:text-green-400">{testResult}</p>}
        <div className="border-t pt-5 space-y-4">
          <p className="text-sm font-medium">Abonnements ChatGPT et Claude</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium">Abonnement ChatGPT — non connecté</p>
              <p className="text-xs text-muted-foreground">L’utilisation du forfait nécessite une connexion officielle et un accès éligible. Pour cette application hébergée et partagée, l’accès doit être validé par OpenAI avant activation.</p>
              <a className="text-xs text-primary underline underline-offset-4" href="https://developers.openai.com/siwc/token-sharing-open-source" target="_blank" rel="noopener noreferrer">Conditions de connexion ChatGPT</a>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium">Abonnement Claude — non connecté</p>
              <p className="text-xs text-muted-foreground">Anthropic demande une approbation pour proposer une connexion Claude dans un produit tiers. Utilisez une clé API personnelle ; les crédits inclus dans un forfait éligible peuvent financer cette API.</p>
              <a className="text-xs text-primary underline underline-offset-4" href="https://code.claude.com/docs/en/agent-sdk/quickstart" target="_blank" rel="noopener noreferrer">Conditions de connexion Claude</a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
