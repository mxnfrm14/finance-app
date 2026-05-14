import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"

const createPositionSchema = z.object({
  isin: z.string().min(1),
  ticker: z.string().optional(),
  name: z.string().min(1),
  assetType: z.enum(["ACTION", "ETF", "OBLIGATION", "TURBO", "CRYPTO", "AUTRE"]),
  accountType: z.enum(["PEA", "CTO", "AV", "PEA-PME"]),
  brokerId: z.string().min(1),
  entryDate: z.string().datetime(),
  currency: z.string().default("EUR"),
  sector: z.string().optional(),
  geography: z.string().optional(),
  notes: z.string().optional(),
  barrierLevel: z.number().optional(),
  strikePrice: z.number().optional(),
  expiryDate: z.string().datetime().optional(),
  leverage: z.number().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const positions = await prisma.position.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      broker: { select: { id: true, name: true } },
      transactions: { orderBy: { date: "asc" }, select: { id: true, type: true, quantity: true, price: true, fees: true, date: true, notes: true, currency: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(positions)
}

export async function POST(req: Request) {
  const [session, body] = await Promise.all([auth(), req.json()])
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = createPositionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data

  // Vérifier que le broker appartient à l'utilisateur
  const broker = await prisma.broker.findFirst({
    where: { id: data.brokerId, userId: session.user.id },
  })
  if (!broker) return NextResponse.json({ error: "Broker not found" }, { status: 404 })

  try {
    const position = await prisma.position.create({
      data: {
        isin: data.isin,
        ticker: data.ticker,
        name: data.name,
        assetType: data.assetType,
        accountType: data.accountType,
        brokerId: data.brokerId,
        userId: session.user.id,
        entryDate: new Date(data.entryDate),
        currency: data.currency,
        sector: data.sector,
        geography: data.geography,
        notes: data.notes,
        barrierLevel: data.barrierLevel,
        strikePrice: data.strikePrice,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        leverage: data.leverage,
      },
      include: { broker: { select: { id: true, name: true } } },
    })

    return NextResponse.json(position, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Doublon : position déjà existante pour cet ISIN + compte + courtier
      const existing = await prisma.position.findFirst({
        where: { isin: data.isin, accountType: data.accountType, brokerId: data.brokerId, userId: session.user.id },
        select: { id: true },
      })
      return NextResponse.json(
        { error: "Cette position existe déjà dans cette enveloppe.", existingPositionId: existing?.id },
        { status: 409 }
      )
    }
    throw e
  }
}
