"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ReceiptText,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/context"

import { AddPositionForm } from "@/components/portfolio/add-position-form"
import { AddTransactionForm } from "@/components/portfolio/add-transaction-form"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Transaction {
  id: string
  positionId: string
  type: "BUY" | "SELL" | "DIVIDEND" | "SPLIT" | "TRANSFER"
  quantity: number
  price: number
  fees: number
  currency: string
  date: string
  notes: string | null
}

interface Position {
  id: string
  isin: string
  ticker: string | null
  name: string
  assetType: "ACTION" | "ETF" | "OBLIGATION" | "TURBO" | "CRYPTO" | "AUTRE"
  accountType: "PEA" | "CTO" | "AV" | "PEA-PME"
  quantity: number
  pru: number
  currency: string
  brokerId: string
  broker: { id: string; name: string }
  isActive: boolean
  transactions: Transaction[]
}

// Transaction enrichie avec infos du compte (pour vue multi-positions)
interface EnrichedTransaction extends Transaction {
  accountType: Position["accountType"]
  brokerName: string
}

// Groupe ISIN : agrège 1 ou N positions
interface ISINGroup {
  isin: string
  name: string
  ticker: string | null
  assetType: Position["assetType"]
  currency: string
  quantity: number       // somme
  pru: number            // moyenne pondérée
  totalInvested: number  // somme(pru_i × qty_i)
  positions: Position[]
  accountTypes: Position["accountType"][]
  transactions: EnrichedTransaction[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtCurrency = (n: number, cur = "EUR") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur }).format(n)

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR")

const fmtQty = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 8 }).format(n)

const ASSET_TYPE_VARIANT: Record<
  Position["assetType"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  ACTION: "default",
  ETF: "secondary",
  OBLIGATION: "outline",
  TURBO: "destructive",
  CRYPTO: "secondary",
  AUTRE: "outline",
}

const ACCOUNT_TYPE_VARIANT: Record<
  Position["accountType"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  PEA: "default",
  CTO: "outline",
  AV: "secondary",
  "PEA-PME": "outline",
}

const TX_TYPE_LABELS: Record<Transaction["type"], string> = {
  BUY: "Achat",
  SELL: "Vente",
  DIVIDEND: "Dividende",
  SPLIT: "Split",
  TRANSFER: "Transfert",
}

// ---------------------------------------------------------------------------
// Groupement par ISIN
// ---------------------------------------------------------------------------

function groupPositionsByISIN(positions: Position[]): ISINGroup[] {
  const map = new Map<string, ISINGroup>()

  for (const pos of positions) {
    const existing = map.get(pos.isin)

    const enriched: EnrichedTransaction[] = pos.transactions.map((tx) => ({
      ...tx,
      accountType: pos.accountType,
      brokerName: pos.broker.name,
    }))

    if (existing) {
      const newTotalCost = existing.totalInvested + pos.pru * pos.quantity
      const newQty = existing.quantity + pos.quantity
      existing.quantity = newQty
      existing.pru = newQty > 0 ? newTotalCost / newQty : 0
      existing.totalInvested = newTotalCost
      existing.positions.push(pos)
      if (!existing.accountTypes.includes(pos.accountType))
        existing.accountTypes.push(pos.accountType)
      existing.transactions.push(...enriched)
    } else {
      map.set(pos.isin, {
        isin: pos.isin,
        name: pos.name,
        ticker: pos.ticker,
        assetType: pos.assetType,
        currency: pos.currency,
        quantity: pos.quantity,
        pru: pos.pru,
        totalInvested: pos.pru * pos.quantity,
        positions: [pos],
        accountTypes: [pos.accountType],
        transactions: enriched,
      })
    }
  }

  // Tri des transactions par date asc dans chaque groupe
  for (const group of map.values()) {
    group.transactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }

  return [...map.values()]
}

// ---------------------------------------------------------------------------
// Transaction row
// ---------------------------------------------------------------------------

interface TransactionRowProps {
  tx: EnrichedTransaction
  multiAccount: boolean
  onDeleted: () => void
}

