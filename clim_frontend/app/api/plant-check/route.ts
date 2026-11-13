import { google } from "@ai-sdk/google"
import { createRateLimiter } from "@/lib/assistant"
import { MAX_IMAGE_BYTES, detectImageType, isCrop, parseCoordinates } from "@/lib/plant-check"
import { runPlantCheck, type CheckInput } from "@/lib/plant-check-services"
import { fetchAccount } from "@/lib/server-account"

export const maxDuration = 60

const MODEL_ID = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite"
// The photo plus room for the small form fields around it.
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024
// Each check spends 1 to 2 of Pl@ntNet's 500 free daily credits and up to 2 Gemini calls.
const RATE_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 }
// One shared cap across all farmers, so a few accounts cannot spend the whole Pl@ntNet day.
const DAILY_LIMIT = { limit: 250, windowMs: 24 * 60 * 60 * 1000 }
const DAILY_KEY = "all-farmers"
const UNAVAILABLE_MESSAGE = "The plant health check is not available right now. Please try again later."

// ponytail: in-memory counters, per server instance (see createRateLimiter). Move them to a
// shared store before running several instances.
const limiter = createRateLimiter(RATE_LIMIT)
const dailyLimiter = createRateLimiter(DAILY_LIMIT)

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

type ReadResult = { input: CheckInput } | { error: string; status: number }

/** Validate the upload: one real JPEG or PNG, a crop from the list, and an optional location. */
async function readInput(request: Request): Promise<ReadResult> {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return { error: "Send the photo as a form upload.", status: 400 }
  }

  const file = form.get("image")
  if (!(file instanceof Blob) || file.size === 0) return { error: "Choose a photo to check.", status: 400 }
  if (file.size > MAX_IMAGE_BYTES) return { error: "The photo is too large. Use a photo under 4 MB.", status: 413 }

  const crop = form.get("crop") ?? "other"
  if (!isCrop(crop)) return { error: "Choose a crop from the list.", status: 400 }

  const coords = parseCoordinates(form.get("lat"), form.get("lon"))
  if (coords === "invalid") return { error: "The location is not valid.", status: 400 }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mediaType = detectImageType(bytes)
  if (!mediaType) return { error: "Use a JPG or PNG photo.", status: 415 }

  return { input: { file, bytes, mediaType, crop, coords } }
}

export async function POST(request: Request) {
  const account = await fetchAccount(request, "plant-check")
  if (account.kind === "guest") return errorResponse("Sign in to check plant health.", 401)
  if (account.kind === "unavailable") return errorResponse(UNAVAILABLE_MESSAGE, 503)

  const plantnetKey = process.env.PLANTNET_API_KEY
  if (!plantnetKey) {
    console.error("[plant-check] PLANTNET_API_KEY is not set")
    return errorResponse(UNAVAILABLE_MESSAGE, 503)
  }

  // Refuse oversized uploads before buffering them; readInput checks the photo size again.
  // A chunked upload has no length; Vercel's 4.5 MB request cap bounds it there.
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return errorResponse("The photo is too large. Use a photo under 4 MB.", 413)
  }

  const read = await readInput(request)
  if ("error" in read) return errorResponse(read.error, read.status)

  // Counted only for valid uploads, so a rejected photo does not use up the farmer's checks.
  const now = Date.now()
  if (!limiter.allow(String(account.account.user.id), now)) {
    return errorResponse("You have checked a lot of photos. Please wait a few minutes and try again.", 429)
  }
  if (!dailyLimiter.allow(DAILY_KEY, now)) {
    return errorResponse("The plant health check has reached today's limit. Please try again tomorrow.", 429)
  }

  try {
    const result = await runPlantCheck(read.input, { plantnetKey, model: google(MODEL_ID) })
    if (result.disease.top === null) return errorResponse(UNAVAILABLE_MESSAGE, 503)
    return Response.json(result)
  } catch (error) {
    console.error("[plant-check] check failed", error instanceof Error ? error.name : "unknown error")
    return errorResponse(UNAVAILABLE_MESSAGE, 503)
  }
}
