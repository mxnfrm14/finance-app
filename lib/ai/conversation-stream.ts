import type { AgentEvent } from "./providers/types"
import type { ChatEvent } from "./conversations"
import type { ConversationRun, ConversationStore } from "./conversation-store"

export function conversationResponse({ store, run, signal, generate, checkpointMs = 5000 }: {
  store: Pick<ConversationStore, "save">
  run: ConversationRun
  signal: AbortSignal
  generate: (signal: AbortSignal) => AsyncIterable<AgentEvent>
  checkpointMs?: number
}) {
  const encoder = new TextEncoder()
  const abort = new AbortController()
  let disconnected = signal.aborted
  const onAbort = () => { disconnected = true; abort.abort() }
  signal.addEventListener("abort", onAbort, { once: true })
  if (disconnected) abort.abort()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let content = ""
      let completed = false
      let failure: string | undefined
      let persistenceFailed = false
      let queue: Promise<unknown> = Promise.resolve()
      function send(event: ChatEvent) {
        if (disconnected) return
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)) }
        catch { onAbort() }
      }
      // Serialize writes so a late checkpoint cannot overwrite the final answer.
      const timer = setInterval(() => {
        queue = queue.then(async () => {
          if (persistenceFailed || abort.signal.aborted) return
          await store.save(run, content, "streaming")
        }).catch(() => { persistenceFailed = true; abort.abort() })
      }, checkpointMs)
      send({ type: "session", conversation: run.conversation })
      try {
        for await (const event of generate(abort.signal)) {
          if (abort.signal.aborted) break
          if (event.type === "text" && event.text) {
            content += event.text
            send({ type: "text", text: event.text })
          } else if (event.type === "tool_start" || event.type === "tool_result") {
            send({ type: event.type, toolName: event.toolName ?? "" })
          } else if (event.type === "done") {
            completed = true
            break
          } else if (event.type === "error") {
            failure = event.error ?? "La réponse a échoué."
            break
          }
        }
      } catch {
        failure = "La réponse a été interrompue. Vous pouvez réessayer."
      } finally {
        clearInterval(timer)
        await queue
        const status = disconnected || persistenceFailed ? "interrupted" : failure ? "failed" : completed ? "complete" : "interrupted"
        const error = status === "complete" ? undefined : failure ?? "La réponse a été interrompue."
        try {
          const conversation = await store.save(run, content, status, error)
          if (persistenceFailed) {
            send({ type: "error", error: "La sauvegarde a été interrompue. Le texte récupéré a été conservé.", conversation })
          } else if (status === "complete") {
            send({ type: "done", conversation })
          } else {
            send({ type: "error", error: error!, conversation })
          }
        } catch {
          send({ type: "error", error: "Impossible d’enregistrer la réponse. Le texte reste visible ici ; rechargez l’historique pour vérifier la dernière sauvegarde." })
        }
        signal.removeEventListener("abort", onAbort)
        if (!disconnected) controller.close()
      }
    },
    cancel() { onAbort() },
  })
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no",
  } })
}
