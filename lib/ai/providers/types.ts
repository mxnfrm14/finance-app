export type AgentEventType = "text" | "tool_start" | "tool_result" | "done" | "error"

export interface AgentEvent {
  type: AgentEventType
  text?: string
  toolName?: string
  input?: unknown
  result?: unknown
  error?: string
}

/** Format canonique Anthropic pour les outils */
export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?: string[]
  }
}

export type ExecuteTool = (name: string, input: unknown) => Promise<unknown>

export interface AIProvider {
  name: string
  model: string
  isAvailable(): Promise<boolean>
  runAgentStream(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    tools: ToolDefinition[],
    systemPrompt: string,
    executeTool: ExecuteTool
  ): AsyncGenerator<AgentEvent>
}
