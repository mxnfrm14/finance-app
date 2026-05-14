import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { NextResponse } from "next/server"
import { z } from "zod"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

const createBrokerSchema = z.object({
  name: z.string().min(1),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brokers = await prisma.broker.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(brokers)
}

export async function POST(req: Request) {
  const [session, body] = await Promise.all([auth(), req.json()])
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = createBrokerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const slug = slugify(parsed.data.name)

  const existing = await prisma.broker.findFirst({
    where: { slug, userId: session.user.id },
  })
  if (existing) return NextResponse.json({ error: "Ce courtier existe déjà." }, { status: 409 })

  const broker = await prisma.broker.create({
    data: { name: parsed.data.name, slug, userId: session.user.id },
  })

  return NextResponse.json(broker, { status: 201 })
}
