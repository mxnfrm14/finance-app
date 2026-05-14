import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { NextResponse } from "next/server"
import { z } from "zod"

const updatePositionSchema = z.object({
  name: z.string().min(1).optional(),
  ticker: z.string().optional(),
  sector: z.string().optional(),
  geography: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const position = await prisma.position.findFirst({
    where: { id, userId: session.user.id },
    include: {
      broker: { select: { id: true, name: true } },
      transactions: { orderBy: { date: "asc" } },
    },
  })

  if (!position) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(position)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [{ id }, body] = await Promise.all([params, req.json()])
  const parsed = updatePositionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Fusionner le check d'ownership et la mise à jour en une seule query
  // updateMany retourne { count } — on en déduit si la ligne existait
  const result = await prisma.position.updateMany({
    where: { id, userId: session.user.id },
    data: parsed.data,
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Re-fetch avec broker pour retourner la réponse enrichie
  const updated = await prisma.position.findUnique({
    where: { id },
    include: { broker: { select: { id: true, name: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  // Fusionner le check d'ownership et le soft-delete en une seule query
  const result = await prisma.position.updateMany({
    where: { id, userId: session.user.id },
    data: { isActive: false },
  })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return new NextResponse(null, { status: 204 })
}
