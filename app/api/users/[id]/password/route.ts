import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"

const schema = z.object({
  password: z.string().min(8, "8 caractères minimum"),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  await prisma.user.update({ where: { id }, data: { passwordHash } })

  return NextResponse.json({ ok: true })
}
