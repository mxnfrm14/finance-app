"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, ArrowUpRight, ArrowDownRight, Minus, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

import StockChart from "@/components/charts/stock-chart"
import InstrumentActions from "@/components/market/instrument-actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type PriceRow = {
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
}

type FundamentalsLite = {
  ticker?: string
  sector?: string | null
  industry?: string | null
  description?: string | null
  peRatio?: number | null
  eps?: number | null
  dividendYield?: number | null
  marketCap?: number | null
}

type ChartOption = { period: string; interval: "1d" | "1wk"; label: string }

type ChartMeta = {
  currency?: string
  regularMarketPrice?: number | null
  chartPreviousClose?: number | null
  regularMarketChange?: number | null
  regularMarketChangePercent?: number | null
}

const CHART_OPTIONS: ChartOption[] = [
  { period: "1mo", interval: "1d", label: "1M" },
  { period: "3mo", interval: "1d", label: "3M" },
  { period: "6mo", interval: "1d", label: "6M" },
  { period: "1y", interval: "1d", label: "1A" },
  { period: "5y", interval: "1wk", label: "5A" },
]

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value)
}

function formatPercent(value: number | null) {
  if (value == null) return "—"
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

function formatCompact(value: number | null) {
  if (value == null) return "—"
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 2 }).format(value)
}

function formatFullNumber(value: number | null) {
  if (value == null) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 }).format(value)
}