function TransactionRow({ tx, multiAccount, onDeleted }: TransactionRowProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm("Supprimer cette transaction ? Le PRU sera recalculé.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Transaction supprimée")
      onDeleted()
    } catch {
      toast.error("Impossible de supprimer la transaction")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 text-sm group">
      <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
        {fmtDate(tx.date)}
      </span>
      <span className="w-20 shrink-0">
        <Badge
          variant={tx.type === "BUY" ? "default" : tx.type === "SELL" ? "destructive" : "secondary"}
          className="text-xs font-normal"
        >
          {TX_TYPE_LABELS[tx.type]}
        </Badge>
      </span>
      <span className="w-24 shrink-0 tabular-nums">{fmtQty(tx.quantity)}</span>
      <span className="w-28 shrink-0 tabular-nums">{fmtCurrency(tx.price, tx.currency)}</span>
      <span className="w-28 shrink-0 tabular-nums">
        {fmtCurrency(tx.quantity * tx.price + tx.fees, tx.currency)}
      </span>
      <span className="w-20 shrink-0 tabular-nums text-muted-foreground">
        {tx.fees > 0 ? fmtCurrency(tx.fees, tx.currency) : "—"}
      </span>
      {multiAccount && (
        <span className="w-24 shrink-0">
          <Badge variant={ACCOUNT_TYPE_VARIANT[tx.accountType]} className="text-xs font-normal">
            {tx.accountType}
          </Badge>
        </span>
      )}
      <span className="flex-1 text-muted-foreground truncate text-xs">
        {tx.notes ?? ""}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
        onClick={handleDelete}
        disabled={deleting}
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">Supprimer</span>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ISIN row
// ---------------------------------------------------------------------------

interface ISINRowProps {
  group: ISINGroup
  onRefresh: () => void
}

function ISINRow({ group, onRefresh }: ISINRowProps) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)
  const [addTxOpen, setAddTxOpen] = useState(false)
  const [selectedPositionId, setSelectedPositionId] = useState<string>(
    group.positions[0].id
  )

  // Vrai uniquement si l'ISIN est réparti sur plusieurs comptes distincts (accountType + brokerId)
  const distinctAccounts = [
    ...new Map(group.positions.map((p) => [`${p.accountType}:${p.brokerId}`, p])).values(),
  ]
  const multiAccount = distinctAccounts.length > 1

  return (
    <div className="border-b last:border-b-0">
      {/* ── Main row ── */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors",
          expanded && "bg-muted/20"
        )}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        {/* Chevron */}
        <span className="text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>

        {/* Identité */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{group.name}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {group.isin}
            {group.ticker && <span className="ml-2 opacity-70">{group.ticker}</span>}
          </p>
        </div>

        {/* Type d'actif */}
        <div className="hidden sm:block w-24 shrink-0">
          <Badge variant={ASSET_TYPE_VARIANT[group.assetType]}>{group.assetType}</Badge>
        </div>

        {/* Enveloppes (une ou plusieurs) */}
        <div className="hidden md:flex w-28 shrink-0 flex-wrap gap-1">
          {group.accountTypes.map((at) => (
            <Badge key={at} variant={ACCOUNT_TYPE_VARIANT[at]} className="text-xs">
              {at}
            </Badge>
          ))}
        </div>

        {/* Quantité totale */}
        <div className="w-20 shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Qté</p>
          <p className="tabular-nums text-sm font-medium">{fmtQty(group.quantity)}</p>
        </div>

        {/* PRU pondéré */}
        <div className="hidden lg:block w-28 shrink-0 text-right">
          <p className="text-xs text-muted-foreground">PRU moy.</p>
          <p className="tabular-nums text-sm font-medium">{fmtCurrency(group.pru, group.currency)}</p>
        </div>

        {/* Total investi */}
        <div className="hidden lg:block w-28 shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Investi</p>
          <p className="tabular-nums text-sm font-semibold">{fmtCurrency(group.totalInvested, group.currency)}</p>
        </div>

        {/* Nb transactions */}
        <div className="hidden xl:block w-16 shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Tx</p>
          <p className="tabular-nums text-sm">{group.transactions.length}</p>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Dialog open={addTxOpen} onOpenChange={setAddTxOpen}>
            <DialogTrigger
              render={
                <Button variant="ghost" size="icon-sm" title="Ajouter une transaction">
                  <ReceiptText className="size-3.5" />
                  <span className="sr-only">Ajouter une transaction</span>
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {t.portfolio.addTransaction} — {group.name}
                </DialogTitle>
              </DialogHeader>

              {/* Sélecteur de compte si multi-comptes distincts */}
              {multiAccount && (
                <div className="flex gap-2 flex-wrap pb-1">
                  {distinctAccounts.map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => setSelectedPositionId(pos.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs border transition-colors",
                        selectedPositionId === pos.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      {pos.accountType} — {pos.broker.name}
                    </button>
                  ))}
                </div>
              )}

              <AddTransactionForm
                positionId={selectedPositionId}
                onSuccess={() => {
                  setAddTxOpen(false)
                  onRefresh()
                }}
                onCancel={() => setAddTxOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Dropdown transactions ── */}
      {expanded && (
        <div className="bg-muted/10 border-t">
          {group.transactions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground italic">
              Aucune transaction enregistrée.
            </p>
          ) : (
            <div className="px-2 pb-2">
              {/* En-tête colonnes */}
              <div className="flex items-center gap-3 py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-muted/40">
                <span className="w-24 shrink-0">Date</span>
                <span className="w-20 shrink-0">Type</span>
                <span className="w-24 shrink-0">Quantité</span>
                <span className="w-28 shrink-0">Prix unit.</span>
                <span className="w-28 shrink-0">Montant</span>
                <span className="w-20 shrink-0">Frais</span>
                {multiAccount && <span className="w-24 shrink-0">Compte</span>}
                <span className="flex-1">Notes</span>
                <span className="w-7 shrink-0" />
              </div>

              {/* Lignes */}
              {group.transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  multiAccount={multiAccount}
                  onDeleted={onRefresh}
                />
              ))}

              {/* Pied de tableau : totaux */}
              <div className="flex items-center gap-3 px-3 pt-2 mt-1 border-t border-muted/40 text-xs text-muted-foreground">
                <span className="w-24 shrink-0" />
                <span className="w-20 shrink-0" />
                <span className="w-24 shrink-0 tabular-nums font-medium text-foreground">
                  {fmtQty(group.quantity)} parts
                </span>
                <span className="w-28 shrink-0 tabular-nums font-medium text-foreground">
                  PRU {fmtCurrency(group.pru, group.currency)}
                </span>
                <span className="w-28 shrink-0 tabular-nums font-semibold text-foreground">
                  {fmtCurrency(group.totalInvested, group.currency)}
                </span>
                <span className="w-20 shrink-0 tabular-nums">
                  {fmtCurrency(
                    group.transactions.reduce((s, tx) => s + tx.fees, 0),
                    group.currency
                  )}
                </span>
              </div>

              {/* Sous-détail par compte si multi-comptes distincts */}
              {multiAccount && (
                <div className="mx-3 mt-2 rounded-md bg-muted/30 px-3 py-2 flex flex-wrap gap-4 text-xs">
                  {distinctAccounts.map((pos) => (
                    <div key={`${pos.accountType}:${pos.brokerId}`} className="flex items-center gap-1.5">
                      <Badge variant={ACCOUNT_TYPE_VARIANT[pos.accountType]} className="text-xs">
                        {pos.accountType}
                      </Badge>
                      <span className="text-muted-foreground">{pos.broker.name}</span>
                      <span className="tabular-nums font-medium">{fmtQty(pos.quantity)} pts</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="tabular-nums">PRU {fmtCurrency(pos.pru, pos.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function PortfolioSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function PortfolioClient() {
  const { t } = useLanguage()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [addPosOpen, setAddPosOpen] = useState(false)

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch("/api/positions")
      if (!res.ok) throw new Error()
      setPositions(await res.json())
    } catch {
      toast.error("Impossible de charger le portefeuille")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPositions() }, [fetchPositions])

  const activePositions = positions.filter((p) => p.isActive)
  const isinGroups = useMemo(() => groupPositionsByISIN(activePositions), [activePositions])

  const totalInvested = isinGroups.reduce((s, g) => s + g.totalInvested, 0)
  const totalTx = isinGroups.reduce((s, g) => s + g.transactions.length, 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.portfolio.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading
              ? t.common.loading
              : `${isinGroups.length} ISIN · ${activePositions.length} position${activePositions.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <Dialog open={addPosOpen} onOpenChange={setAddPosOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="size-4" />
                {t.portfolio.newPosition}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t.portfolio.newPosition}</DialogTitle>
            </DialogHeader>
            <AddPositionForm
              onSuccess={() => { setAddPosOpen(false); fetchPositions() }}
              onCancel={() => setAddPosOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      {!loading && isinGroups.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-xs text-muted-foreground font-normal">
                ISIN distincts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tabular-nums">{isinGroups.length}</p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-xs text-muted-foreground font-normal">
                Capital investi (PRU)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tabular-nums">{fmtCurrency(totalInvested)}</p>
            </CardContent>
          </Card>

          <Card size="sm" className="hidden sm:flex">
            <CardHeader>
              <CardTitle className="text-xs text-muted-foreground font-normal">
                Transactions totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tabular-nums">{totalTx}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <PortfolioSkeleton />
      ) : isinGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="rounded-full bg-muted p-4">
            <ReceiptText className="size-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{t.portfolio.noPositions}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ajoutez votre première position pour commencer le suivi.
            </p>
          </div>
          <Dialog open={addPosOpen} onOpenChange={setAddPosOpen}>
            <DialogTrigger
              render={
                <Button variant="outline">
                  <Plus className="size-4" />
                  {t.portfolio.newPosition}
                </Button>
              }
            />
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t.portfolio.newPosition}</DialogTitle>
              </DialogHeader>
              <AddPositionForm
                onSuccess={() => { setAddPosOpen(false); fetchPositions() }}
                onCancel={() => setAddPosOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <Card className="overflow-hidden p-0 gap-0">
          {/* En-têtes colonnes */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2.5 border-b bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="size-4 shrink-0" />
            <span className="flex-1">Instrument</span>
            <span className="hidden sm:block w-24 shrink-0">Type</span>
            <span className="hidden md:block w-28 shrink-0">Enveloppe</span>
            <span className="w-20 shrink-0 text-right">Qté totale</span>
            <span className="hidden lg:block w-28 shrink-0 text-right">PRU moy.</span>
            <span className="hidden lg:block w-28 shrink-0 text-right">Investi</span>
            <span className="hidden xl:block w-16 shrink-0 text-right">Tx</span>
            <span className="w-10 shrink-0" />
          </div>

          {isinGroups.map((group) => (
            <ISINRow
              key={group.isin}
              group={group}
              onRefresh={fetchPositions}
            />
          ))}
        </Card>
      )}
    </div>
  )
}
