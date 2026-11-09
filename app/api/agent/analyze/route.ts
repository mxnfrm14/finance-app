import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { runAgentStream } from "@/lib/ai/agent-loop"
import { prisma } from "@/lib/db/client"
import { ConversationError, ConversationStore } from "@/lib/ai/conversation-store"
import { conversationResponse } from "@/lib/ai/conversation-stream"

export const runtime = "nodejs"
const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  mode: z.enum(["chat", "portfolio", "instrument", "market"]).default("chat"),
  target: z.string().trim().max(200).optional(),
  sessionId: z.string().min(1).max(200).optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = requestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Message invalide (4 000 caractères maximum)." }, { status: 400 })
  const { message, mode, target, sessionId } = parsed.data
  const userId = session.user.id
  const store = new ConversationStore(prisma)
  try {
    const run = await store.begin(userId, message, sessionId)
    return conversationResponse({
      store, run, signal: req.signal,
      generate: (signal) => runAgentStream({ message, mode, target, userId, history: run.history, signal }),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof ConversationError ? error.message : "Impossible d’enregistrer le message. Réessayez." },
      { status: error instanceof ConversationError ? error.status : 503 })
  }
}
