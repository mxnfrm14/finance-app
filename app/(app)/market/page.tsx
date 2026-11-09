import type { Metadata } from "next"
import { MarketClient } from "@/components/market/market-client"

export const metadata: Metadata = {
  title: "Marché — Bourse",
  description: "Recherche d'instruments financiers et analyse de marché par IA."
}

export default async function MarketPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  return <MarketClient key={q ?? ""} initialQuery={q ?? ""} />
}
