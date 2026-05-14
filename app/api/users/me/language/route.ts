import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  language: z.enum(["fr", "en"]),
})

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { language: parsed.data.language },
  })

  return NextResponse.json({ ok: true })
}
