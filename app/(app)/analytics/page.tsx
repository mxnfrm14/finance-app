import type { Metadata } from "next"
import { BarChart3 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Analytiques — Bourse",
  description: "Graphiques P&L, allocation et évolution de votre portefeuille.",
}

export default function AnalyticsPage() {
  return (
    <main className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytiques</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualisations et graphiques de performance.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-muted-foreground" />
            <CardTitle>À venir</CardTitle>
          </div>
          <CardDescription>
            Les graphiques d&apos;analytiques sont en cours de développement.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>Cette section inclura :</p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Évolution du P&amp;L dans le temps</li>
            <li>Répartition sectorielle et géographique</li>
            <li>Performance par enveloppe (PEA, CTO, AV)</li>
            <li>Comparaison avec indices de référence</li>
          </ul>
        </CardContent>
      </Card>
    </main>
  )
}
