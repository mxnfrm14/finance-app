import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { ConversationError, ConversationStore } from "@/lib/ai/conversation-store"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const cursor = new URL(req.url).searchParams.get("cursor") ?? undefined
    return Response.json(await new ConversationStore(prisma).list(session.user.id, cursor))
  } catch (error) {
    return Response.json({ error: error instanceof ConversationError ? error.message : "Impossible de charger l’historique." },
      { status: error instanceof ConversationError ? error.status : 503 })
  }
}
