import OpenAI from "openai"
import type { ResponseInputItem, ResponseOutputItem } from "openai/resources/responses/responses"
import { createAiFetch } from "../endpoints"
import { aiErrorMessage } from "../errors"
import type { AIProvider, AgentEvent, AgentRunOptions, ToolDefinition, ExecuteTool } from "./types"

const MAX_ITERATIONS = 10

interface OpenAIProviderConfig {
  apiKey?: string
  baseURL: string
  model: string
  protocol: "responses" | "chat-completions"
  name?: string
  fetch?: typeof fetch
}

export class OpenAIProvider implements AIProvider {
  readonly name: string
  readonly model: string

  constructor(private config: OpenAIProviderConfig) {
    this.name = config.name ?? "openai"
    this.model = config.model
  }

  async *runAgentStream(
    initialMessages: Array<{ role: "user" | "assistant"; content: string }>,
    tools: ToolDefinition[], systemPrompt: string, executeTool: ExecuteTool,
    options: AgentRunOptions = {},
  ): AsyncGenerator<AgentEvent> {
    const client = new OpenAI({
      apiKey: this.config.apiKey ?? "no-key", baseURL: this.config.baseURL,
      fetch: createAiFetch(this.config.baseURL, this.config.fetch), timeout: 60_000, maxRetries: 0,
    })
    try {
      if (this.config.protocol === "responses") {
        yield* this.responses(client, initialMessages, tools, systemPrompt, executeTool, options)
      } else {
        yield* this.chat(client, initialMessages, tools, systemPrompt, executeTool, options)
      }
    } catch (error) {
      yield { type: "error", error: aiErrorMessage(error) }
    }
  }

  private async *responses(
    client: OpenAI, initialMessages: Array<{ role: "user" | "assistant"; content: string }>,
    tools: ToolDefinition[], systemPrompt: string, executeTool: ExecuteTool, options: AgentRunOptions,
  ): AsyncGenerator<AgentEvent> {
    const input: ResponseInputItem[] = [...initialMessages]
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const stream = await client.responses.create({
        model: this.model, instructions: systemPrompt, input,
        tools: tools.map((tool) => ({
          type: "function", name: tool.name, description: tool.description,
          parameters: { ...tool.input_schema }, strict: false,
        })),
        store: false, stream: true, include: ["reasoning.encrypted_content"],
        ...(options.maxOutputTokens ? { max_output_tokens: options.maxOutputTokens } : {}),
      }, { signal: options.signal })
      let output: ResponseOutputItem[] | undefined
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") yield { type: "text", text: event.delta }
        if (event.type === "response.refusal.delta") yield { type: "text", text: event.delta }
        if (event.type === "response.completed") output = event.response.output
        if (event.type === "response.failed" || event.type === "response.incomplete") {
          yield { type: "error", error: "La réponse IA est incomplète ou a échoué. Vérifiez vos quotas et le modèle." }
          return
        }
        if (event.type === "error") {
          yield { type: "error", error: aiErrorMessage({ code: event.code }) }
          return
        }
      }
      if (!output) {
        yield { type: "error", error: "Le flux IA a été interrompu avant la fin de la réponse." }
        return
      }
      // Replay complete output, including encrypted reasoning, because store=false.
      input.push(...output as ResponseInputItem[])
      const calls = output.filter((item) => item.type === "function_call")
      if (!calls.length) { yield { type: "done" }; return }
      for (const call of calls) {
        let args: unknown
        try { args = JSON.parse(call.arguments) } catch {
          input.push({ type: "function_call_output", call_id: call.call_id, output: "Error: invalid JSON arguments" })
          continue
        }
        yield { type: "tool_start", toolName: call.name, input: args }
        let result: unknown
        try { result = await executeTool(call.name, args) } catch { result = { error: "Échec de l’outil." } }
        input.push({ type: "function_call_output", call_id: call.call_id, output: serialize(result) })
        yield { type: "tool_result", toolName: call.name, result }
      }
    }
    yield { type: "error", error: "Nombre maximal d’appels d’outils atteint." }
  }

  private async *chat(
    client: OpenAI, initialMessages: Array<{ role: "user" | "assistant"; content: string }>,
    tools: ToolDefinition[], systemPrompt: string, executeTool: ExecuteTool, options: AgentRunOptions,
  ): AsyncGenerator<AgentEvent> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt }, ...initialMessages]
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const stream = await client.chat.completions.create({
        model: this.model, messages, stream: true,
        tools: tools.map((tool) => ({ type: "function", function: {
          name: tool.name, description: tool.description, parameters: { ...tool.input_schema },
        } })),
        ...(options.maxOutputTokens ? { max_tokens: options.maxOutputTokens } : {}),
      }, { signal: options.signal })
      let text = ""
      let finishReason: string | null = null
      const calls = new Map<number, { id: string; name: string; arguments: string }>()
      for await (const chunk of stream) {
        const choice = chunk.choices[0]
        if (!choice) continue
        if (choice.finish_reason) finishReason = choice.finish_reason
        if (choice.delta.content) {
          text += choice.delta.content
          yield { type: "text", text: choice.delta.content }
        }
        for (const part of choice.delta.tool_calls ?? []) {
          const call = calls.get(part.index) ?? { id: "", name: "", arguments: "" }
          if (part.id) call.id = part.id
          if (part.function?.name) call.name += part.function.name
          if (part.function?.arguments) call.arguments += part.function.arguments
          calls.set(part.index, call)
        }
      }
      if (finishReason !== "stop" && finishReason !== "tool_calls") {
        yield { type: "error", error: "Le flux IA a été interrompu ou la réponse est incomplète." }
        return
      }
      if (!calls.size) {
        if (finishReason === "tool_calls") { yield { type: "error", error: "Appel d’outil incomplet." }; return }
        yield { type: "done" }; return
      }
      const toolCalls = [...calls.values()]
      if (toolCalls.some((call) => !call.id || !call.name)) {
        yield { type: "error", error: "Appel d’outil incomplet : identifiant ou nom absent." }; return
      }
      messages.push({ role: "assistant", content: text || null, tool_calls: toolCalls.map((call) => ({
        id: call.id, type: "function", function: { name: call.name, arguments: call.arguments },
      })) })
      for (const call of toolCalls) {
        let args: unknown
        try { args = JSON.parse(call.arguments) } catch {
          messages.push({ role: "tool", tool_call_id: call.id, content: "Error: invalid JSON arguments" })
          continue
        }
        yield { type: "tool_start", toolName: call.name, input: args }
        let result: unknown
        try { result = await executeTool(call.name, args) } catch { result = { error: "Échec de l’outil." } }
        messages.push({ role: "tool", tool_call_id: call.id, content: serialize(result) })
        yield { type: "tool_result", toolName: call.name, result }
      }
    }
    yield { type: "error", error: "Nombre maximal d’appels d’outils atteint." }
  }
}

function serialize(value: unknown) { return typeof value === "string" ? value : JSON.stringify(value) ?? "null" }
