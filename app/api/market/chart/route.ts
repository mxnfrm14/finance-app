import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getChartPrices } from "@/lib/market-data/get-chart-prices"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const search = url.searchParams
  const ticker = search.get("ticker")
  if (!ticker) return NextResponse.json({ error: "ticker requis" }, { status: 400 })

  const period = search.get("period") ?? undefined
  const interval = search.get("interval") ?? undefined
  const period1 = search.get("period1") ?? undefined
  const period2 = search.get("period2") ?? undefined

  const data = await getChartPrices(ticker, { period, interval, period1, period2 })
  if ((data as any).error) return NextResponse.json({ error: (data as any).error }, { status: 500 })
  return NextResponse.json(data)
}
