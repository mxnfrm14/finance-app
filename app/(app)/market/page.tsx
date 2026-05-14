import type { Metadata } from "next"
import { MarketClient } from "@/components/market/market-client"

export const metadata: Metadata = {
  title: "Marché — Bourse",
  description: "Recherche d'instruments financiers et analyse de marché par IA.",
}

export default function MarketPage() {
  return <MarketClient />
}
