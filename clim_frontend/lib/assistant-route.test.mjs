import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import test from "node:test"
import { Chat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"

// Resolve the same @/ aliases Next.js uses when importing the actual route in Node.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context)
    }
    return nextResolve(specifier, context)
  },
})
const { POST } = await import("../app/api/assistant/route.ts")
hooks.deregister()

let nextUserId = 81000

function mockServices(t) {
  const previousKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key"
  t.after(() => {
    if (previousKey === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = previousKey
  })
  const userId = nextUserId++
  const calls = []
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url).endsWith("/api/auth/me")) {
      return Response.json({ user: { id: userId, email: "test@example.com" }, profile: null })
    }
    assert.equal(new URL(url).hostname, "generativelanguage.googleapis.com")
    calls.push(JSON.parse(init.body))
    const text = `Farm answer ${calls.length}`
    return new Response(`data: ${JSON.stringify({
      candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 },
    })}\n\n`, { headers: { "content-type": "text/event-stream" } })
  })
  return calls
}

function request(messages) {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "session=test" },
    body: JSON.stringify({ messages }),
  })
}

test("the actual chat route answers three consecutive questions and retains conversation context", async (t) => {
  const providerCalls = mockServices(t)
  const chat = new Chat({
    transport: new DefaultChatTransport({
      api: "http://localhost/api/assistant",
      fetch: (_url, init) => POST(new Request("http://localhost/api/assistant", {
        ...init,
        headers: { "content-type": "application/json", cookie: "session=test" },
      })),
    }),
  })

  for (const [index, question] of ["What soil do I have?", "How does that affect watering?", "And my corn?"].entries()) {
    await chat.sendMessage({ text: question })
    assert.equal(chat.error, undefined, `question ${index + 1}: ${chat.error?.message}`)
    assert.equal(chat.status, "ready")
    assert.equal(chat.messages.at(-1).parts.find((part) => part.type === "text").text, `Farm answer ${index + 1}`)
  }

  assert.equal(providerCalls.length, 3)
  assert.deepEqual(providerCalls[2].contents.map((content) => content.role), ["user", "model", "user", "model", "user"])
  assert.equal(providerCalls[2].contents[1].parts[0].text, "Farm answer 1")
  assert.equal(providerCalls[2].contents[2].parts[0].text, "How does that affect watering?")
})

test("the route still rejects unsupported attachments", async (t) => {
  const providerCalls = mockServices(t)
  const response = await POST(request([{ id: "question", role: "user", parts: [{ type: "file", url: "https://example.com/file" }] }]))
  assert.equal(response.status, 400)
  assert.equal(providerCalls.length, 0)
})
