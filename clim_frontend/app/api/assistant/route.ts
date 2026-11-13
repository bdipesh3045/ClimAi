import { google } from "@ai-sdk/google";
import { convertToModelMessages, type UIMessage } from "ai";
import {
  buildInstructions,
  createRateLimiter,
  keepRecentMessages,
  readJourneyContext,
} from "@/lib/assistant";
import { createAssistantResponse } from "@/lib/assistant-stream";
import { parseAccount, type Account } from "@/lib/session";

export const maxDuration = 60;

// Use the low-latency model for short farm questions; override server-side if needed.
const MODEL_ID = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:5001";
const ACCOUNT_TIMEOUT_MS = 5_000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARACTERS = 4000;
const MAX_CONVERSATION_CHARACTERS = 16000;
// 16000 characters at up to 4 UTF-8 bytes each, plus room for the JSON around them.
const MAX_BODY_BYTES = 128 * 1024;
const RATE_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 };

const UNAVAILABLE_MESSAGE = "The assistant is temporarily unavailable.";
const limiter = createRateLimiter(RATE_LIMIT);

interface TextOnlyMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
}

type AccountResult =
  | { kind: "signed-in"; account: Account }
  | { kind: "guest" }
  | { kind: "unavailable" };

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** Ask Flask who sent this request, by passing the browser's session cookie along. */
async function fetchAccount(request: Request): Promise<AccountResult> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return { kind: "guest" };
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(ACCOUNT_TIMEOUT_MS),
    });
    if (response.status === 401) return { kind: "guest" };
    if (!response.ok) {
      console.error(`[assistant] /api/auth/me returned ${response.status}`);
      return { kind: "unavailable" };
    }
    return { kind: "signed-in", account: parseAccount(await response.json()) };
  } catch (error) {
    console.error("[assistant] could not load the signed-in account", error);
    return { kind: "unavailable" };
  }
}

/**
 * Keep only well-formed text messages, trimmed to the newest that fit the character budget,
 * or return the reason they were refused.
 */
function readMessages(
  payload: unknown,
): { messages: UIMessage[] } | { error: string; status: number } {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("messages" in payload) ||
    !Array.isArray(payload.messages)
  ) {
    return { error: "A conversation is required.", status: 400 };
  }
  if (payload.messages.length === 0 || payload.messages.length > MAX_MESSAGES) {
    return {
      error: "The conversation is outside the supported length.",
      status: 400,
    };
  }

  const messages: TextOnlyMessage[] = [];
  for (const item of payload.messages) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      !("role" in item) ||
      !("parts" in item)
    ) {
      return { error: "A conversation message is invalid.", status: 400 };
    }
    const candidate = item as { id: unknown; role: unknown; parts: unknown };
    if (
      typeof candidate.id !== "string" ||
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      !Array.isArray(candidate.parts)
    ) {
      return { error: "A conversation message is invalid.", status: 400 };
    }
    const textParts: Array<{ type: "text"; text: string }> = [];
    for (const part of candidate.parts) {
      // useChat adds this marker to assistant replies. It is stream bookkeeping,
      // not message content, and comes back with the next question's history.
      if (
        candidate.role === "assistant" &&
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "step-start"
      ) {
        continue;
      }
      if (
        typeof part !== "object" ||
        part === null ||
        !("type" in part) ||
        !("text" in part) ||
        part.type !== "text" ||
        typeof part.text !== "string"
      ) {
        return { error: "Only text messages are supported.", status: 400 };
      }
      if (part.text.length > MAX_MESSAGE_CHARACTERS) {
        return { error: "A message is too long.", status: 413 };
      }
      textParts.push({ type: "text", text: part.text });
    }
    messages.push({ id: candidate.id, role: candidate.role, parts: textParts });
  }

  if (messages.at(-1)?.role !== "user") {
    return { error: "The last message must be a question.", status: 400 };
  }
  // Every part was rebuilt as plain text above, which UIMessage accepts.
  return {
    messages: keepRecentMessages(
      messages,
      MAX_CONVERSATION_CHARACTERS,
    ) as UIMessage[],
  };
}

export async function POST(request: Request) {
  const result = await fetchAccount(request);
  if (result.kind === "guest")
    return errorResponse("Sign in to use the assistant.", 401);
  if (result.kind === "unavailable")
    return errorResponse(UNAVAILABLE_MESSAGE, 503);
  const { user, profile } = result.account;

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error("[assistant] GOOGLE_GENERATIVE_AI_API_KEY is not set");
    return errorResponse(UNAVAILABLE_MESSAGE, 503);
  }

  if (!limiter.allow(String(user.id), Date.now())) {
    return errorResponse(
      "You have sent a lot of questions. Please wait a few minutes and try again.",
      429,
    );
  }

  // Refuse oversized bodies before buffering them. A chunked body has no length and falls
  // through to the character limits in readMessages.
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return errorResponse("The conversation is too long.", 413);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("The request body must be valid JSON.", 400);
  }
  const read = readMessages(payload);
  if ("error" in read) return errorResponse(read.error, read.status);

  try {
    return createAssistantResponse({
      model: google(MODEL_ID),
      // Optional: sent by the journey page's side panel. Malformed context is ignored.
      instructions: buildInstructions(
        profile,
        typeof payload === "object" && payload !== null && "journey" in payload
          ? readJourneyContext((payload as { journey: unknown }).journey)
          : null,
      ),
      messages: await convertToModelMessages(read.messages),
      abortSignal: request.signal,
    });
  } catch (error) {
    console.error("[assistant] could not start the Gemini stream", error);
    return errorResponse(UNAVAILABLE_MESSAGE, 503);
  }
}