function formatSignedPercent(value: number | null) {
  if (value == null) return "—"
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

function formatSignedCurrency(value: number | null, currency: string) {
  if (value == null) return "—"
  const formatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  return `${value >= 0 ? "+" : "-"}${formatted}`
}

function metricRow({
  label,
  compact,
  full,
}: {
  label: string
  compact: string
  full: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {compact === "—" ? (
        <span className="font-medium tabular-nums">—</span>
      ) : (
        <Tooltip>
          <TooltipTrigger className="font-medium tabular-nums underline decoration-dotted underline-offset-4">
            {compact}
          </TooltipTrigger>
          <TooltipContent>{full}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

export default function MarketDetailClient({
  ticker,
  displayTicker,
  instrumentName,
  fundamentals,
  initialPrices,
  initialCurrency,
  initialChartMeta,
}: {
  ticker: string
  displayTicker: string
  instrumentName: string
  fundamentals: FundamentalsLite | null
  initialPrices: PriceRow[]
  initialCurrency: string
  initialChartMeta: ChartMeta | null
}) {
  const [resolvedIsin, setResolvedIsin] = useState<string | null>(null)
  const [selected, setSelected] = useState<ChartOption>(CHART_OPTIONS[3])
  const [prices, setPrices] = useState<PriceRow[]>(initialPrices)
  const [currency, setCurrency] = useState(initialCurrency)
  const [chartMeta, setChartMeta] = useState<ChartMeta | null>(initialChartMeta)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async function fetchIsin() {
      try {
        const res = await fetch(`/api/market/resolve-isin?ticker=${encodeURIComponent(displayTicker)}`)
        if (!res.ok) return
        const json = await res.json()
        if (!alive) return
        setResolvedIsin(json?.isin ?? null)
      } catch {
        // ignore
      }
    })()
    async function run() {
      setChartLoading(true)
      setChartError(null)
      try {
        const query = new URLSearchParams({
          ticker,
          period: selected.period,
          interval: selected.interval,
        })
        const res = await fetch(`/api/market/chart?${query.toString()}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error ?? "Erreur chart API")
        if (!alive) return
        setPrices((json?.prices ?? []) as PriceRow[])
        setCurrency((json?.meta?.currency as string) ?? initialCurrency)
        setChartMeta((json?.meta ?? null) as ChartMeta | null)
      } catch (err) {
        if (!alive) return
        setChartError(err instanceof Error ? err.message : "Erreur de chargement du graphique")
      } finally {
        if (alive) setChartLoading(false)
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [ticker, selected.period, selected.interval, initialCurrency])

  const { currentPrice, performance } = useMemo(() => {
    const current = chartMeta?.regularMarketPrice ?? (prices.length > 0 ? prices[prices.length - 1]?.close ?? null : null)
    const reference = chartMeta?.chartPreviousClose ?? (prices.length > 0 ? prices[0]?.close ?? null : null)
    const perf = reference != null && current != null ? ((current - reference) / reference) * 100 : null
    return { currentPrice: current, performance: perf }
  }, [prices, chartMeta])

  const dividendYieldPct = fundamentals?.dividendYield != null ? fundamentals.dividendYield * 100 : null

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 pb-28 md:p-6 md:pb-6">
      <Link href="/market" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit gap-2")}>
        <ArrowLeft className="h-4 w-4" />
        Retour au marché
      </Link>

      <Card className="overflow-hidden border-border/60 bg-linear-to-br from-background via-background to-muted/30 shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="font-mono text-xs">{displayTicker}</Badge>
                {fundamentals?.sector && <Badge variant="outline">{fundamentals.sector}</Badge>}
                {fundamentals?.industry && <Badge variant="outline">{fundamentals.industry}</Badge>}
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-3 min-w-0">
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{instrumentName}</h1>

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="text-3xl font-semibold tabular-nums md:text-4xl">{formatCurrency(currentPrice, currency)}</div>
                    <div className={cn(
                      "rounded-full px-3 py-1 text-sm font-medium",
                      performance == null ? "bg-muted text-muted-foreground" : performance >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                    )}>
                      {performance != null && currentPrice != null && chartMeta?.chartPreviousClose != null ? (
                        <span className="inline-flex items-center gap-1">
                          {performance >= 0 ? <ArrowUpRight className="h-4 w-4" /> : performance < 0 ? <ArrowDownRight className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                          {formatSignedCurrency(currentPrice - chartMeta.chartPreviousClose, currency)}
                          <span className="opacity-80">({formatSignedPercent(performance)})</span>
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Card id="chart" className="min-w-0 border-border/60 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Évolution du cours</CardTitle>
                      {/* <CardDescription>Le filtre agit uniquement sur ce graphique.</CardDescription> */}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CHART_OPTIONS.map((option) => (
                        <button
                          key={option.period}
                          type="button"
                          className={buttonVariants({
                            variant: option.period === selected.period ? "default" : "outline",
                            size: "xs",
                          })}
                          onClick={() => setSelected(option)}
                          disabled={chartLoading && option.period === selected.period}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {chartLoading ? (
                    <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mise à jour du graphique...
                    </div>
                  ) : chartError ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {chartError}
                    </div>
                  ) : (
                    <StockChart data={prices} period={selected.period} interval={selected.interval} currency={currency} />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 lg:pt-1">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Actions rapides</CardTitle>
                </CardHeader>
                <CardContent>
                  <InstrumentActions ticker={ticker} name={instrumentName} isin={resolvedIsin ?? undefined} />
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Fondamentaux clés</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {metricRow({
                    label: "PE ratio",
                    compact: formatCompact(fundamentals?.peRatio ?? null),
                    full: formatFullNumber(fundamentals?.peRatio ?? null),
                  })}
                  {metricRow({
                    label: "EPS",
                    compact: formatCompact(fundamentals?.eps ?? null),
                    full: formatFullNumber(fundamentals?.eps ?? null),
                  })}
                  {metricRow({
                    label: "Dividend yield",
                    compact: dividendYieldPct != null ? `${dividendYieldPct.toFixed(2)}%` : "—",
                    full: dividendYieldPct != null ? `${dividendYieldPct.toFixed(6)}%` : "—",
                  })}
                  {metricRow({
                    label: "Market cap",
                    compact: formatCompact(fundamentals?.marketCap ?? null),
                    full: formatCurrency(fundamentals?.marketCap ?? null, currency),
                  })}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Identifiants</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {/** Simple rows with copy actions for ISIN, Ticker and Company name */}
                  {/** ISIN uses the internal ticker value (backend uses ticker as isin) */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">ISIN</div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{resolvedIsin ?? ticker ?? "—"}</div>
                      <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(resolvedIsin ?? ticker ?? ""); toast.success("ISIN copié"); } catch { toast.error("Impossible de copier") } }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">Ticker</div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{displayTicker ?? "—"}</div>
                      <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(displayTicker ?? ""); toast.success("Ticker copié"); } catch { toast.error("Impossible de copier") } }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">Nom</div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate max-w-[18rem]">{instrumentName ?? "—"}</div>
                      <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(instrumentName ?? ""); toast.success("Nom copié"); } catch { toast.error("Impossible de copier") } }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>À propos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            {fundamentals?.description ?? "Aucune description disponible."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
