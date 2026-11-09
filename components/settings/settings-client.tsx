"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  User,
  Building2,
  Plus,
  Trash2,
  Loader2,
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
import { AiConfigSection } from "./ai-config-section"
import { useLanguage } from "@/lib/i18n/context"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Broker {
  id: string
  name: string
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

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
                    aria-label={`Supprimer le courtier ${broker.name}`}
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
