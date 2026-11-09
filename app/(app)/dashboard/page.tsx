import type { Metadata } from "next"
import { auth } from "@/auth"
import { getPortfolioSummary } from "@/lib/db/queries/portfolio-summary"
import { DashboardClient } from "@/components/dashboard/dashboard-client"

export const metadata: Metadata = {
  title: "Tableau de bord — Bourse",
  description:
    "Votre portefeuille, vos performances et la répartition de vos investissements en un coup d’œil."
}

export default async function DashboardPage() {
  const session = await auth()
  const summary = await getPortfolioSummary(session?.user?.id ?? "").catch(() => null)

  return (
    <DashboardClient
      summary={summary}
      userName={session?.user?.name}
      updatedAt={new Date().toISOString()}
    />
  )
}
