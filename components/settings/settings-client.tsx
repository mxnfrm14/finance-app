"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  User,
  Cpu,
  Building2,
  Plus,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Check,
} from "lucide-react"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLanguage } from "@/lib/i18n/context"

// ─── Types ────────────────────────────────────────────────────────────────────

type AiProvider = "anthropic" | "openai" | "nvidia" | "ollama"

interface Broker {
  id: string
  name: string
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const NVIDIA_MODELS = [
  { value: "meta/llama-3.3-70b-instruct",                label: "Llama 3.3 70B Instruct" },
  { value: "meta/llama-3.1-405b-instruct",               label: "Llama 3.1 405B Instruct" },
  { value: "nvidia/llama-3.1-nemotron-70b-instruct-hf",  label: "Nemotron 70B Instruct" },
  { value: "mistralai/mistral-large-2-instruct",          label: "Mistral Large 2" },
  { value: "mistralai/mixtral-8x22b-instruct-v0.1",       label: "Mixtral 8x22B" },
  { value: "google/gemma-2-27b-it",                       label: "Gemma 2 27B" },
  { value: "microsoft/phi-3.5-mini-instruct",             label: "Phi-3.5 Mini (rapide)" },
] as const

const aiConfigSchema = z.object({
  provider: z.enum(["anthropic", "openai", "nvidia", "ollama"]),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
})

type AiConfigValues = z.infer<typeof aiConfigSchema>

const addBrokerSchema = z.object({
  name: z.string().min(1, "Nom requis"),
})

type AddBrokerValues = z.infer<typeof addBrokerSchema>

// ─── Section: Compte ─────────────────────────────────────────────────────────

function AccountSection({ email }: { email: string }) {
  const { language, setLanguage } = useLanguage()
  const [isSaving, setIsSaving] = useState(false)

  const handleLanguageChange = async (value: string | null) => {
    if (!value) return
    const lang = value as "fr" | "en"
    setIsSaving(true)
    try {
      await setLanguage(lang)
      toast.success("Langue mise à jour")
    } catch {
      toast.error("Erreur lors de la mise à jour de la langue")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground" />
          <CardTitle>Compte</CardTitle>
        </div>
        <CardDescription>
          Informations de votre compte et préférences d&apos;affichage.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input
            id="email"
            value={email}
            readOnly
            disabled
            className="max-w-sm bg-muted/50 cursor-default"
          />
          <p className="text-xs text-muted-foreground">
            L&apos;email ne peut pas être modifié ici. Contactez un administrateur.
          </p>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="language">Langue de l&apos;interface</Label>
          <div className="flex items-center gap-3">
            <Select
              value={language}
              onValueChange={handleLanguageChange}
              disabled={isSaving}
            >
              <SelectTrigger id="language" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            {isSaving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Section: Configuration IA ───────────────────────────────────────────────

function AiConfigSection() {
  const [provider, setProvider] = useState<AiProvider>("anthropic")
  const [showKey, setShowKey] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AiConfigValues>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: {
      provider: "anthropic",
      apiKey: "",
      model: "",
      baseUrl: "http://localhost:11434",
    },
  })

  // Charger la config existante
  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => r.ok ? r.json() : null)
      .then((cfg: Record<string, string> | null) => {
        if (!cfg) return
        const p = (cfg["ai_provider"] as AiProvider) ?? "anthropic"
        setProvider(p)
        setValue("provider", p)
        const modelKey = p === "openai" ? "openai_model" : p === "nvidia" ? "nvidia_model" : p === "ollama" ? "ollama_model" : "ai_model"
        if (cfg[modelKey]) setValue("model", cfg[modelKey])
        if (cfg["ollama_base_url"]) setValue("baseUrl", cfg["ollama_base_url"])
      })
      .catch(() => {})
  }, [setValue])

  const handleProviderChange = (value: string | null) => {
    if (!value) return
    const p = value as AiProvider
    setProvider(p)
    setIsSaved(false)
    setValue("provider", p)
    if (p === "openai") setValue("model", "gpt-4o-mini")
    else if (p === "nvidia") setValue("model", "meta/llama-3.3-70b-instruct")
    else if (p === "ollama") {
      setValue("baseUrl", "http://localhost:11434")
      setValue("model", "llama3.1")
    } else {
      setValue("model", "claude-opus-4-6")
    }
  }

  const onSubmit = async (data: AiConfigValues) => {
    try {
      const res = await fetch("/api/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Erreur serveur")
      setIsSaved(true)
      toast.success("Configuration IA sauvegardée")
      setTimeout(() => setIsSaved(false), 3000)
    } catch {
      toast.error("Impossible de sauvegarder la configuration")
    }
  }

