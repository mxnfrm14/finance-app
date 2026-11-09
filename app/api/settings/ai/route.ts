import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { aiConfigSchema, PROVIDERS } from "@/lib/ai/config"
import { z } from "zod"
import { aiSettings } from "@/lib/ai/settings"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = aiConfigSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 })
  try {
    return NextResponse.json(await aiSettings.save(session.user.id, parsed.data), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    const known = /^(Configurez AI_ENCRYPTION_KEY|La clé IA|Renseignez à nouveau|URL de l|L’URL doit|Ce serveur IA)/.test(message)
    return NextResponse.json({ error: known ? message : "Impossible d’enregistrer la connexion IA. Vérifiez la configuration du serveur." }, { status: 400 })
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json(await aiSettings.read(session.user.id), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Impossible de charger les connexions IA. Vérifiez que les migrations sont appliquées." }, { status: 503 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = z.object({ provider: z.enum(PROVIDERS) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Fournisseur invalide." }, { status: 400 })
  try {
    return NextResponse.json(await aiSettings.remove(session.user.id, parsed.data.provider), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Impossible de supprimer la connexion IA." }, { status: 500 })
  }
}
