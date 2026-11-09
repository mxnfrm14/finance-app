import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { aiConfigSchema } from "@/lib/ai/config"
import { aiSettings } from "@/lib/ai/settings"
import { createProvider } from "@/lib/ai/providers/factory"
import { aiErrorMessage } from "@/lib/ai/errors"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = aiConfigSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 })
  let provider
  try {
    provider = createProvider(await aiSettings.prepare(session.user.id, parsed.data))
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    const known = /^(Renseignez à nouveau|URL de l|L’URL doit|Ce serveur IA|La clé IA|Aucun provider)/.test(message)
    return NextResponse.json({ error: known ? message : "Impossible de préparer la connexion IA." }, { status: 400 })
  }
  let toolWorked = false
  let completed = false
  let text = ""
  try {
    for await (const event of provider.runAgentStream(
      [{ role: "user", content: "Appelle connection_check avec code=connexion-ok, puis réponds uniquement OK." }],
      [{ name: "connection_check", description: "Vérifie la connexion. Appeler avec code connexion-ok.", input_schema: {
        type: "object", properties: { code: { type: "string", description: "connexion-ok" } }, required: ["code"],
      } }],
      "Tu effectues un test de connexion. Utilise connection_check avant de répondre OK.",
      async (name, input) => {
        if (name !== "connection_check" || (input as { code?: string })?.code !== "connexion-ok") throw new Error("Appel de test invalide")
        toolWorked = true
        return { ok: true }
      },
      { signal: AbortSignal.timeout(45_000), maxOutputTokens: 256 },
    )) {
      if (event.type === "error") return NextResponse.json({ error: event.error }, { status: 422 })
      if (event.type === "text") text += event.text ?? ""
      if (event.type === "done") completed = true
    }
    if (!completed || !text.trim() || !toolWorked) return NextResponse.json({ error: "Le test n’a pas validé une réponse complète avec appel d’outil. Vérifiez le modèle et le protocole." }, { status: 422 })
    return NextResponse.json({ ok: true, message: "Connexion, streaming et appel d’outil validés." })
  } catch (error) {
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 422 })
  }
}
