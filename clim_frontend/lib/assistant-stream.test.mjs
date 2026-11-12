import assert from "node:assert/strict"
import test from "node:test"
import { APICallError, DefaultChatTransport } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { Chat } from "@ai-sdk/react"
import { ASSISTANT_ERRORS } from "./assistant-errors.ts"
import { createAssistantResponse } from "./assistant-stream.ts"

const usage = {
  inputTokens: { total: 20, noCache: 20, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
}

function completedModel(parts, finishReason = "stop") {
  return new MockLanguageModelV4({
    doStream: {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] })
          for (const part of parts) controller.enqueue(part)
          controller.enqueue({ type: "finish", finishReason: { unified: finishReason, raw: finishReason }, usage })
          controller.close()
        },
      }),
    },
  })
}

function createChat(model, options = {}) {
  return new Chat({
    transport: new DefaultChatTransport({
      api: "http://localhost/api/assistant",
      fetch: async (_url, init) => createAssistantResponse({
        model,
        instructions: "Answer farming questions.",
        messages: [{ role: "user", content: "How should I water my crops?" }],
        abortSignal: init.signal,
        ...options,
      }),
    }),
  })
}

test("chat receives a visible streamed answer using the real SDK transport", async () => {
  const model = completedModel([
    { type: "text-start", id: "answer" },
    { type: "text-delta", id: "answer", delta: "Check soil moisture before watering." },
    { type: "text-end", id: "answer" },
  ])
  const chat = createChat(model)
  await chat.sendMessage({ text: "How should I water my crops?" })

  assert.equal(chat.status, "ready")
  assert.equal(chat.error, undefined)
  assert.equal(chat.messages.at(-1).parts.find((part) => part.type === "text").text, "Check soil moisture before watering.")
})

test("quota failures reach chat as a specific error without automatic retries or provider details", async (t) => {
  t.mock.method(console, "error", () => {})
  const model = new MockLanguageModelV4({
    doStream: async () => {
      throw new APICallError({
        message: "Quota exhausted: private provider details",
        url: "https://provider.example/model",
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: true,
      })
    },
  })
  const chat = createChat(model)
  await chat.sendMessage({ text: "How should I water my crops?" })

  assert.equal(chat.status, "error")
  assert.equal(chat.error.message, ASSISTANT_ERRORS.quota)
  assert.equal(model.doStreamCalls.length, 1)
})

test("a stalled provider becomes a timeout error instead of silently returning ready", async (t) => {
  t.mock.method(console, "error", () => {})
  const model = new MockLanguageModelV4({
    doStream: async ({ abortSignal }) => {
      await new Promise((resolve) => {
        if (abortSignal.aborted) resolve()
        else abortSignal.addEventListener("abort", resolve, { once: true })
      })
      throw abortSignal.reason
    },
  })
  const chat = createChat(model, { timeoutMs: 30 })
  // Keep Node alive for AbortSignal.timeout's unref'd timer.
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    await chat.sendMessage({ text: "How should I water my crops?" })
    assert.equal(chat.status, "error")
    assert.equal(chat.error.message, ASSISTANT_ERRORS.timeout)
  } finally {
    clearTimeout(keepAlive)
  }
})

test("a reasoning-only response is reported as empty and its reasoning stays out of chat", async () => {
  const chat = createChat(completedModel([
    { type: "reasoning-start", id: "thinking" },
    { type: "reasoning-delta", id: "thinking", delta: "Internal reasoning only" },
    { type: "reasoning-end", id: "thinking" },
  ], "length"))
  await chat.sendMessage({ text: "How should I water my crops?" })

  assert.equal(chat.status, "error")
  assert.equal(chat.error.message, ASSISTANT_ERRORS.empty)
  assert.ok(chat.messages.every((message) => message.parts.every((part) => part.type !== "reasoning")))
})

test("pressing Stop cancels the provider without turning cancellation into an error", async () => {
  let providerStarted
  const started = new Promise((resolve) => { providerStarted = resolve })
  let providerSignal
  const model = new MockLanguageModelV4({
    doStream: async ({ abortSignal }) => {
      providerSignal = abortSignal
      providerStarted()
      await new Promise((resolve) => abortSignal.addEventListener("abort", resolve, { once: true }))
      throw abortSignal.reason
    },
  })
  const chat = createChat(model)
  const pending = chat.sendMessage({ text: "How should I water my crops?" })
  await started
  await chat.stop()
  await pending

  assert.equal(providerSignal.aborted, true)
  assert.equal(chat.status, "ready")
  assert.equal(chat.error, undefined)
})
