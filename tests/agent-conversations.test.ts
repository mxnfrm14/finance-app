import assert from "node:assert/strict"
import { test } from "node:test"
import type { AgentSession, PrismaClient } from "@prisma/client"
import { ConversationError, ConversationStore } from "../lib/ai/conversation-store"
import { conversationResponse } from "../lib/ai/conversation-stream"
import { modelHistory, readChatEvents, readMessages, type ChatEvent } from "../lib/ai/conversations"

// A scoped store double exercises the real store, optimistic locking and stream lifecycle.
function fixture() {
  let clock = new Date("2026-11-09T10:00:00Z")
  const rows = new Map<string, AgentSession>()
  let sequence = 0
  type Where = Partial<Pick<AgentSession, "id" | "userId" | "revision" | "activeRunId">> & {
    OR?: Array<{ updatedAt: Date | { lt: Date }; id?: { lt: string } }>
  }
  function matches(row: AgentSession, where: Where) {
    for (const field of ["id", "userId", "revision", "activeRunId"] as const) {
      if (where[field] !== undefined && row[field] !== where[field]) return false
    }
    return !where.OR || where.OR.some((condition) => {
      const time = condition.updatedAt instanceof Date
        ? +row.updatedAt === +condition.updatedAt : row.updatedAt < condition.updatedAt.lt
      return time && (!condition.id || row.id < condition.id.lt)
    })
  }
  const db = {
    agentSession: {
      findFirst: async ({ where }: { where: Where }) => {
        const row = [...rows.values()].find((item) => matches(item, where))
        return row ? { ...row } : null
      },
      findMany: async ({ where, take }: { where: Where; take: number }) => [...rows.values()]
        .filter((row) => matches(row, where)).sort((a, b) => +b.updatedAt - +a.updatedAt || b.id.localeCompare(a.id)).slice(0, take),
      create: async ({ data }: { data: Partial<AgentSession> }) => {
        const row = { id: `session-${String(++sequence).padStart(4, "0")}`, createdAt: clock, updatedAt: clock,
          revision: 0, activeRunId: null, runExpiresAt: null, riskScore: null, target: null, ...data } as AgentSession
        rows.set(row.id, row)
        return { ...row }
      },
      updateMany: async ({ where, data }: { where: Where; data: Omit<Partial<AgentSession>, "revision"> & { revision?: { increment: number } } }) => {
        let count = 0
        for (const row of rows.values()) if (matches(row, where)) {
          const { revision, ...rest } = data
          Object.assign(row, rest)
          row.revision += revision?.increment ?? 0
          count++
        }
        return { count }
      },
      deleteMany: async ({ where }: { where: Where }) => {
        let count = 0
        for (const row of rows.values()) if (matches(row, where)) { rows.delete(row.id); count++ }
        return { count }
      },
    },
  }
  return { store: new ConversationStore(db as unknown as PrismaClient, () => clock), rows,
    advance: (milliseconds: number) => { clock = new Date(+clock + milliseconds) } }
}

test("a conversation is saved before generation, resumed by ID and never truncated to model context", async () => {
  const { store, rows } = fixture()
  let run = await store.begin("alice", "  Analyser mon portfolio  ")
  assert.equal(rows.size, 1)
  assert.equal(readMessages(rows.get(run.id)!.messages)[0].content, "  Analyser mon portfolio  ")
  await store.save(run, "Première réponse", "complete")
  for (let index = 0; index < 15; index++) {
    run = await store.begin("alice", `Question ${index}`, run.id)
    assert.ok(run.history.length <= 20)
    await store.save(run, `Réponse ${index}`, "complete")
  }
  assert.equal(rows.size, 1)
  const loaded = await store.get("alice", run.id)
  assert.equal(loaded.messages.length, 32)
  assert.equal(loaded.messages[1].content, "Première réponse")
  assert.equal(modelHistory(loaded.messages).length, 20)
})

test("list, read, resume and delete are isolated by owner", async () => {
  const { store } = fixture()
  const alice = await store.begin("alice", "Privé")
  await store.save(alice, "Réponse privée", "complete")
  await store.begin("bob", "Autre question")
  const missing = (error: unknown) => error instanceof ConversationError && error.status === 404
  await assert.rejects(() => store.get("bob", alice.id), missing)
  await assert.rejects(() => store.begin("bob", "Intrusion", alice.id), missing)
  await assert.rejects(() => store.remove("bob", alice.id), missing)
  assert.equal((await store.list("bob")).conversations.length, 1)
  await store.remove("alice", alice.id)
  await assert.rejects(() => store.get("alice", alice.id), missing)
})

test("simultaneous starts cannot overwrite one another and active conversations cannot be deleted", async () => {
  const { store } = fixture()
  const first = await store.begin("alice", "Premier")
  await assert.rejects(() => store.remove("alice", first.id), { status: 409 })
  await assert.rejects(() => store.begin("alice", "Doublon", first.id), { status: 409 })
  await store.save(first, "Fini", "complete")
  const results = await Promise.allSettled([store.begin("alice", "A", first.id), store.begin("alice", "B", first.id)])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal((await store.get("alice", first.id)).messages.length, 4)
})

test("an expired generation retains partial text and cannot overwrite its replacement", async () => {
  const { store, advance } = fixture()
  const first = await store.begin("alice", "Question")
  await store.save(first, "Texte partiel", "streaming")
  advance(91_000)
  const loaded = await store.get("alice", first.id)
  assert.equal(loaded.running, false)
  assert.equal(loaded.messages[1].status, "interrupted")
  const next = await store.begin("alice", "Continuer", first.id)
  assert.ok(!next.history.some((message) => message.content === "Texte partiel"))
  await assert.rejects(() => store.save(first, "Ancienne réponse", "complete"), { status: 409 })
  await store.save(next, "Nouvelle réponse", "complete")
  assert.equal((await store.get("alice", first.id)).messages[1].content, "Texte partiel")
})

