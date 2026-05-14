import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { getCachedQuotesByTicker } from "@/lib/market-data/price-cache"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tickers = searchParams.get("tickers")?.split(",").map((t) => t.trim()).filter(Boolean)
  if (!tickers?.length) return NextResponse.json({ error: "tickers requis" }, { status: 400 })

  const quotes = await getCachedQuotesByTicker(tickers)
  return NextResponse.json(Object.fromEntries(quotes))
}
