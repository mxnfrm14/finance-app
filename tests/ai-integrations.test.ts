import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import type { PrismaClient } from "@prisma/client"
import { encryptAiSecret, decryptAiSecret } from "../lib/ai/secrets"
import { aiConfigSchema } from "../lib/ai/config"
import { createAiFetch, resolveAiBaseUrl } from "../lib/ai/endpoints"
import { AiSettingsStore } from "../lib/ai/settings-store"
import { OpenAIProvider } from "../lib/ai/providers/openai"
import { AnthropicProvider } from "../lib/ai/providers/anthropic"
import type { AIProvider, AgentEvent } from "../lib/ai/providers/types"

const encryptionKey = process.env.AI_ENCRYPTION_KEY
const allowedOrigins = process.env.AI_ALLOWED_API_ORIGINS
beforeEach(() => { process.env.AI_ENCRYPTION_KEY = "test-encryption-secret-that-is-at-least-32-characters"; delete process.env.AI_ALLOWED_API_ORIGINS })
afterEach(() => {
  if (encryptionKey === undefined) delete process.env.AI_ENCRYPTION_KEY
  else process.env.AI_ENCRYPTION_KEY = encryptionKey
  if (allowedOrigins === undefined) delete process.env.AI_ALLOWED_API_ORIGINS
  else process.env.AI_ALLOWED_API_ORIGINS = allowedOrigins
})

test("API keys are randomized, authenticated and bound to the user and provider", () => {
  const first = encryptAiSecret("sk-private", "alice", "openai")
  assert.notEqual(first, encryptAiSecret("sk-private", "alice", "openai"))
  assert.ok(!first.includes("sk-private"))
  assert.equal(decryptAiSecret(first, "alice", "openai"), "sk-private")
  assert.throws(() => decryptAiSecret(first, "bob", "openai"))
  assert.throws(() => decryptAiSecret(first, "alice", "anthropic"))
  const parts = first.split("."); parts[3] = Buffer.from("tampered").toString("base64url")
  assert.throws(() => decryptAiSecret(parts.join("."), "alice", "openai"))
})

test("Ollama and incompatible protocol combinations are rejected", () => {
  assert.equal(aiConfigSchema.safeParse({ provider: "ollama", protocol: "chat-completions", model: "anything" }).success, false)
  assert.equal(aiConfigSchema.safeParse({ provider: "anthropic", protocol: "responses", model: "anything" }).success, false)
  assert.equal(aiConfigSchema.safeParse({ provider: "compatible", protocol: "messages", model: "anything", baseUrl: "https://openrouter.ai/api/v1" }).success, false)
  assert.equal(aiConfigSchema.safeParse({ provider: "openai", protocol: "responses", model: "accessible-model" }).success, true)
})

test("custom endpoints need an approved origin and cannot embed credentials", () => {
  assert.throws(() => resolveAiBaseUrl("compatible", "http://127.0.0.1:8000/v1"), /administrateur/)
  assert.throws(() => resolveAiBaseUrl("compatible", "https://secret@openrouter.ai/api/v1"))
  assert.throws(() => resolveAiBaseUrl("compatible", "https://openrouter.ai/api/v1?api_key=secret"))
  assert.equal(resolveAiBaseUrl("compatible", "https://openrouter.ai/api/v1/"), "https://openrouter.ai/api/v1")
  process.env.AI_ALLOWED_API_ORIGINS = "http://192.168.1.20:8000"
  assert.equal(resolveAiBaseUrl("compatible", "http://192.168.1.20:8000/v1"), "http://192.168.1.20:8000/v1")
  assert.throws(() => resolveAiBaseUrl("compatible", "http://192.168.1.21:8000/v1"))
})

test("SDK requests reject redirects and cannot leave the configured endpoint", async () => {
  let redirect: RequestRedirect | undefined
  const fetcher = createAiFetch("https://example.test/v1", async (_input, init) => { redirect = init?.redirect; return new Response("ok") })
  await fetcher("https://example.test/v1/responses")
  assert.equal(redirect, "error")
  await assert.rejects(() => fetcher("https://elsewhere.test/v1/responses"))
  await assert.rejects(() => fetcher("https://example.test/admin"))
})

