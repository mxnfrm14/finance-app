import OpenAI from "openai"
import type { AIProvider, AgentEvent, ToolDefinition, ExecuteTool } from "./types"

const MAX_ITERATIONS = 10

interface OpenAIProviderConfig {
  apiKey?: string
  baseURL?: string
  model: string
  name?: string
}

export class OpenAIProvider implements AIProvider {
  name: string
  model: string
  private apiKey?: string
  private baseURL?: string

  constructor(config: OpenAIProviderConfig) {
    this.name = config.name ?? "openai"
    this.model = config.model
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL
  }

  async isAvailable(): Promise<boolean> {
    // Pour les providers avec clé API, la présence de la clé suffit
    if (this.apiKey) return true
    // Pour les providers locaux (Ollama), tester la connectivité
    if (this.baseURL) {
      try {
        const client = this.createClient()
        await client.models.list()
        return true
      } catch {
        return false
      }
    }
    return false
  }

  private createClient() {
    return new OpenAI({
      apiKey: this.apiKey ?? "ollama", // Ollama doesn't need a real key
      baseURL: this.baseURL,
    })
  }

  /** Convertit le format Anthropic input_schema → OpenAI function parameters */
  private toOpenAITools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    return tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: "object",
          properties: t.input_schema.properties,
          required: t.input_schema.required ?? [],
        },
      },
    }))
  }

  async *runAgentStream(
    initialMessages: Array<{ role: "user" | "assistant"; content: string }>,
    tools: ToolDefinition[],
    systemPrompt: string,
    executeTool: ExecuteTool
  ): AsyncGenerator<AgentEvent> {
    const client = this.createClient()
    const openAITools = this.toOpenAITools(tools)

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...initialMessages.map((m) => ({ role: m.role, content: m.content } as OpenAI.ChatCompletionMessageParam)),
    ]

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const stream = await client.chat.completions.create({
        model: this.model,
        messages,
        tools: openAITools,
        tool_choice: "auto",
        stream: true,
      })

      let textBuffer = ""
      const toolCallBuffers: Record<string, { name: string; arguments: string }> = {}

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (!delta) continue

        if (delta.content) {
          textBuffer += delta.content
          yield { type: "text", text: delta.content }
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = String(tc.index)
            if (!toolCallBuffers[idx]) {
              toolCallBuffers[idx] = { name: tc.function?.name ?? "", arguments: "" }
            }
            if (tc.function?.name) toolCallBuffers[idx].name = tc.function.name
            if (tc.function?.arguments) toolCallBuffers[idx].arguments += tc.function.arguments
          }
        }
      }

      const toolCalls = Object.values(toolCallBuffers)

      // Ajouter le tour assistant
      if (toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: textBuffer || null,
          tool_calls: toolCalls.map((tc, i) => ({
            id: `call_${i}`,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        })
      } else {
        messages.push({ role: "assistant", content: textBuffer })
        yield { type: "done" }
        return
      }

      // Exécuter les outils
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i]
        let input: unknown = {}
        try { input = JSON.parse(tc.arguments) } catch { /* empty */ }

        yield { type: "tool_start", toolName: tc.name, input }
        try {
          const result = await executeTool(tc.name, input)
          const content = typeof result === "string" ? result : JSON.stringify(result)
          messages.push({
            role: "tool",
            tool_call_id: `call_${i}`,
            content,
          })
          yield { type: "tool_result", toolName: tc.name, result }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          messages.push({
            role: "tool",
            tool_call_id: `call_${i}`,
            content: `Error: ${errMsg}`,
          })
          yield { type: "tool_result", toolName: tc.name, result: { error: errMsg } }
        }
      }
    }

    yield { type: "error", error: "Max iterations reached" }
  }
}
