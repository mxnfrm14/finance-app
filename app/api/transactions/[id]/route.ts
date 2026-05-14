import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { syncPositionCache } from "@/lib/db/queries/portfolio-summary"
import { NextResponse } from "next/server"
import { z } from "zod"

const updateTransactionSchema = z.object({
  type: z.enum(["BUY", "SELL", "DIVIDEND", "SPLIT", "TRANSFER"]).optional(),
  quantity: z.number().positive().optional(),
  price: z.number().nonnegative().optional(),
  fees: z.number().nonnegative().optional(),
  date: z.string().datetime().optional(),
  notes: z.string().optional(),
})

async function getTransactionWithOwnership(txId: string, userId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: txId },
    include: { position: { select: { userId: true } } },
  })
  if (!tx || tx.position.userId !== userId) return null
  return tx
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [session, { id }, body] = await Promise.all([auth(), params, req.json()])
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tx = await getTransactionWithOwnership(id, session.user.id)
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const parsed = updateTransactionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
  })

  await syncPositionCache(tx.positionId)

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const tx = await getTransactionWithOwnership(id, session.user.id)
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const positionId = tx.positionId

  await prisma.transaction.delete({ where: { id } })

  // Recalculer le cache PRU/quantité après suppression
  await syncPositionCache(positionId)

  return new NextResponse(null, { status: 204 })
}