// Exercise the real settings store against a scoped in-memory Prisma stand-in.
function settingsFixture() {
  type Row = { userId: string; provider: string; model: string; protocol: string; baseUrl: string; encryptedApiKey: string | null }
  const users = new Map([ ["alice", { aiProvider: null as string | null }], ["bob", { aiProvider: null as string | null }] ])
  const rows = new Map<string, Row>()
  const id = (key: { userId: string; provider: string }) => `${key.userId}:${key.provider}`
  const db = {
    user: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => users.get(where.id)!,
      update: async ({ where, data }: { where: { id: string }; data: { aiProvider: string } }) => Object.assign(users.get(where.id)!, data),
      updateMany: async ({ where, data }: { where: { id: string; aiProvider: string }; data: { aiProvider: null } }) => {
        if (users.get(where.id)?.aiProvider === where.aiProvider) Object.assign(users.get(where.id)!, data)
        return { count: 1 }
      },
    },
    aiConnection: {
      findUnique: async ({ where }: { where: { userId_provider: { userId: string; provider: string } } }) => rows.get(id(where.userId_provider)) ?? null,
      findMany: async ({ where }: { where: { userId: string } }) => [...rows.values()].filter((row) => row.userId === where.userId),
      upsert: async ({ where, create, update }: { where: { userId_provider: { userId: string; provider: string } }; create: Row; update: Partial<Row> }) => {
        const key = id(where.userId_provider); rows.set(key, rows.has(key) ? { ...rows.get(key)!, ...update } : create)
      },
      deleteMany: async ({ where }: { where: { userId: string; provider: string } }) => { rows.delete(id(where)); return { count: 1 } },
    },
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
  }
  return { store: new AiSettingsStore(db as unknown as PrismaClient), rows }
}

test("two users' saved credentials, active providers and deletions stay isolated", async () => {
  const { store, rows } = settingsFixture()
  await store.save("alice", { provider: "openai", protocol: "responses", model: "model-a", apiKey: "alice-secret" })
  await store.save("bob", { provider: "openai", protocol: "responses", model: "model-b", apiKey: "bob-secret" })
  assert.equal((await store.credentials("alice", "openai"))?.apiKey, "alice-secret")
  assert.equal((await store.credentials("bob", "openai"))?.apiKey, "bob-secret")
  assert.equal((await store.read("bob")).connections[0].model, "model-b")
  assert.ok(!JSON.stringify(await store.read("alice")).includes("secret"))
  assert.ok(!JSON.stringify([...rows.values()]).includes("alice-secret"))
  await store.remove("alice", "openai")
  assert.equal((await store.read("alice")).provider, null)
  assert.equal((await store.read("bob")).provider, "openai")
  assert.equal((await store.credentials("bob", "openai"))?.apiKey, "bob-secret")
})

test("switching providers preserves each key, and changing origins requires a new key", async () => {
  const { store } = settingsFixture()
  await store.save("alice", { provider: "openai", protocol: "responses", model: "a", apiKey: "key-openai" })
  await store.save("alice", { provider: "anthropic", protocol: "messages", model: "b", apiKey: "key-anthropic" })
  await store.save("alice", { provider: "openai", protocol: "responses", model: "c", apiKey: "" })
  assert.equal((await store.credentials("alice", "openai"))?.apiKey, "key-openai")
  assert.equal((await store.credentials("alice", "anthropic"))?.apiKey, "key-anthropic")
  await store.save("alice", { provider: "compatible", protocol: "responses", model: "a", apiKey: "gateway-key", baseUrl: "https://openrouter.ai/api/v1" })
  await assert.rejects(() => store.prepare("alice", { provider: "compatible", protocol: "responses", model: "a", baseUrl: "https://api.mistral.ai/v1" }), /changement d’URL/)
  assert.equal(await store.credentials("bob", "compatible"), null)
})

test("a user can replace or delete an unreadable key after encryption-key rotation", async () => {
  const { store } = settingsFixture()
  await store.save("alice", { provider: "openai", protocol: "responses", model: "a", apiKey: "old-key" })
  await store.save("bob", { provider: "openai", protocol: "responses", model: "a", apiKey: "bob-old-key" })
  process.env.AI_ENCRYPTION_KEY = "a-different-stable-secret-at-least-32-characters"
  await assert.rejects(() => store.credentials("alice", "openai"), /déchiffrée/)
  await store.save("alice", { provider: "openai", protocol: "responses", model: "a", apiKey: "replacement-key" })
  assert.equal((await store.credentials("alice", "openai"))?.apiKey, "replacement-key")
  await store.remove("bob", "openai")
  assert.equal(await store.credentials("bob", "openai"), null)
})

