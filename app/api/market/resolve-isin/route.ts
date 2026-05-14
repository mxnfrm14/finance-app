import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { resolveTickerToISIN } from "@/lib/market-data/yahoo-finance"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get("ticker")?.trim()
  if (!ticker) return NextResponse.json({ error: "ticker requis" }, { status: 400 })

  const isin = await resolveTickerToISIN(ticker)
  return NextResponse.json({ isin })
}
