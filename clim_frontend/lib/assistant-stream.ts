import {
  APICallError,
  RetryError,
  createUIMessageStreamResponse,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type UIMessageChunk,
} from "ai"
import { ASSISTANT_ERRORS } from "./assistant-errors.ts"

export function assistantStreamError(error: unknown): string {
  if (RetryError.isInstance(error)) return assistantStreamError(error.lastError)
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return ASSISTANT_ERRORS.quota
    if (error.statusCode === 503) return ASSISTANT_ERRORS.busy
    if ([400, 401, 403, 404].includes(error.statusCode ?? 0)) return ASSISTANT_ERRORS.configuration
  }
  if (error instanceof Error && error.name === "TimeoutError") return ASSISTANT_ERRORS.timeout
  return ASSISTANT_ERRORS.connection
}

interface AssistantResponseOptions {
  model: LanguageModel
  instructions: string
  messages: ModelMessage[]
  abortSignal: AbortSignal
  timeoutMs?: number
}

export function createAssistantResponse({
  model,
  instructions,
  messages,
  abortSignal,
  timeoutMs = 45_000,
}: AssistantResponseOptions): Response {
  const result = streamText({
    model,
    instructions,
    messages,
    // Gemini's output budget also covers reasoning. Leave room for a visible answer.
    maxOutputTokens: 2048,
    temperature: 0.3,
    // The provider maps this to the minimum reasoning supported by the selected model.
    reasoning: "none",
    // Retrying quota failures burns time without restoring quota.
    maxRetries: 0,
    timeout: { firstChunkMs: 20_000, totalMs: timeoutMs },
    abortSignal,
    onError: ({ error }) => console.error("[assistant] Gemini stream failed", error),
  })

  let hasText = false
  let hasError = false
  const stream = result.toUIMessageStream({
    sendReasoning: false,
    onError: assistantStreamError,
  }).pipeThrough(new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      if (chunk.type === "text-delta" && chunk.delta.trim()) hasText = true
      if (chunk.type === "error") hasError = true
      // The SDK treats timeouts as aborts, which useChat otherwise reports as ready.
      // Preserve the browser's Stop action; report server-side timeouts as failures.
      if (chunk.type === "abort" && !abortSignal.aborted) {
        if (!hasError) controller.enqueue({ type: "error", errorText: ASSISTANT_ERRORS.timeout })
        hasError = true
        return
      }
      if (chunk.type === "finish" && !hasText && !hasError && !abortSignal.aborted) {
        controller.enqueue({ type: "error", errorText: ASSISTANT_ERRORS.empty })
        hasError = true
      }
      controller.enqueue(chunk)
    },
    flush(controller) {
      if (!hasText && !hasError && !abortSignal.aborted) {
        controller.enqueue({ type: "error", errorText: ASSISTANT_ERRORS.empty })
      }
    },
  }))

  return createUIMessageStreamResponse({ stream })
}
