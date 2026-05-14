import Anthropic from "@anthropic-ai/sdk"
import type { AIProvider, AgentEvent, ToolDefinition, ExecuteTool } from "./types"

const MAX_ITERATIONS = 10

export class AnthropicProvider implements AIProvider {
  name = "anthropic"
  model: string
  private apiKey: string | undefined

  constructor(model = "claude-opus-4-6", apiKey?: string) {
    this.model = model
    this.apiKey = apiKey
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.apiKey ?? process.env.ANTHROPIC_API_KEY)
  }

  async *runAgentStream(
    initialMessages: Array<{ role: "user" | "assistant"; content: string }>,
    tools: ToolDefinition[],
    systemPrompt: string,
    executeTool: ExecuteTool
  ): AsyncGenerator<AgentEvent> {
    const client = new Anthropic({ apiKey: this.apiKey ?? process.env.ANTHROPIC_API_KEY })

    // Anthropic messages format — we track the mutable conversation
    type AnthropicMessage =
      | { role: "user" | "assistant"; content: string }
      | { role: "user"; content: Array<{ type: "tool_result"; tool_use_id: string; content: string }> }
      | { role: "assistant"; content: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }> }

    const messages: AnthropicMessage[] = initialMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      let stream: Awaited<ReturnType<typeof client.messages.stream>>
      try {
        stream = await client.messages.stream({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          tools: tools as Anthropic.Tool[],
          messages: messages as Anthropic.MessageParam[],
        })
      } catch (err) {
        const sdkErr = err as { status?: number; message?: string }
        if (sdkErr.status === 401) {
          yield { type: "error" as const, error: "AUTH_ERROR" }
          return
        }
        if (sdkErr.status === 429) {
          yield { type: "error" as const, error: "RATE_LIMIT" }
          return
        }
        yield { type: "error" as const, error: `API_ERROR: ${sdkErr.message ?? "Erreur inconnue"}` }
        return
      }

      // Collect streamed content
      let textBuffer = ""
      const toolUseBlocks: Array<{ id: string; name: string; input: unknown }> = []
      let currentToolUseId = ""
      let currentToolUseName = ""
      let currentToolInputBuffer = ""

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            currentToolUseId = event.content_block.id
            currentToolUseName = event.content_block.name
            currentToolInputBuffer = ""
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            textBuffer += event.delta.text
            yield { type: "text", text: event.delta.text }
          } else if (event.delta.type === "input_json_delta") {
            currentToolInputBuffer += event.delta.partial_json
          }
        } else if (event.type === "content_block_stop") {
          if (currentToolUseId) {
            let parsedInput: unknown = {}
            try { parsedInput = JSON.parse(currentToolInputBuffer) } catch { /* empty input */ }
            toolUseBlocks.push({ id: currentToolUseId, name: currentToolUseName, input: parsedInput })
            currentToolUseId = ""
            currentToolUseName = ""
            currentToolInputBuffer = ""
          }
        } else if (event.type === "message_stop") {
          break
        }
      }

      const finalMessage = await stream.finalMessage()
      const stopReason = finalMessage.stop_reason

      // Build the assistant turn content block
      const assistantContent: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }> = []
      if (textBuffer) assistantContent.push({ type: "text", text: textBuffer })
      for (const tb of toolUseBlocks) {
        assistantContent.push({ type: "tool_use", id: tb.id, name: tb.name, input: tb.input })
      }
      messages.push({ role: "assistant", content: assistantContent })

      if (stopReason !== "tool_use" || toolUseBlocks.length === 0) {
        yield { type: "done" }
        return
      }

      // Execute tools and collect results
      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = []
      for (const tb of toolUseBlocks) {
        yield { type: "tool_start", toolName: tb.name, input: tb.input }
        try {
          const result = await executeTool(tb.name, tb.input)
          const content = typeof result === "string" ? result : JSON.stringify(result)
          toolResults.push({ type: "tool_result", tool_use_id: tb.id, content })
          yield { type: "tool_result", toolName: tb.name, result }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: `Error: ${errMsg}` })
          yield { type: "tool_result", toolName: tb.name, result: { error: errMsg } }
        }
      }

      messages.push({ role: "user", content: toolResults })
    }

    yield { type: "error", error: "Max iterations reached" }
  }
}
