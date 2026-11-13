// Outside calls for /api/plant-check: Pl@ntNet, Open-Meteo and Gemini, and the order they run in.
// The Pl@ntNet key travels in the URL, so URLs and raw error objects are never logged.
// Plain TypeScript only (no enums or parameter properties) so `node --test` can import it.

import { generateText, Output, type LanguageModel } from "ai"
import {
  NOTICES,
  TOP_RESULTS,
  adviceSchema,
  advicePrompt,
  aiDiagnosisSchema,
  choosePlant,
  clipAdvice,
  diagnosisPrompt,
  fromAiDiagnosis,
  isHealthy,
  needsAiFallback,
  parseDiseases,
  parseSpecies,
  summarizeWeather,
  weatherUrl,
  type Advice,
  type AdviceInput,
  type Coordinates,
  type Crop,
  type Diagnosis,
  type ImageType,
  type PlantCheckResult,
  type Species,
  type WeatherSummary,
} from "./plant-check.ts"

const PLANTNET_BASE = "https://my-api.plantnet.org/v2"
// Worst case runs in sequence: account 5 s + Pl@ntNet 12 s + AI check 15 s + advice 15 s = 47 s,
// inside the route's 60 s maxDuration, so a slow service still returns a partial result.
const PLANTNET_TIMEOUT_MS = 12_000
const WEATHER_TIMEOUT_MS = 8_000
const AI_TIMEOUT_MS = 15_000
const LOG_TAG = "[plant-check]"

export type CheckInput = {
  file: Blob
  bytes: Uint8Array
  mediaType: ImageType
  crop: Crop
  coords: Coordinates | null
}

export type CheckDeps = { plantnetKey: string; model: LanguageModel }

export class ServiceError extends Error {
  status: number
  constructor(service: string, status: number) {
    super(`${service} returned HTTP ${status}`)
    this.name = "ServiceError"
    this.status = status
  }
}

/** A short, key-free description of a failure for the server log. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error"
  const status = "statusCode" in error && error.statusCode ? ` (HTTP ${String(error.statusCode)})` : ""
  return `${error.name}: ${error.message.slice(0, 200)}${status}`
}

/** POST one leaf photo to Pl@ntNet. Returns null on 404 ("not recognized"). */
async function postToPlantNet(path: string, input: CheckInput, key: string): Promise<unknown | null> {
  const form = new FormData()
  form.append("images", input.file, input.mediaType === "image/png" ? "leaf.png" : "leaf.jpg")
  form.append("organs", "leaf")
  const params = new URLSearchParams({ "api-key": key, "nb-results": String(TOP_RESULTS) })
  const response = await fetch(`${PLANTNET_BASE}/${path}?${params}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(PLANTNET_TIMEOUT_MS),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new ServiceError("Pl@ntNet", response.status)
  return response.json()
}

async function identifySpecies(input: CheckInput, key: string): Promise<Species[] | "not-found"> {
  const json = await postToPlantNet("identify/all", input, key)
  return json === null ? "not-found" : parseSpecies(json)
}

let hasLoggedDiseaseResponse = false

async function identifyDiseases(input: CheckInput, key: string): Promise<Diagnosis[]> {
  const json = await postToPlantNet("diseases/identify", input, key)
  if (!hasLoggedDiseaseResponse && process.env.NODE_ENV !== "production") {
    // Logged once per server start, to check the real field names against parseDiseases.
    hasLoggedDiseaseResponse = true
    console.info(`${LOG_TAG} Pl@ntNet diseases raw response (logged once):`, JSON.stringify(json))
  }
  return json === null ? [] : parseDiseases(json)
}

async function fetchWeather(coords: Coordinates): Promise<WeatherSummary> {
  const response = await fetch(weatherUrl(coords), { signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS) })
  if (!response.ok) throw new ServiceError("Open-Meteo", response.status)
  return summarizeWeather(await response.json())
}

async function aiDiagnose(model: LanguageModel, input: CheckInput, plantName: string | null): Promise<Diagnosis[]> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: aiDiagnosisSchema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: diagnosisPrompt(plantName) },
          { type: "file", mediaType: input.mediaType, data: input.bytes },
        ],
      },
    ],
    temperature: 0.2,
    maxOutputTokens: 1024,
    reasoning: "none",
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
  })
  return fromAiDiagnosis(output)
}

async function generateAdvice(model: LanguageModel, input: AdviceInput): Promise<Advice> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: adviceSchema }),
    prompt: advicePrompt(input),
    temperature: 0.3,
    maxOutputTokens: 1024,
    reasoning: "none",
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
  })
  return clipAdvice(output)
}

/**
 * Run the whole check. Each outside service may fail on its own: its part is left out and a
 * notice says so. The caller decides what to do when no diagnosis was possible at all.
 */
export async function runPlantCheck(input: CheckInput, { plantnetKey, model }: CheckDeps): Promise<PlantCheckResult> {
  const notices: string[] = []
  const notice = (message: string, error?: unknown) => {
    if (error !== undefined) console.error(`${LOG_TAG} ${message} ${describe(error)}`)
    if (!notices.includes(message)) notices.push(message)
  }

  const [speciesResult, diseaseResult, weatherResult] = await Promise.allSettled([
    // A picked crop is trusted over Pl@ntNet, so plant ID is skipped and saves a daily credit.
    input.crop === "other" ? identifySpecies(input, plantnetKey) : Promise.resolve<Species[]>([]),
    identifyDiseases(input, plantnetKey),
    input.coords ? fetchWeather(input.coords) : Promise.resolve(null),
  ])

  let species: Species[] = []
  if (speciesResult.status === "rejected") notice(NOTICES.plantIdUnavailable, speciesResult.reason)
  else if (speciesResult.value === "not-found") notice(NOTICES.plantNotRecognized)
  else species = speciesResult.value
  const plant = choosePlant(input.crop, species)

  let diagnoses: Diagnosis[] = []
  if (diseaseResult.status === "rejected") notice(NOTICES.plantnetUnavailable, diseaseResult.reason)
  else diagnoses = diseaseResult.value

  let source: PlantCheckResult["source"] = "plantnet"
  if (needsAiFallback(diagnoses)) {
    try {
      diagnoses = await aiDiagnose(model, input, plant.from === "unknown" ? null : plant.name)
      source = "ai"
    } catch (error) {
      notice(NOTICES.aiUnavailable, error)
    }
  }

  let weather: WeatherSummary | null = null
  if (weatherResult.status === "rejected") notice(NOTICES.weatherUnavailable, weatherResult.reason)
  else weather = weatherResult.value

  const top = diagnoses[0] ?? null
  let advice: Advice | null = null
  if (top !== null) {
    try {
      advice = await generateAdvice(model, {
        plant: plant.name,
        disease: top.name,
        probability: top.score,
        source,
        weather,
      })
    } catch (error) {
      notice(NOTICES.adviceUnavailable, error)
    }
  }

  return {
    plant,
    disease: { top, runnersUp: diagnoses.slice(1, TOP_RESULTS), healthy: isHealthy(top) },
    source,
    weather,
    advice,
    notices,
  }
}
