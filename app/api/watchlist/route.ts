import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { NextResponse } from "next/server"
import { z } from "zod"

const addSchema = z.object({
  isin: z.string().min(1),
  name: z.string().min(1),
  ticker: z.string().optional(),
  addedPrice: z.number().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.watchlistItem.findMany({
    where: { userId: session.user.id },
    orderBy: { addedAt: "desc" },
  })

  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const [session, body] = await Promise.all([auth(), req.json()])
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = addSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const item = await prisma.watchlistItem.create({
      data: {
        userId: session.user.id,
        isin: parsed.data.isin,
        name: parsed.data.name,
        ticker: parsed.data.ticker,
        addedPrice: parsed.data.addedPrice,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Cet instrument est déjà dans votre watchlist" }, { status: 409 })
  }
}
