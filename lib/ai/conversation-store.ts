import { randomUUID } from "node:crypto"
import type { AgentSession, PrismaClient } from "@prisma/client"
import { modelHistory, readMessages, type ChatMessage, type Conversation, type ConversationPage, type MessageStatus } from "./conversations"

const LEASE_MS = 90_000
const PAGE_SIZE = 30

export class ConversationError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export interface ConversationRun {
  userId: string
  id: string
  runId: string
  messages: ChatMessage[]
  history: ReturnType<typeof modelHistory>
  conversation: Conversation
}

export class ConversationStore {
  constructor(private db: PrismaClient, private now = () => new Date()) {}

  private running(row: AgentSession) {
    return !!row.activeRunId && !!row.runExpiresAt && row.runExpiresAt > this.now()
  }

  private summary(row: Pick<AgentSession, "id" | "title" | "updatedAt" | "activeRunId" | "runExpiresAt">) {
    return {
      id: row.id, title: row.title, updatedAt: row.updatedAt.toISOString(),
      running: !!row.activeRunId && !!row.runExpiresAt && row.runExpiresAt > this.now(),
    }
  }

  private conversation(row: AgentSession): Conversation {
    const running = this.running(row)
    return {
      ...this.summary(row),
      messages: readMessages(row.messages).map((m) =>
        m.status === "streaming" && !running ? { ...m, status: "interrupted" } : m),
    }
  }

  private async owned(userId: string, id: string) {
    const row = await this.db.agentSession.findFirst({ where: { id, userId } })
    if (!row) throw new ConversationError("Conversation introuvable.", 404)
    return row
  }

  async get(userId: string, id: string) { return this.conversation(await this.owned(userId, id)) }

  async list(userId: string, cursor?: string): Promise<ConversationPage> {
    let before: { updatedAt: Date; id: string } | undefined
    if (cursor) {
      try {
        const value = JSON.parse(Buffer.from(cursor, "base64url").toString())
        if (typeof value.id !== "string" || typeof value.updatedAt !== "string") throw new Error()
        before = { id: value.id, updatedAt: new Date(value.updatedAt) }
        if (Number.isNaN(before.updatedAt.getTime())) throw new Error()
      } catch { throw new ConversationError("Pagination invalide.", 400) }
    }
    const rows = await this.db.agentSession.findMany({
      where: {
        userId,
        ...(before ? { OR: [
          { updatedAt: { lt: before.updatedAt } },
          { updatedAt: before.updatedAt, id: { lt: before.id } },
        ] } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1,
      select: { id: true, title: true, updatedAt: true, activeRunId: true, runExpiresAt: true },
    })
    const page = rows.slice(0, PAGE_SIZE)
    const last = page.at(-1)
    return {
      conversations: page.map((r) => this.summary(r)),
      nextCursor: rows.length > PAGE_SIZE && last
        ? Buffer.from(JSON.stringify({ id: last.id, updatedAt: last.updatedAt })).toString("base64url") : null,
    }
  }

  async remove(userId: string, id: string) {
    const row = await this.owned(userId, id)
    if (this.running(row)) throw new ConversationError("Attendez la fin de la réponse avant de supprimer cette conversation.", 409)
    const result = await this.db.agentSession.deleteMany({ where: { id, userId, revision: row.revision } })
    if (!result.count) throw new ConversationError("La conversation a changé. Réessayez.", 409)
  }

  async begin(userId: string, message: string, sessionId?: string): Promise<ConversationRun> {
    const row = sessionId ? await this.owned(userId, sessionId) : null
    if (row && this.running(row)) throw new ConversationError("Une réponse est déjà en cours dans cette conversation.", 409)
    const previous = row ? this.conversation(row).messages : []
    const history = modelHistory(previous)
    const messages: ChatMessage[] = [
      ...previous,
      { id: randomUUID(), role: "user", content: message, status: "complete" },
      { id: randomUUID(), role: "assistant", content: "", status: "streaming" },
    ]
    const runId = randomUUID()
    const now = this.now()
    const data = {
      messages: JSON.stringify(messages), activeRunId: runId,
      runExpiresAt: new Date(now.getTime() + LEASE_MS), updatedAt: now,
    }
    let saved: AgentSession
    if (row) {
      const result = await this.db.agentSession.updateMany({
        where: { id: row.id, userId, revision: row.revision },
        data: { ...data, revision: { increment: 1 } },
      })
      if (!result.count) throw new ConversationError("La conversation a changé. Rechargez-la avant de réessayer.", 409)
      saved = { ...row, ...data, revision: row.revision + 1 }
    } else {
      saved = await this.db.agentSession.create({ data: {
        ...data, userId, mode: "chat", modelVersion: "", title: message.replace(/\s+/g, " ").slice(0, 80),
      } })
    }
    return { userId, id: saved.id, runId, messages, history, conversation: this.conversation(saved) }
  }

  async save(run: ConversationRun, content: string, status: MessageStatus, error?: string): Promise<Conversation> {
    const messages = run.messages.map((m, index) => index === run.messages.length - 1
      ? { ...m, content, status, ...(error ? { error } : {}) } : m)
    const now = this.now()
    const running = status === "streaming"
    const result = await this.db.agentSession.updateMany({
      where: { id: run.id, userId: run.userId, activeRunId: run.runId },
      data: {
        messages: JSON.stringify(messages), revision: { increment: 1 }, updatedAt: now,
        activeRunId: running ? run.runId : null,
        runExpiresAt: running ? new Date(now.getTime() + LEASE_MS) : null,
      },
    })
    if (!result.count) throw new ConversationError("Cette génération n’est plus active. Rechargez la conversation.", 409)
    return { ...run.conversation, updatedAt: now.toISOString(), running, messages }
  }
}
