import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { ConversationError, ConversationStore } from "@/lib/ai/conversation-store"

type Context = { params: Promise<{ id: string }> }
async function handle(context: Context, remove: boolean) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await context.params
  const store = new ConversationStore(prisma)
  try {
    if (remove) {
      await store.remove(session.user.id, id)
      return new Response(null, { status: 204 })
    }
    return Response.json(await store.get(session.user.id, id))
  } catch (error) {
    return Response.json({ error: error instanceof ConversationError ? error.message : "Impossible de lire ou supprimer cette conversation." },
      { status: error instanceof ConversationError ? error.status : 503 })
  }
}
export async function GET(_req: Request, context: Context) { return handle(context, false) }
export async function DELETE(_req: Request, context: Context) { return handle(context, true) }