function sse(events: unknown[]) {
  return new Response(events.map((event) => `${(event as { type?: string }).type ? `event: ${(event as { type: string }).type}\n` : ""}data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } })
}
const tool = { name: "test_tool", description: "Test tool", input_schema: { type: "object" as const, properties: { value: { type: "string", description: "Test value" } }, required: ["value"] } }
async function run(provider: AIProvider, execute: (name: string, input: unknown) => Promise<unknown> = async () => ({ ok: true })) {
  const events: AgentEvent[] = []
  for await (const event of provider.runAgentStream([{ role: "user", content: "test" }], [tool], "test", execute)) events.push(event)
  return events
}

test("Responses replays tool IDs and reasoning without storing server-side state", async () => {
  const requests: Array<Record<string, unknown>> = []
  const reasoning = { type: "reasoning", id: "rs_1", summary: [], encrypted_content: "opaque-reasoning" }
  const call = { type: "function_call", id: "fc_1", call_id: "original-call", name: "test_tool", arguments: '{"value":"ok"}', status: "completed" }
  const provider = new OpenAIProvider({ model: "test", protocol: "responses", baseURL: "https://api.openai.com/v1", apiKey: "personal", fetch: async (input, init) => {
    assert.equal(String(input), "https://api.openai.com/v1/responses")
    requests.push(JSON.parse(init?.body as string))
    return requests.length === 1 ? sse([{ type: "response.completed", response: { output: [reasoning, call] } }]) : sse([
      { type: "response.output_text.delta", delta: "OK" },
      { type: "response.completed", response: { output: [{ type: "message", id: "msg_1", role: "assistant", content: [{ type: "output_text", text: "OK", annotations: [] }], status: "completed" }] } },
    ])
  } })
  const events = await run(provider)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].store, false)
  assert.equal(requests[0].stream, true)
  assert.ok((requests[1].input as unknown[]).some((item) => JSON.stringify(item) === JSON.stringify(reasoning)))
  assert.ok((requests[1].input as { call_id?: string; type: string }[]).some((item) => item.type === "function_call_output" && item.call_id === "original-call"))
  assert.equal(events.at(-1)?.type, "done")
  assert.ok(events.some((event) => event.type === "tool_result"))
})

test("Responses interrupted and failed streams are errors, never successful completion", async () => {
  for (const response of [sse([{ type: "response.output_text.delta", delta: "partial" }]), sse([{ type: "response.failed", response: { error: { message: "secret-server-body" } } }])]) {
    const provider = new OpenAIProvider({ model: "test", protocol: "responses", baseURL: "https://api.openai.com/v1", apiKey: "personal", fetch: async () => response })
    const events = await run(provider)
    assert.equal(events.at(-1)?.type, "error")
    assert.ok(!events.some((event) => event.type === "done"))
    assert.ok(!JSON.stringify(events).includes("secret-server-body"))
  }
})

test("Chat Completions preserves provider call IDs across fragmented parallel calls", async () => {
  const requests: { messages: { tool_call_id?: string }[] }[] = []
  const provider = new OpenAIProvider({ model: "test", protocol: "chat-completions", baseURL: "https://example.test/v1", apiKey: "personal", fetch: async (_input, init) => {
    requests.push(JSON.parse(init?.body as string))
    return requests.length === 1 ? sse([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "server-call-a", function: { name: "test_tool", arguments: '{"value":' } }, { index: 1, id: "server-call-b", function: { name: "test_tool", arguments: '{"value":"b"}' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"a"}' } }] }, finish_reason: "tool_calls" }] },
    ]) : sse([{ choices: [{ delta: { content: "OK" }, finish_reason: "stop" }] }])
  } })
  const events = await run(provider)
  assert.deepEqual(requests[1].messages.filter((message) => message.tool_call_id).map((message) => message.tool_call_id), ["server-call-a", "server-call-b"])
  assert.equal(events.at(-1)?.type, "done")
})

test("malformed tool JSON is returned to the model without executing the tool", async () => {
  let count = 0
  let executed = false
  const provider = new OpenAIProvider({ model: "test", protocol: "responses", baseURL: "https://example.test/v1", apiKey: "personal", fetch: async () => {
    count++
    return sse([{ type: "response.completed", response: { output: count === 1 ? [{ type: "function_call", id: "fc_bad", call_id: "call_bad", name: "test_tool", arguments: "{invalid" }] : [] } }])
  } })
  const events = await run(provider, async () => { executed = true })
  assert.equal(executed, false)
  assert.equal(count, 2)
  assert.equal(events.at(-1)?.type, "done")
})

test("upstream authentication errors are normalized without leaking the response body", async () => {
  const provider = new OpenAIProvider({ model: "test", protocol: "responses", baseURL: "https://example.test/v1", apiKey: "personal", fetch: async () => new Response(JSON.stringify({ error: { message: "private-upstream-secret" } }), { status: 401 }) })
  assert.deepEqual(await run(provider), [{ type: "error", error: "AUTH_ERROR" }])
})

test("Anthropic uses /v1/messages, the personal key, and replays complete assistant blocks", async () => {
  const requests: { messages: unknown[] }[] = []
  const provider = new AnthropicProvider("test-model", "personal-anthropic", async (input, init) => {
    assert.equal(String(input), "https://api.anthropic.com/v1/messages")
    assert.equal(new Headers(init?.headers).get("x-api-key"), "personal-anthropic")
    requests.push(JSON.parse(init?.body as string))
    const first = requests.length === 1
    return sse([
      { type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", model: "test-model", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
      { type: "content_block_start", index: 0, content_block: first ? { type: "tool_use", id: "anthropic-call", name: "test_tool", input: {} } : { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: first ? { type: "input_json_delta", partial_json: '{"value":"ok"}' } : { type: "text_delta", text: "OK" } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: first ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 12 } },
      { type: "message_stop" },
    ])
  })
  const events = await run(provider)
  assert.equal(requests.length, 2)
  assert.ok(JSON.stringify(requests[1].messages).includes("anthropic-call"))
  assert.equal(events.at(-1)?.type, "done")
})
