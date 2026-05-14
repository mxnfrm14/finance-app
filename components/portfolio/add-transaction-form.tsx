"use client"

import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

const TRANSACTION_TYPES = ["BUY", "SELL", "DIVIDEND", "SPLIT", "TRANSFER"] as const

const TRANSACTION_TYPE_LABELS: Record<typeof TRANSACTION_TYPES[number], string> = {
  BUY: "Achat",
  SELL: "Vente",
  DIVIDEND: "Dividende",
  SPLIT: "Split",
  TRANSFER: "Transfert",
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

// Explicit interface for form values — avoids zod v4 z.preprocess
// inferring `unknown` output with @hookform/resolvers v5.
interface AddTransactionValues {
  type: (typeof TRANSACTION_TYPES)[number]
  quantity: number
  price: number
  fees: number
  date: string
  notes?: string
}

// Zod schema: HTML inputs deliver strings; coerce via preprocess
const toNum = (val: unknown) =>
  val === "" || val === undefined || val === null ? undefined : Number(val)

const addTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES, { error: "Type de transaction requis" }),
  quantity: z.preprocess(toNum, z.number({ error: "Quantité requise" }).positive("Doit être positif")),
  price: z.preprocess(toNum, z.number({ error: "Prix requis" }).nonnegative("Doit être >= 0")),
  fees: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? 0 : Number(v)),
    z.number().nonnegative("Doit être >= 0")
  ),
  date: z.string().min(1, "Date requise"),
  notes: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddTransactionFormProps {
  positionId: string
  onSuccess: () => void
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddTransactionForm({
  positionId,
  onSuccess,
  onCancel,
}: AddTransactionFormProps) {
  const { t } = useLanguage()
  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddTransactionValues>({
    resolver: zodResolver(addTransactionSchema) as Resolver<AddTransactionValues>,
    defaultValues: {
      fees: 0,
      date: today,
    },
  })

  const watchedType = watch("type")

  async function onSubmit(values: AddTransactionValues) {
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, positionId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? "Erreur lors de l'ajout")
      }

      toast.success("Transaction ajoutée")
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

      {/* Transaction type */}
      <div className="flex flex-col gap-1.5">
        <Label>Type *</Label>
        <Select
          value={watchedType !== undefined ? watchedType : null}
          onValueChange={(val) => {
            if (val !== null)
              setValue("type", val as AddTransactionValues["type"], {
                shouldValidate: true,
              })
          }}
        >
          <SelectTrigger className="w-full" aria-invalid={!!errors.type}>
            <SelectValue placeholder="Choisir..." />
          </SelectTrigger>
          <SelectContent>
            {TRANSACTION_TYPES.map((tt) => (
              <SelectItem key={tt} value={tt}>
                {TRANSACTION_TYPE_LABELS[tt]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-xs text-destructive">{errors.type.message}</p>
        )}
      </div>

      {/* Quantity + Price */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quantity">{t.portfolio.quantity} *</Label>
          <Input
            id="quantity"
            type="number"
            step="any"
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
          <Label htmlFor="price">Prix unitaire *</Label>
          <Input
            id="price"
            type="number"
            step="any"
            min="0"
            placeholder="42.50"
            aria-invalid={!!errors.price}
            {...register("price")}
          />
          {errors.price && (
            <p className="text-xs text-destructive">{errors.price.message}</p>
          )}
        </div>
      </div>

      {/* Fees + Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fees">Frais</Label>
          <Input
            id="fees"
            type="number"
            step="any"
            min="0"
            placeholder="0"
            {...register("fees")}
          />
          {errors.fees && (
            <p className="text-xs text-destructive">{errors.fees.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            aria-invalid={!!errors.date}
            {...register("date")}
          />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Commentaire optionnel..."
          {...register("notes")}
        />
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
