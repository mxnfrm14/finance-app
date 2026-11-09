import type { PrismaClient } from "@prisma/client"
import { aiConfigSchema, PROVIDERS, type AiConfigInput, type AiProviderName, type PublicAiConnection, type PublicAiSettings } from "./config"
import { resolveAiBaseUrl } from "./endpoints"
import { decryptAiSecret, encryptAiSecret } from "./secrets"

export class AiSettingsStore {
  constructor(private db: PrismaClient) {}

  async read(userId: string): Promise<PublicAiSettings> {
    const [user, connections] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { aiProvider: true } }),
      this.db.aiConnection.findMany({ where: { userId } }),
    ])
    return {
      provider: PROVIDERS.includes(user.aiProvider as AiProviderName) ? user.aiProvider as AiProviderName : null,
      connections: connections.filter((c) => PROVIDERS.includes(c.provider as AiProviderName)).map((c) => ({
        provider: c.provider, model: c.model, protocol: c.protocol, baseUrl: c.baseUrl ?? "", hasApiKey: !!c.encryptedApiKey,
      } as PublicAiConnection)),
    }
  }

  async credentials(userId: string, provider: AiProviderName) {
    const connection = await this.db.aiConnection.findUnique({ where: { userId_provider: { userId, provider } } })
    if (!connection) return null
    return {
      provider, model: connection.model, protocol: connection.protocol,
      baseUrl: connection.baseUrl ?? undefined,
      apiKey: connection.encryptedApiKey ? decryptAiSecret(connection.encryptedApiKey, userId, provider) : undefined,
    }
  }

  async prepare(userId: string, input: AiConfigInput) {
    const config = aiConfigSchema.parse(input)
    const baseUrl = resolveAiBaseUrl(config.provider, config.baseUrl)
    const previous = await this.db.aiConnection.findUnique({ where: { userId_provider: { userId, provider: config.provider } } })
    if (previous?.encryptedApiKey && previous.baseUrl !== baseUrl && !config.apiKey && !config.removeApiKey) {
      throw new Error("Renseignez à nouveau la clé après un changement d’URL de l’API.")
    }
    return {
      ...config, baseUrl,
      apiKey: config.removeApiKey ? undefined : config.apiKey || (previous?.encryptedApiKey
        ? decryptAiSecret(previous.encryptedApiKey, userId, config.provider) : undefined),
    }
  }

  async save(userId: string, input: AiConfigInput) {
    const config = await this.prepare(userId, input)
    const data = {
      model: config.model, protocol: config.protocol, baseUrl: config.baseUrl,
      encryptedApiKey: config.apiKey ? encryptAiSecret(config.apiKey, userId, config.provider) : null,
    }
    await this.db.$transaction([
      this.db.aiConnection.upsert({
        where: { userId_provider: { userId, provider: config.provider } },
        create: { userId, provider: config.provider, ...data }, update: data,
      }),
      this.db.user.update({ where: { id: userId }, data: { aiProvider: config.provider } }),
    ])
    return this.read(userId)
  }

  async remove(userId: string, provider: AiProviderName) {
    await this.db.$transaction([
      this.db.aiConnection.deleteMany({ where: { userId, provider } }),
      this.db.user.updateMany({ where: { id: userId, aiProvider: provider }, data: { aiProvider: null } }),
    ])
    return this.read(userId)
  }
}
