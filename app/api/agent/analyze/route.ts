import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { runAgentStream } from "@/lib/ai/agent-loop"
import { prisma } from "@/lib/db/client"

const requestSchema = z.object({
  message: z.string().min(1).max(4000),
  mode: z.enum(["portfolio", "instrument", "market"]),
  target: z.string().optional(),
  sessionId: z.string().optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { message, mode, target, history, sessionId } = parsed.data
  const userId = session.user.id

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const fullText: string[] = []

      function send(event: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        for await (const event of runAgentStream({ message, mode, target, userId, history })) {
          send(event)
          if (event.type === "text" && event.text) fullText.push(event.text)
        }

        // Persister la session agent en DB
        const assistantContent = fullText.join("")
        const updatedHistory = [
          ...(history ?? []),
          { role: "user" as const, content: message },
          { role: "assistant" as const, content: assistantContent },
        ]

        if (sessionId) {
          await prisma.agentSession.update({
            where: { id: sessionId },
            data: { messages: JSON.stringify(updatedHistory) },
          }).catch(() => {/* ignore if session doesn't exist */})
        } else {
          await prisma.agentSession.create({
            data: {
              userId,
              mode,
              target,
              messages: JSON.stringify(updatedHistory),
            },
          }).catch(() => {/* ignore DB errors */})
        }
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Erreur inconnue" })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
