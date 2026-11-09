import type { Metadata } from "next"
import { AgentChat } from "@/components/agent/agent-chat"

export const metadata: Metadata = {
  title: "Agent IA — Bourse",
  description: "Analysez votre portefeuille, un instrument ou le marché avec l'agent IA.",
}

interface AgentPageProps {
  searchParams: Promise<{ mode?: string; target?: string; sessionId?: string }>
}

export default async function AgentPage({ searchParams }: AgentPageProps) {
  const params = await searchParams
  const rawMode = params.mode
  const initialMode =
    rawMode === "instrument" || rawMode === "market" || rawMode === "portfolio"
      ? rawMode
      : undefined
  const initialTarget = params.target ?? ""

  return <AgentChat sessionId={params.sessionId} initialMode={initialMode} initialTarget={initialTarget} />
}