  const PROVIDER_LABELS: Record<AiProvider, string> = {
    anthropic: "Anthropic (Claude)",
    openai: "OpenAI",
    nvidia: "NVIDIA NIM",
    ollama: "Ollama (local)",
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-muted-foreground" />
          <CardTitle>Configuration IA</CardTitle>
        </div>
        <CardDescription>
          Choisissez le provider IA utilisé par l&apos;agent d&apos;analyse.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="ai-provider" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="nvidia">NVIDIA NIM</SelectItem>
                <SelectItem value="ollama">Ollama (local)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Provider actif :{" "}
              <span className="font-medium">{PROVIDER_LABELS[provider]}</span>.
              Fallback automatique : Anthropic → OpenAI → Ollama.
            </p>
          </div>

          <Separator />

          {provider === "anthropic" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="anthropic-key">Clé API Anthropic</Label>
              <div className="relative max-w-sm">
                <Input
                  id="anthropic-key"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-ant-..."
                  className="pr-10"
                  {...register("apiKey")}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.apiKey && (
                <p className="text-xs text-destructive">{errors.apiKey.message}</p>
              )}
            </div>
          )}

          {provider === "openai" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="openai-key">Clé API OpenAI</Label>
                <div className="relative max-w-sm">
                  <Input
                    id="openai-key"
                    type={showKey ? "text" : "password"}
                    placeholder="sk-..."
                    className="pr-10"
                    {...register("apiKey")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="openai-model">Modèle</Label>
                <Input id="openai-model" placeholder="gpt-4o-mini" className="max-w-sm" {...register("model")} />
                <p className="text-xs text-muted-foreground">gpt-4o, gpt-4o-mini, gpt-4-turbo</p>
              </div>
            </div>
          )}

          {provider === "nvidia" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nvidia-key">Clé API NVIDIA</Label>
                <div className="relative max-w-sm">
                  <Input
                    id="nvidia-key"
                    type={showKey ? "text" : "password"}
                    placeholder="nvapi-..."
                    className="pr-10"
                    {...register("apiKey")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Obtenez votre clé sur{" "}
                  <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    build.nvidia.com
                  </a>
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nvidia-model">Modèle</Label>
                <Select
                  value={watch("model") ?? ""}
                  onValueChange={(val) => val && setValue("model", val)}
                >
                  <SelectTrigger id="nvidia-model" className="max-w-sm">
                    <SelectValue placeholder="Choisir un modèle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {NVIDIA_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Tous supportent le function calling. Llama 3.3 70B recommandé pour l&apos;analyse financière.
                </p>
              </div>
            </div>
          )}

          {provider === "ollama" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ollama-url">URL Ollama</Label>
                <Input id="ollama-url" placeholder="http://localhost:11434" className="max-w-sm" {...register("baseUrl")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ollama-model">Modèle</Label>
                <Input id="ollama-model" placeholder="llama3.1" className="max-w-sm" {...register("model")} />
                <p className="text-xs text-muted-foreground">
                  Tool use natif : llama3.1, mistral-nemo, qwen2.5. Sinon mode dégradé.
                </p>
              </div>
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} size="sm" className="gap-1.5 self-start">
            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : isSaved ? <Check className="size-3.5" /> : null}
            {isSaved ? "Enregistré" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Section: Courtiers ───────────────────────────────────────────────────────

function BrokersSection() {
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AddBrokerValues>({
    resolver: zodResolver(addBrokerSchema),
    defaultValues: { name: "" },
  })

  useEffect(() => {
    fetch("/api/brokers")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: Broker[]) => setBrokers(data))
      .catch(() => setLoadError("Impossible de charger les courtiers."))
      .finally(() => setIsLoading(false))
  }, [])

  const onAddBroker = async (data: AddBrokerValues) => {
    const res = await fetch("/api/brokers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.status === 409) { toast.error("Ce courtier existe déjà."); return }
    if (!res.ok) { toast.error("Erreur lors de l'ajout."); return }
    const newBroker: Broker = await res.json()
    setBrokers((prev) => [...prev, newBroker].sort((a, b) => a.name.localeCompare(b.name)))
    reset()
    toast.success(`Courtier "${newBroker.name}" ajouté.`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <CardTitle>Courtiers</CardTitle>
        </div>
        <CardDescription>Gérez vos courtiers pour les associer à vos positions.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="size-4 animate-spin" /> Chargement...
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : brokers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Aucun courtier. Ajoutez-en un ci-dessous.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border overflow-hidden">
              {brokers.map((broker) => (
                <li key={broker.id} className="flex items-center justify-between px-3 py-2.5 bg-card text-sm hover:bg-muted/30 transition-colors">
                  <span className="font-medium truncate">{broker.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.info(`Suppression de "${broker.name}" — à venir.`)}
                    className="shrink-0 text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Ajouter un courtier</h3>
          <form onSubmit={handleSubmit(onAddBroker)} className="flex gap-3 items-end">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Label htmlFor="broker-name">Nom du courtier</Label>
              <Input id="broker-name" placeholder="Boursorama" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5 shrink-0">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Ajouter
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Root client component ────────────────────────────────────────────────────

export function SettingsClient({ userEmail }: { userEmail: string }) {
  return (
    <main className="flex flex-col gap-8 p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez votre compte, le provider IA et vos courtiers.
        </p>
      </div>
      <AccountSection email={userEmail} />
      <AiConfigSection />
      <BrokersSection />
    </main>
  )
}