test("pagination is stable for tied timestamps and rejects invalid cursors", async () => {
  const { store } = fixture()
  for (let index = 0; index < 35; index++) await store.begin("alice", `Question ${index}`)
  await store.begin("bob", "Invisible")
  const first = await store.list("alice")
  const second = await store.list("alice", first.nextCursor!)
  assert.equal(first.conversations.length, 30)
  assert.equal(second.conversations.length, 5)
  assert.equal(new Set([...first.conversations, ...second.conversations].map((row) => row.id)).size, 35)
  assert.equal(second.nextCursor, null)
  await assert.rejects(() => store.list("alice", "invalid"), { status: 400 })
})

test("legacy messages remain readable, malformed history is not overwritten", async () => {
  const { store, rows } = fixture()
  const run = await store.begin("alice", "Question")
  await store.save(run, "Réponse", "complete")
  rows.get(run.id)!.messages = JSON.stringify([{ role: "user", content: "Ancien" }, { role: "assistant", content: "Historique" }])
  assert.equal((await store.get("alice", run.id)).messages[1].status, "complete")
  const next = await store.begin("alice", "Suite", run.id)
  await store.save(next, "Suite conservée", "complete")
  rows.get(run.id)!.messages = "malformed"
  await assert.rejects(() => store.begin("alice", "Suite", run.id))
  assert.equal(rows.get(run.id)!.messages, "malformed")
})

test("done is emitted only after the final database write, and tool data is omitted", async () => {
  const { store } = fixture()
  const run = await store.begin("alice", "Question")
  let finalSaved = false
  const response = conversationResponse({
    run, signal: new AbortController().signal,
    store: { save: async (...args) => { const saved = await store.save(...args); if (args[2] === "complete") finalSaved = true; return saved } },
    generate: async function* () {
      yield { type: "tool_result", toolName: "example", result: { secret: "tool payload" } }
      yield { type: "text", text: "Réponse" }
      yield { type: "done" }
    },
  })
  const events: ChatEvent[] = []
  for await (const event of readChatEvents(response.body!)) {
    if (event.type === "done") assert.equal(finalSaved, true)
    events.push(event)
  }
  assert.equal(events[0].type, "session")
  assert.equal(events.at(-1)?.type, "done")
  assert.ok(!JSON.stringify(events).includes("tool payload"))
})

test("AI errors and premature stream endings preserve partial answers with distinct status", async () => {
  for (const fail of [false, true]) {
    const { store } = fixture()
    const run = await store.begin("alice", "Question")
    const response = conversationResponse({ store, run, signal: new AbortController().signal,
      generate: async function* () { yield { type: "text", text: "Partiel" }; if (fail) yield { type: "error", error: "Quota atteint" } },
    })
    const events = await Array.fromAsync(readChatEvents(response.body!))
    assert.equal(events.at(-1)?.type, "error")
    const message = (await store.get("alice", run.id)).messages.at(-1)!
    assert.equal(message.content, "Partiel")
    assert.equal(message.status, fail ? "failed" : "interrupted")
  }
})

test("database failure never produces a successful done event or discards visible text", async () => {
  const { store } = fixture()
  const run = await store.begin("alice", "Question")
  const response = conversationResponse({ run, signal: new AbortController().signal,
    store: { save: async () => { throw new Error("Database offline") } },
    generate: async function* () { yield { type: "text", text: "Visible" }; yield { type: "done" } },
  })
  const events = await Array.fromAsync(readChatEvents(response.body!))
  assert.ok(events.some((event) => event.type === "text" && event.text === "Visible"))
  assert.ok(!events.some((event) => event.type === "done"))
  assert.match((events.at(-1) as { error: string }).error, /enregistrer/)
})

test("checkpoint writes are serialized and disconnection saves an interrupted answer", async () => {
  const { store } = fixture()
  const run = await store.begin("alice", "Question")
  const abort = new AbortController()
  const writes: string[] = []
  let saved!: () => void
  const finalized = new Promise<void>((resolve) => { saved = resolve })
  const response = conversationResponse({ run, signal: abort.signal, checkpointMs: 5,
    store: { save: async (...args) => {
      writes.push(args[2])
      await new Promise((resolve) => setTimeout(resolve, 8))
      const result = await store.save(...args)
      if (args[2] !== "streaming") saved()
      return result
    } },
    generate: async function* (signal) {
      yield { type: "text", text: "Sauvegardé" }
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
    },
  })
  const reader = response.body!.getReader()
  await reader.read()
  await new Promise((resolve) => setTimeout(resolve, 25))
  abort.abort()
  await finalized
  assert.equal(writes.at(-1), "interrupted")
  assert.ok(writes.includes("streaming"))
  assert.equal((await store.get("alice", run.id)).messages.at(-1)?.content, "Sauvegardé")
  await reader.cancel()
})

test("SSE parser handles UTF-8 split between chunks, CRLF and an unterminated last line", async () => {
  const bytes = new TextEncoder().encode('data: {"type":"text","text":"é€"}\r\n\r\ndata: {"type":"error","error":"fin"}')
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
    controller.close()
  } })
  assert.deepEqual(await Array.fromAsync(readChatEvents(body)), [{ type: "text", text: "é€" }, { type: "error", error: "fin" }])
})
