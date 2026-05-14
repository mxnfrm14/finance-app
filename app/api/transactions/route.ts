import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { syncPositionCache } from "@/lib/db/queries/portfolio-summary"
import { NextResponse } from "next/server"
import { z } from "zod"

const createTransactionSchema = z.object({
  positionId: z.string().min(1),
  type: z.enum(["BUY", "SELL", "DIVIDEND", "SPLIT", "TRANSFER"]),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  fees: z.number().nonnegative().default(0),
  currency: z.string().default("EUR"),
  date: z.string().datetime(),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const positionId = searchParams.get("positionId")
  if (!positionId) return NextResponse.json({ error: "positionId required" }, { status: 400 })

  // Vérifier ownership et récupérer les transactions en une seule query
  // via la relation position → userId
  const transactions = await prisma.transaction.findMany({
    where: {
      positionId,
      position: { userId: session.user.id },
    },
    orderBy: { date: "asc" },
  })

  // Si aucune transaction et que la position n'existe pas/appartient pas à l'user,
  // on vérifie l'existence de la position pour retourner le bon code d'erreur
  if (transactions.length === 0) {
    const position = await prisma.position.findFirst({
      where: { id: positionId, userId: session.user.id },
      select: { id: true },
    })
    if (!position) return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(transactions)
}

export async function POST(req: Request) {
  const [session, body] = await Promise.all([auth(), req.json()])
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = createTransactionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data

  // Vérifier ownership de la position
  const position = await prisma.position.findFirst({
    where: { id: data.positionId, userId: session.user.id },
  })
  if (!position) return NextResponse.json({ error: "Position not found" }, { status: 404 })

  // Créer la transaction
  const transaction = await prisma.transaction.create({
    data: {
      positionId: data.positionId,
      type: data.type,
      quantity: data.quantity,
      price: data.price,
      fees: data.fees,
      currency: data.currency,
      date: new Date(data.date),
      notes: data.notes,
    },
  })

  // Mettre à jour le cache PRU/quantité sur la position
  await syncPositionCache(data.positionId)

  return NextResponse.json(transaction, { status: 201 })
}
