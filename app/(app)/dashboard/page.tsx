import Link from "next/link"

import { auth } from "@/auth"
import { getPortfolioSummary } from "@/lib/db/queries/portfolio-summary"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)

const fmtPct = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`

const fmtQty = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 }).format(n)

// ─── Account type labels ──────────────────────────────────────────────────────

const ACCOUNT_LABELS: Record<string, string> = {
  PEA: "PEA",
  CTO: "CTO",
  AV: "Assurance Vie",
  "PEA-PME": "PEA-PME",
}

// ─── Asset type badge variant ─────────────────────────────────────────────────

const ASSET_TYPE_LABELS: Record<string, string> = {
  STOCK: "Action",
  ETF: "ETF",
  BOND: "Obligation",
  CRYPTO: "Crypto",
  FUND: "Fonds",
  TURBO: "Turbo",
  ETP: "ETP",
  OTHER: "Autre",
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  valueClass,
  sub,
}: {
  title: string
  value: string
  valueClass?: string
  sub?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold tabular-nums", valueClass)}>
          {value}
        </p>
        {sub && (
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth()
  // Auth guard is handled by the layout; session is always present here.
  const userId = session?.user?.id ?? ""

  let summary = await getPortfolioSummary(userId).catch(() => null)

  // Graceful fallback for empty or errored portfolio
  if (!summary) {
    summary = {
      positions: [],
      totalInvested: 0,
      totalValue: 0,
      totalPnl: 0,
      totalPnlPct: 0,
      byAccountType: {},
    }
  }

  const {
    positions,
    totalInvested,
    totalValue,
    totalPnl,
    totalPnlPct,
    byAccountType,
  } = summary

  const isPnlPositive = totalPnl >= 0
  const pnlClass = isPnlPositive ? "text-profit" : "text-loss"

  // Top positions sorted by invested value descending
  const topPositions = [...positions].sort((a, b) => b.invested - a.invested)

  const accountEntries = Object.entries(byAccountType)

  return (
    <main className="flex flex-col gap-8 p-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bonjour, {session?.user?.name ?? "investisseur"} — voici l&apos;état de votre portefeuille.
        </p>
      </div>

      {/* ── KPI row ── */}
      <section aria-label="Indicateurs clés">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Valeur totale"
            value={fmtEur(totalValue)}
            sub={positions.length === 0 ? "Aucune position" : `${positions.length} position${positions.length > 1 ? "s" : ""}`}
          />
          <KpiCard
            title="Montant investi"
            value={fmtEur(totalInvested)}
          />
          <KpiCard
            title="P&amp;L latent"
            value={`${isPnlPositive ? "+" : ""}${fmtEur(totalPnl)}`}
            valueClass={pnlClass}
          />
          <KpiCard
            title="P&amp;L latent (%)"
            value={fmtPct(totalPnlPct)}
            valueClass={pnlClass}
          />
        </div>
      </section>

      {/* ── Répartition par enveloppe ── */}
      {accountEntries.length > 0 && (
        <section aria-label="Répartition par enveloppe">
          <h2 className="mb-3 text-base font-semibold">
            Répartition par enveloppe
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {accountEntries.map(([type, data]) => {
              const enveloppePnlPositive = data.pnl >= 0
              const enveloppePnlClass = enveloppePnlPositive
                ? "text-profit"
                : "text-loss"
              return (
                <Card key={type} size="sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">
                      {ACCOUNT_LABELS[type] ?? type}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valeur</span>
                      <span className="font-medium tabular-nums">
                        {fmtEur(data.value)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Investi</span>
                      <span className="tabular-nums">{fmtEur(data.invested)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">P&amp;L</span>
                      <span
                        className={cn(
                          "tabular-nums font-medium",
                          enveloppePnlClass
                        )}
                      >
                        {enveloppePnlPositive ? "+" : ""}
                        {fmtEur(data.pnl)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Positions ── */}
      <section aria-label="Positions">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Positions</h2>
          {positions.length > 0 && (
            <Link
              href="/portfolio"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Voir tout
            </Link>
          )}
        </div>

        {topPositions.length === 0 ? (
          /* ── Empty state ── */
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-muted-foreground">
                Aucune position — Commencez par ajouter un instrument.
              </p>
              <Link
                href="/portfolio"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ajouter une position
              </Link>
            </CardContent>
          </Card>
        ) : (
          /* ── Positions table ── */
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 text-right font-medium">Quantité</th>
                  <th className="px-4 py-3 text-right font-medium">PRU</th>
                  <th className="px-4 py-3 text-right font-medium">Cours</th>
                  <th className="px-4 py-3 text-right font-medium">+/- €</th>
                  <th className="px-4 py-3 text-right font-medium">+/- %</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {topPositions.map((pos, idx) => {
                  const positivePnl = (pos.pnl ?? 0) >= 0
                  const rowPnlClass = positivePnl ? "text-profit" : "text-loss"
                  const isLast = idx === topPositions.length - 1

                  return (
                    <tr
                      key={pos.id}
                      className={cn(
                        "transition-colors hover:bg-muted/40",
                        !isLast && "border-b border-border"
                      )}
                    >
                      {/* Nom */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/portfolio/${pos.id}`}
                          className="font-medium hover:underline underline-offset-4"
                        >
                          {pos.name}
                        </Link>
                        {pos.ticker && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {pos.ticker}
                          </span>
                        )}
                      </td>

                      {/* Quantité */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtQty(pos.quantity)}
                      </td>

                      {/* PRU */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtEur(pos.pru)}
                      </td>

                      {/* Cours */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {pos.currentPrice !== null ? (
                          <span>
                            {fmtEur(pos.currentPrice)}
                            {pos.change1d !== null && (
                              <span
                                className={cn(
                                  "ml-1 text-xs",
                                  pos.change1d >= 0 ? "text-profit" : "text-loss"
                                )}
                              >
                                ({pos.change1d >= 0 ? "+" : ""}
                                {pos.change1d.toFixed(2)}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* P&L € */}
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums font-medium",
                          pos.pnl !== null ? rowPnlClass : "text-muted-foreground"
                        )}
                      >
                        {pos.pnl !== null
                          ? `${positivePnl ? "+" : ""}${fmtEur(pos.pnl)}`
                          : "—"}
                      </td>

                      {/* P&L % */}
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums font-medium",
                          pos.pnlPct !== null ? rowPnlClass : "text-muted-foreground"
                        )}
                      >
                        {pos.pnlPct !== null ? fmtPct(pos.pnlPct) : "—"}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {ASSET_TYPE_LABELS[pos.assetType] ?? pos.assetType}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </main>
  )
}
