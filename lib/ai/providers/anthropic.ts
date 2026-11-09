import Anthropic from "@anthropic-ai/sdk"
import { createAiFetch } from "../endpoints"
import { aiErrorMessage } from "../errors"
import type { AIProvider, AgentEvent, AgentRunOptions, ToolDefinition, ExecuteTool } from "./types"

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic"
  constructor(readonly model: string, private apiKey: string, private fetchImpl?: typeof fetch) {}

  async *runAgentStream(
    initialMessages: Array<{ role: "user" | "assistant"; content: string }>, tools: ToolDefinition[],
    systemPrompt: string, executeTool: ExecuteTool, options: AgentRunOptions = {},
  ): AsyncGenerator<AgentEvent> {
    const baseURL = "https://api.anthropic.com"
    const client = new Anthropic({
      apiKey: this.apiKey, authToken: null, baseURL,
      fetch: createAiFetch(baseURL, this.fetchImpl), timeout: 60_000, maxRetries: 0,
    })
    const messages: Anthropic.MessageParam[] = [...initialMessages]
    try {
      for (let iteration = 0; iteration < 10; iteration++) {
        const stream = client.messages.stream({
          model: this.model, max_tokens: options.maxOutputTokens ?? 4096,
          system: systemPrompt, tools: tools as Anthropic.Tool[], messages,
        }, { signal: options.signal })
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield { type: "text", text: event.delta.text }
          }
        }
        const response = await stream.finalMessage()
        if (response.stop_reason !== "end_turn" && response.stop_reason !== "tool_use") {
          yield { type: "error", error: "La réponse Claude est incomplète ou a été arrêtée." }; return
        }
        messages.push({ role: "assistant", content: response.content })
        const calls = response.content.filter((block) => block.type === "tool_use")
        if (!calls.length) {
          if (response.stop_reason === "tool_use") { yield { type: "error", error: "Appel d’outil Claude incomplet." }; return }
          yield { type: "done" }; return
        }
        const results: Anthropic.ToolResultBlockParam[] = []
        for (const call of calls) {
          yield { type: "tool_start", toolName: call.name, input: call.input }
          try {
            const result = await executeTool(call.name, call.input)
            results.push({ type: "tool_result", tool_use_id: call.id, content: typeof result === "string" ? result : JSON.stringify(result) ?? "null" })
            yield { type: "tool_result", toolName: call.name, result }
          } catch {
            results.push({ type: "tool_result", tool_use_id: call.id, content: "Échec de l’outil.", is_error: true })
            yield { type: "tool_result", toolName: call.name, result: { error: "Échec de l’outil." } }
          }
        }
        messages.push({ role: "user", content: results })
      }
      yield { type: "error", error: "Nombre maximal d’appels d’outils atteint." }
    } catch (error) {
      yield { type: "error", error: aiErrorMessage(error) }
    }
  }
}
