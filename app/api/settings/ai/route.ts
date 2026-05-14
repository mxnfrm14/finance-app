import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"
import { z } from "zod"

const schema = z.object({
  provider: z.enum(["anthropic", "openai", "nvidia", "ollama"]),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 })

  const { provider, model, apiKey, baseUrl } = parsed.data

  const upserts: Promise<unknown>[] = [
    prisma.appConfig.upsert({
      where: { key: "ai_provider" },
      update: { value: provider },
      create: { key: "ai_provider", value: provider },
    }),
  ]

  if (model) {
    const modelKey =
      provider === "anthropic" ? "ai_model"
      : provider === "openai" ? "openai_model"
      : provider === "nvidia" ? "nvidia_model"
      : "ollama_model"
    upserts.push(
      prisma.appConfig.upsert({
        where: { key: modelKey },
        update: { value: model },
        create: { key: modelKey, value: model },
      })
    )
  }

  if (apiKey) {
    const keyName =
      provider === "anthropic" ? "anthropic_api_key"
      : provider === "nvidia" ? "nvidia_api_key"
      : "openai_api_key"
    upserts.push(
      prisma.appConfig.upsert({
        where: { key: keyName },
        update: { value: apiKey },
        create: { key: keyName, value: apiKey },
      })
    )
  }

  if (baseUrl && provider === "ollama") {
    upserts.push(
      prisma.appConfig.upsert({
        where: { key: "ollama_base_url" },
        update: { value: baseUrl },
        create: { key: "ollama_base_url", value: baseUrl },
      })
    )
  }

  await Promise.all(upserts)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await prisma.appConfig.findMany({
    where: { key: { in: ["ai_provider", "ai_model", "openai_model", "nvidia_model", "ollama_model", "ollama_base_url"] } },
  })
  const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return NextResponse.json(cfg)
}
