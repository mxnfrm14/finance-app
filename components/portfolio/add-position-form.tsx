"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLanguage } from "@/lib/i18n/context"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Broker {
  id: string
  name: string
}

interface SearchResult {
  ticker: string
  name: string
  currency: string | null
  type: string
}

const ASSET_TYPES = ["ACTION", "ETF", "OBLIGATION", "TURBO", "CRYPTO", "AUTRE"] as const
const ACCOUNT_TYPES = ["PEA", "CTO", "AV", "PEA-PME"] as const

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const addPositionSchema = z.object({
  isin: z.string().min(1, "ISIN requis"),
  name: z.string().min(1, "Nom requis"),
  assetType: z.enum(ASSET_TYPES, { error: "Type d'actif requis" }),
  accountType: z.enum(ACCOUNT_TYPES, { error: "Type de compte requis" }),
  brokerId: z.string().min(1, "Courtier requis"),
  ticker: z.string().optional(),
  currency: z.string().min(1, "Devise requise"),
  entryDate: z.string().min(1, "Date requise"),
  // Initial transaction (optional — kept as strings, converted on submit)
  quantity: z.string().optional(),
  pru: z.string().optional(),
  fees: z.string().optional(),
})

type AddPositionValues = z.infer<typeof addPositionSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddPositionFormProps {
  onSuccess: () => void
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddPositionForm({ onSuccess, onCancel }: AddPositionFormProps) {
  const { t } = useLanguage()
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loadingBrokers, setLoadingBrokers] = useState(true)
  const [lookingUpIsin, setLookingUpIsin] = useState(false)
  const isinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddPositionValues>({
    resolver: zodResolver(addPositionSchema),
    defaultValues: {
      currency: "EUR",
      entryDate: today,
    },
  })

  const watchedAssetType = watch("assetType")
  const watchedAccountType = watch("accountType")
  const watchedBrokerId = watch("brokerId")
  const watchedIsin = watch("isin")

  // Fetch brokers on mount
  useEffect(() => {
    fetch("/api/brokers")
      .then((r) => r.json())
      .then((data: Broker[]) => {
        setBrokers(data)
        if (data.length === 1) setValue("brokerId", data[0].id)
      })
      .catch(() => toast.error("Impossible de charger les courtiers"))
      .finally(() => setLoadingBrokers(false))
  }, [setValue])

  // ISIN → auto-fill ticker, name, currency, asset type
  useEffect(() => {
    if (isinTimer.current) clearTimeout(isinTimer.current)

    const isin = watchedIsin?.trim() ?? ""
    if (isin.length < 5) return

    isinTimer.current = setTimeout(async () => {
      setLookingUpIsin(true)
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(isin)}`)
        if (!res.ok) return
        const results: SearchResult[] = await res.json()
        if (results.length === 0) return

        const first = results[0]
        setValue("ticker", first.ticker, { shouldValidate: true })
        setValue("name", first.name, { shouldValidate: true })
        if (first.currency != null) setValue("currency", first.currency, { shouldValidate: true })

        const typeMap: Partial<Record<string, (typeof ASSET_TYPES)[number]>> = {
          EQUITY: "ACTION",
          ETF: "ETF",
        }
        const mapped = typeMap[first.type?.toUpperCase()]
        if (mapped) setValue("assetType", mapped, { shouldValidate: true })
      } catch {
        // silent — user can fill manually
      } finally {
        setLookingUpIsin(false)
      }
    }, 600)

    return () => {
      if (isinTimer.current) clearTimeout(isinTimer.current)
    }
  }, [watchedIsin, setValue])

  async function onSubmit(values: AddPositionValues) {
    try {
      const entryDateISO = new Date(values.entryDate + "T12:00:00.000Z").toISOString()
      const quantity = values.quantity ? parseFloat(values.quantity) : undefined
      const pru = values.pru ? parseFloat(values.pru) : undefined
      const fees = values.fees ? parseFloat(values.fees) : 0
      const hasTransaction = quantity && quantity > 0 && pru !== undefined && !isNaN(pru)

      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, entryDate: entryDateISO }),
      })

      let positionId: string

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        if (!body.existingPositionId) {
          toast.error("Cette position existe déjà dans cette enveloppe.")
          return
        }
        // Position déjà existante — on ajoute la transaction dessus si renseignée
        positionId = body.existingPositionId
        if (!hasTransaction) {
          toast.info("Cette position existe déjà. Ajoutez une transaction depuis le portfolio.")
          onSuccess()
          return
        }
        toast.info("Position déjà existante — transaction ajoutée à la position existante.")
      } else if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body?.error === "string" ? body.error : "Erreur lors de la création")
      } else {
        const position = await res.json()
        positionId = position.id
      }

      if (hasTransaction) {
        const txRes = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positionId,
            type: "BUY",
            quantity,
            price: pru,
            fees,
            currency: values.currency,
            date: entryDateISO,
          }),
        })
        if (!txRes.ok) {
          toast.warning("Position créée, mais échec de la transaction initiale")
        } else if (res.status !== 409) {
          toast.success("Position ajoutée")
        }
      } else {
        toast.success("Position ajoutée")
      }

      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

      {/* Row 1: ISIN + Ticker */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="isin">ISIN *</Label>
          <div className="relative">
            <Input
              id="isin"
              placeholder="FR0000131104"
              aria-invalid={!!errors.isin}
              {...register("isin")}
            />
            {lookingUpIsin && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {errors.isin && (
            <p className="text-xs text-destructive">{errors.isin.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticker">Ticker</Label>
          <Input id="ticker" placeholder="BNP.PA" {...register("ticker")} />
        </div>
      </div>

      {/* Row 2: Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nom *</Label>
        <Input
          id="name"
          placeholder="BNP Paribas"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Row 3: Asset type + Account type */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Type d&apos;actif *</Label>
          <Select
            value={watchedAssetType ?? ""}
            onValueChange={(val) =>
              setValue("assetType", val as AddPositionValues["assetType"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full" aria-invalid={!!errors.assetType}>
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.assetType && (
            <p className="text-xs text-destructive">{errors.assetType.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Enveloppe *</Label>
          <Select
            value={watchedAccountType ?? ""}
            onValueChange={(val) =>
              setValue("accountType", val as AddPositionValues["accountType"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full" aria-invalid={!!errors.accountType}>
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.accountType && (
            <p className="text-xs text-destructive">{errors.accountType.message}</p>
          )}
        </div>
      </div>

      {/* Row 4: Broker */}
      <div className="flex flex-col gap-1.5">
        <Label>Courtier *</Label>
        <Select
          value={watchedBrokerId ?? ""}
          onValueChange={(val) => val && setValue("brokerId", val, { shouldValidate: true })}
          disabled={loadingBrokers}
        >
          <SelectTrigger className="w-full" aria-invalid={!!errors.brokerId}>
            <SelectValue
              placeholder={loadingBrokers ? t.common.loading : "Sélectionner un courtier"}
            />
          </SelectTrigger>
          <SelectContent>
            {brokers.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.brokerId && (
          <p className="text-xs text-destructive">{errors.brokerId.message}</p>
        )}
      </div>

      {/* Row 5: Currency + Entry date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Devise *</Label>
          <Input
            id="currency"
            placeholder="EUR"
            maxLength={3}
            aria-invalid={!!errors.currency}
            {...register("currency")}
          />
          {errors.currency && (
            <p className="text-xs text-destructive">{errors.currency.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entryDate">Date d&apos;entrée *</Label>
          <Input
            id="entryDate"
            type="date"
            aria-invalid={!!errors.entryDate}
            {...register("entryDate")}
          />
          {errors.entryDate && (
            <p className="text-xs text-destructive">{errors.entryDate.message}</p>
          )}
        </div>
      </div>

      {/* Row 6: Initial transaction (optional) */}
      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground mb-3">
          Transaction initiale <span className="opacity-60">(optionnel)</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity">Nb de parts</Label>
            <Input
              id="quantity"
              type="number"
              step="0.0001"
              min="0"
              placeholder="10"
              aria-invalid={!!errors.quantity}
              {...register("quantity")}
            />
            {errors.quantity && (
              <p className="text-xs text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pru">PRU (prix d&apos;achat)</Label>
            <Input
              id="pru"
              type="number"
              step="0.01"
              min="0"
              placeholder="45.20"
              aria-invalid={!!errors.pru}
              {...register("pru")}
            />
            {errors.pru && (
              <p className="text-xs text-destructive">{errors.pru.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fees">Frais</Label>
            <Input
              id="fees"
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              {...register("fees")}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t.common.loading : t.common.add}
        </Button>
      </div>
    </form>
  )
}
