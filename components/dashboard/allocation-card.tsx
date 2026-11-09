"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n/context"

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)"
]

export function AllocationCard({
  entries,
  title,
  caption
}: {
  entries: { name: string; value: number }[]
  title?: string
  caption?: string
}) {
  const { language } = useLanguage()
  const fr = language === "fr"
  const locale = fr ? "fr-FR" : "en-GB"
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.value), 0)
  let offset = 0

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          {title ?? (fr ? "Répartition du portefeuille" : "Portfolio allocation")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {caption ?? (fr ? "Par enveloppe d’investissement" : "By investment account")}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center">
        <figure aria-label={fr ? "Répartition des actifs" : "Asset allocation"}>
          <div className="relative mx-auto mb-6 size-[188px]">
            <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="100" cy="100" r="80" fill="none" stroke="var(--muted)" strokeWidth="19" />
              {total > 0 &&
                entries.map((entry, index) => {
                  if (entry.value <= 0) return null
                  const percentage = (entry.value / total) * 100
                  const start = offset
                  offset += percentage
                  return (
                    <circle
                      key={entry.name}
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth="19"
                      pathLength="100"
                      strokeDasharray={`${Math.max(0, percentage - (entries.length > 1 ? 1.4 : 0))} 100`}
                      strokeDashoffset={-start}
                    />
                  )
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-muted-foreground">
                {fr ? "Valeur totale" : "Total value"}
              </span>
              <span className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                {new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0
                }).format(total)}
              </span>
              <span className="mt-1 text-[10px] text-muted-foreground">
                {entries.length}{" "}
                {fr
                  ? `enveloppe${entries.length > 1 ? "s" : ""}`
                  : `account${entries.length !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>
          <figcaption>
            {total > 0 ? (
              <ul className="space-y-3">
                {entries.map((entry, index) => (
                  <li key={entry.name} className="flex items-center gap-2.5 text-xs">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: COLORS[index % COLORS.length] }}
                    />
                    <span className="flex-1 text-muted-foreground">{entry.name}</span>
                    <span className="font-medium tabular-nums">
                      {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                        (Math.max(0, entry.value) / total) * 100
                      )}{" "}
                      %
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {fr
                  ? "Votre répartition apparaîtra après l’ajout de vos premières positions."
                  : "Your allocation will appear after you add your first positions."}
              </p>
            )}
          </figcaption>
        </figure>
      </CardContent>
    </Card>
  )
}
