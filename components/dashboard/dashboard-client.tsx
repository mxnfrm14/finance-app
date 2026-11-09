"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Wallet,
  BriefcaseBusiness,
  TrendingUp,
  ChartNoAxesCombined,
  CalendarDays,
  Search,
  Sparkles,
  AlertCircle
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { AllocationCard } from "@/components/dashboard/allocation-card"
import { AssetHistory } from "@/components/dashboard/asset-history"
import { useLanguage } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"
import type { PortfolioSummary } from "@/lib/db/queries/portfolio-summary"

export function DashboardClient({
  summary,
  userName,
  updatedAt
}: {
  summary: PortfolioSummary | null
  userName?: string | null
  updatedAt: string
}) {
  const { t, language } = useLanguage()
  const fr = language === "fr"
  const [query, setQuery] = useState("")
  const locale = fr ? "fr-FR" : "en-GB"
  const money = (value: number, currency = "EUR") =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(value)
  const percent = (value: number) =>
    `${value >= 0 ? "+" : ""}${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} %`
  const positions = summary?.positions ?? []
  const positive = (summary?.totalPnl ?? 0) >= 0
  const PnlIcon = positive ? ArrowUpRight : ArrowDownRight
  const allocation = Object.entries(summary?.byAccountType ?? {}).map(([name, value]) => ({
    name: name === "AV" ? (fr ? "Assurance vie" : "Life insurance") : name,
    value: value.value
  }))
  const filtered = [...positions]
    .sort((a, b) => (b.currentValue ?? b.invested) - (a.currentValue ?? a.invested))
    .filter((position) =>
      `${position.name} ${position.ticker ?? ""} ${position.isin}`
        .toLocaleLowerCase(locale)
        .includes(query.toLocaleLowerCase(locale))
    )
  const assetTypes: Record<string, string> = {
    STOCK: fr ? "Action" : "Stock",
    ETF: "ETF",
    BOND: fr ? "Obligation" : "Bond",
    CRYPTO: "Crypto",
    FUND: fr ? "Fonds" : "Fund",
    TURBO: "Turbo",
    ETP: "ETP",
    OTHER: fr ? "Autre" : "Other"
  }

  const metrics = [
    {
      title: fr ? "Valeur du portefeuille" : "Portfolio value",
      icon: Wallet,
      value: summary ? money(summary.totalValue) : "—",
      subtitle: `${positions.length} ${fr ? `position${positions.length > 1 ? "s" : ""} active${positions.length > 1 ? "s" : ""}` : `active position${positions.length !== 1 ? "s" : ""}`}`,
      featured: true
    },
    {
      title: fr ? "Capital investi" : "Invested capital",
      icon: BriefcaseBusiness,
      value: summary ? money(summary.totalInvested) : "—",
      subtitle: fr ? "Coût d’acquisition de vos positions" : "Acquisition cost of your holdings"
    },
    {
      title: fr ? "Plus-value latente" : "Unrealised gain",
      icon: TrendingUp,
      value: summary ? `${positive ? "+" : ""}${money(summary.totalPnl)}` : "—",
      subtitle: fr ? "Sur l’ensemble de vos positions" : "Across all your holdings",
      pnl: true
    },
    {
      title: fr ? "Performance globale" : "Overall return",
      icon: ChartNoAxesCombined,
      value: summary ? percent(summary.totalPnlPct) : "—",
      subtitle: fr ? "Par rapport au capital investi" : "Compared with invested capital",
      pnl: true
    }
  ]

  return (
    <main className="flex flex-col gap-6 lg:gap-7">
      <section
        className="flex flex-wrap items-center justify-between gap-4"
        aria-labelledby="dashboard-heading"
      >
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">
            {fr ? "Votre espace d’investissement" : "Your investment workspace"}
          </p>
          <h1 id="dashboard-heading" className="font-semibold">
            {t.nav.dashboard}
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {fr ? "Bonjour" : "Hello"}
            {userName ? ` ${userName.split(" ")[0]}` : ""},{" "}
            {fr
              ? "gardez une longueur d’avance sur vos investissements."
              : "stay on top of your investments."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="hidden items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-xs text-muted-foreground xl:inline-flex">
            <CalendarDays className="size-3.5" />
            {new Intl.DateTimeFormat(locale, {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Europe/Paris"
            }).format(new Date(updatedAt))}
          </span>
          <Link href="/portfolio" className={buttonVariants()}>
            <Plus className="size-4" />
            {fr ? "Gérer mes positions" : "Manage holdings"}
          </Link>
        </div>
      </section>

      {!summary && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-loss p-4 text-sm text-loss"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>
            {fr
              ? "Le portefeuille n’a pas pu être chargé. Actualisez la page pour réessayer."
              : "Your portfolio could not be loaded. Refresh the page to try again."}
          </p>
        </div>
      )}

      <section
        aria-label={fr ? "Indicateurs clés" : "Key metrics"}
        className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >
        {metrics.map((metric) => (
          <Card
            key={metric.title}
            className={cn(
              "relative gap-0",
              metric.featured && "border-primary/20 bg-linear-to-br from-card to-primary/[0.035]"
            )}
          >
            <CardContent className="px-3.5 sm:px-5">
              <div className="mb-4 flex items-center gap-2.5 sm:mb-6">
                <span
                  className={cn(
                    "hidden size-8 items-center justify-center rounded-lg border sm:flex",
                    metric.featured
                      ? "border-primary/10 bg-primary/5 text-primary"
                      : "bg-background text-muted-foreground"
                  )}
                >
                  <metric.icon className="size-4" strokeWidth={1.6} />
                </span>
                <h2 className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                  {metric.title}
                </h2>
              </div>
              <p
                className={cn(
                  "text-[clamp(1rem,2vw,1.85rem)] font-semibold tracking-[-0.045em] tabular-nums",
                  metric.pnl && (positive ? "text-profit" : "text-loss")
                )}
              >
                {metric.value}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {metric.pnl && (
                  <PnlIcon className={cn("size-3.5", positive ? "text-profit" : "text-loss")} />
                )}
                {metric.subtitle}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section
        aria-label={fr ? "Vue d’ensemble des investissements" : "Investment overview"}
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"
      >
        <AssetHistory hasPositions={positions.length > 0} updatedAt={updatedAt} />
        <AllocationCard entries={allocation} />
      </section>

      <section aria-labelledby="holdings-heading">
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-5">
            <div className="flex items-center gap-2.5">
              <h2 id="holdings-heading" className="text-sm font-semibold">
                {fr ? "Vos positions" : "Your holdings"}
              </h2>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {positions.length}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {positions.length > 0 && (
                <div className="flex items-center gap-2">
                  <Search className="size-3.5 text-muted-foreground" />
                  <input
                    aria-label={fr ? "Filtrer les positions" : "Filter holdings"}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={fr ? "Filtrer…" : "Filter…"}
                    className="h-8 w-24 rounded-md bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-32"
                  />
                </div>
              )}
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                {fr ? "Tout voir" : "View all"}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>
          {positions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <BriefcaseBusiness className="size-5" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-medium">
                {fr ? "Votre portefeuille commence ici" : "Your portfolio starts here"}
              </p>
              <p className="max-w-80 text-xs leading-relaxed text-muted-foreground">
                {fr
                  ? "Centralisez vos investissements et suivez leur performance en ajoutant votre première position."
                  : "Bring your investments together and track performance by adding your first position."}
              </p>
              <Link href="/portfolio" className={cn(buttonVariants({ size: "sm" }), "mt-2")}>
                <Plus className="size-3.5" />
                {fr ? "Ajouter une position" : "Add a position"}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-xs">
                <caption className="sr-only">
                  {fr
                    ? "Positions triées par valeur décroissante"
                    : "Holdings sorted by descending value"}
                </caption>
                <thead>
                  <tr className="border-b text-[10px] text-muted-foreground">
                    <th scope="col" className="px-5 py-3 font-medium">
                      {fr ? "Instrument" : "Instrument"}
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      {fr ? "Quantité" : "Quantity"}
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      {fr ? "Cours actuel" : "Current price"}
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      {fr ? "Valeur" : "Value"}
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">
                      {fr ? "Plus-value latente" : "Unrealised gain"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.slice(0, 8).map((position) => (
                    <tr key={position.id}>
                      <td className="px-5 py-4">
                        <Link
                          href={
                            position.ticker
                              ? `/market/${encodeURIComponent(position.ticker)}`
                              : "/portfolio"
                          }
                          className="group flex items-center gap-3"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 text-[10px] font-semibold text-primary">
                            {(position.ticker ?? position.name).slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-56 truncate font-medium group-hover:text-primary">
                              {position.name}
                            </span>
                            <span className="mt-1 block text-[10px] text-muted-foreground">
                              {position.ticker ?? position.isin}{" "}
                              <span className="mx-1 text-border">/</span> {position.accountType}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant="secondary" className="rounded-md text-[10px] font-normal">
                          {assetTypes[position.assetType] ?? position.assetType}
                        </Badge>
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums">
                        {new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(
                          position.quantity
                        )}
                      </td>
                      <td className="px-3 py-4 text-right font-medium tabular-nums">
                        {position.currentPrice !== null
                          ? money(position.currentPrice, position.currency)
                          : "—"}
                      </td>
                      <td className="px-3 py-4 text-right font-medium tabular-nums">
                        {position.currentValue !== null
                          ? money(position.currentValue, position.currency)
                          : "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {position.pnl !== null && position.pnlPct !== null ? (
                          <div
                            className={cn(
                              "inline-flex flex-col items-end gap-1 tabular-nums",
                              position.pnl >= 0 ? "text-profit" : "text-loss"
                            )}
                          >
                            <span className="font-medium">
                              {position.pnl >= 0 ? "+" : ""}
                              {money(position.pnl, position.currency)}
                            </span>
                            <span className="text-[10px]">{percent(position.pnlPct)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                        {fr
                          ? "Aucune position ne correspond à votre recherche."
                          : "No holdings match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 8 && (
            <div className="border-t px-5 py-3 text-[11px] text-muted-foreground">
              {fr
                ? `8 positions affichées sur ${filtered.length}`
                : `Showing 8 of ${filtered.length} holdings`}
            </div>
          )}
        </Card>
      </section>

      <Link
        href="/agent?mode=portfolio"
        className="group flex flex-wrap items-center gap-4 rounded-2xl border border-primary/10 bg-primary/[0.035] px-5 py-4 transition-colors hover:bg-primary/[0.065]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-card text-primary">
          <Sparkles className="size-4" />
        </span>
        <div className="flex-1">
          <p className="text-xs font-medium">
            {fr ? "Prenez du recul sur votre portefeuille" : "See the bigger picture"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {fr
              ? "Votre assistant IA vous aide à explorer vos positions et leur répartition."
              : "Your AI assistant helps you explore your holdings and allocation."}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">
          {fr ? "Lancer une analyse" : "Start an analysis"}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </Link>
      <footer className="flex flex-wrap justify-between gap-2 pb-1 text-[10px] text-muted-foreground">
        <span>© {new Date(updatedAt).getUTCFullYear()} Bourse</span>
        <span>
          {positions.some((position) => position.currentValue === null)
            ? fr
              ? "Positions sans cours valorisées au coût d’acquisition."
              : "Holdings without a quote are valued at acquisition cost."
            : fr
              ? "Cours indicatifs · Dernières données disponibles"
              : "Indicative prices · Latest available data"}
        </span>
      </footer>
    </main>
  )
}
