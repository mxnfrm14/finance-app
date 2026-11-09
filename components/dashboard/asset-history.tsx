"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowUpRight, ChartNoAxesCombined, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"
import type { PortfolioHistoryRow } from "@/lib/portfolio/value-history"

const StockChart = dynamic(() => import("@/components/charts/stock-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-xl" />
})
const PERIODS = [
  { value: "1mo", fr: "1M", en: "1M" },
  { value: "3mo", fr: "3M", en: "3M" },
  { value: "6mo", fr: "6M", en: "6M" },
  { value: "1y", fr: "1A", en: "1Y" },
  { value: "5y", fr: "5A", en: "5Y" }
]

export function AssetHistory({
  hasPositions,
  updatedAt
}: {
  hasPositions: boolean
  updatedAt: string
}) {
  const { language } = useLanguage()
  const fr = language === "fr"
  const [period, setPeriod] = useState("6mo")
  const [data, setData] = useState<PortfolioHistoryRow[]>([])
  const [loading, setLoading] = useState(hasPositions)
  const [error, setError] = useState(false)
  const [estimated, setEstimated] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!hasPositions) return
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    setData([])
    async function load() {
      try {
        const response = await fetch(
          `/api/portfolio/history?${new URLSearchParams({ period })}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error("Chart unavailable")
        const result: { prices?: PortfolioHistoryRow[]; estimated?: boolean } = await response.json()
        const prices = (result.prices ?? []).filter(
          (row) => row.close !== null && Number.isFinite(row.close)
        )
        if (!controller.signal.aborted) {
          setData(prices)
          setEstimated(Boolean(result.estimated))
        }
      } catch {
        if (!controller.signal.aborted) setError(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [hasPositions, updatedAt, period, retry])

  const first = data[0]?.close
  const last = data[data.length - 1]?.close
  const change = first != null && first > 0 && last != null ? ((last - first) / first) * 100 : null

  return (
    <Card className="min-w-0 h-full">
      <CardHeader className="gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {fr ? "Évolution du patrimoine total" : "Total portfolio value over time"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {fr
                ? "Valeur cumulée de vos positions à chaque date"
                : "Combined value of your holdings at each date"}
            </p>
          </div>
          <div
            role="group"
            aria-label={fr ? "Période du graphique" : "Chart period"}
            className="flex rounded-lg border bg-background p-1"
          >
            {PERIODS.map((item) => (
              <button
                key={item.value}
                onClick={() => setPeriod(item.value)}
                aria-pressed={period === item.value}
                className={cn(
                  "min-h-8 min-w-9 rounded-md px-2 text-[11px] font-medium transition-colors",
                  period === item.value
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {fr ? item.fr : item.en}
              </button>
            ))}
          </div>
        </div>
        {hasPositions && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {last != null && !loading && (
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold tracking-tight tabular-nums">
                  {new Intl.NumberFormat(fr ? "fr-FR" : "en-GB", {
                    style: "currency",
                    currency: "EUR"
                  }).format(last)}
                </span>
                {change !== null && (
                  <span
                    title={fr ? "Variation de la valeur, achats et ventes inclus" : "Value change, including purchases and sales"}
                    className={cn(
                      "rounded-md px-1.5 py-1 text-[10px] font-medium tabular-nums",
                      change >= 0 ? "pnl-positive" : "pnl-negative"
                    )}
                  >
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(2)} %
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="min-w-0 flex-1 px-2 sm:px-4">
        {!hasPositions ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-4 px-4 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
              <ChartNoAxesCombined className="size-6" strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-sm font-medium">
                {fr ? "Vos investissements, en perspective" : "Your investments, in perspective"}
              </p>
              <p className="mx-auto mt-2 max-w-72 text-xs leading-relaxed text-muted-foreground">
                {fr
                  ? "Ajoutez une première position pour suivre ici l’évolution de votre patrimoine total."
                  : "Add your first position to track your total portfolio value here."}
              </p>
            </div>
            <Link href="/portfolio" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {fr ? "Ajouter une position" : "Add a position"}
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        ) : loading ? (
          <div role="status" className="px-3">
            <span className="sr-only">{fr ? "Chargement du graphique" : "Loading chart"}</span>
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        ) : error || data.length === 0 ? (
          <div
            role="status"
            className="flex min-h-80 flex-col items-center justify-center gap-3 text-center"
          >
            <ChartNoAxesCombined className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {fr
                ? "Historique du patrimoine indisponible."
                : "Portfolio history is unavailable."}
            </p>
            <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>
              <RefreshCw className="size-3.5" />
              {fr ? "Réessayer" : "Try again"}
            </Button>
          </div>
        ) : (
          <div
            role="img"
            aria-label={`${fr ? "Évolution du patrimoine total en euros" : "Total portfolio value in euros"}, ${period}`}
          >
            <StockChart
              data={data}
              period={period}
              interval="1d"
              currency="EUR"
              valueLabel={fr ? "Patrimoine total" : "Total portfolio value"}
            />
            {estimated && (
              <p className="px-3 pt-3 text-[10px] text-muted-foreground">
                {fr
                  ? "En l’absence de cours historique, les positions sont valorisées au coût d’acquisition."
                  : "Where historical prices are missing, holdings are valued at acquisition cost."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
