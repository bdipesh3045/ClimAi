import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import test from "node:test"
import { NOTICES, isPlantCheckResult } from "./plant-check.ts"

// Resolve the same @/ aliases Next.js uses when importing the actual route in Node.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context)
    }
    return nextResolve(specifier, context)
  },
})
const { POST } = await import("../app/api/plant-check/route.ts")
hooks.deregister()

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const ADVICE = {
  summary: "The spots look like frogeye leaf spot. It is common and manageable.",
  likelyCause: "Warm, humid days last week favored the fungus.",
  actions: ["Scout nearby plants", "Remove badly spotted leaves", "Avoid overhead watering"],
  whenToCallExpert: "Call your extension office if spots reach the upper leaves.",
}
const WEATHER = {
  daily: {
    time: Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 4).padStart(2, "0")}`),
    temperature_2m_max: [28, 29, 30, 31, 30, 29, 28, 27, 27, 26],
    temperature_2m_min: [18, 18, 19, 20, 19, 18, 18, 17, 17, 16],
    precipitation_sum: [0, 4, 9, 0, 0, 2, 0, 0, 0, 5],
    relative_humidity_2m_mean: [80, 85, 90, 88, 75, 70, 72, 65, 60, 78],
  },
}

let nextUserId = 92000

function geminiReply(object) {
  return Response.json({
    candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(object) }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 },
  })
}

/**
 * Fake every outside service. `plantnet` and `gemini` decide each reply; calls are recorded
 * so tests can check what was sent where.
 */
function mockServices(t, { identify, diseases, diagnosis, advice = () => geminiReply(ADVICE) }) {
  const saved = { plantnet: process.env.PLANTNET_API_KEY, google: process.env.GOOGLE_GENERATIVE_AI_API_KEY }
  process.env.PLANTNET_API_KEY = "plantnet-test-key"
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-test-key"
  t.after(() => {
    for (const [name, value] of [["PLANTNET_API_KEY", saved.plantnet], ["GOOGLE_GENERATIVE_AI_API_KEY", saved.google]]) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })
  const userId = nextUserId++
  const calls = { identify: [], diseases: [], diagnosis: [], advice: [], weather: [] }
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith("/api/auth/me")) {
      return Response.json({ user: { id: userId, email: "farmer@example.com" }, profile: null })
    }
    if (url.hostname === "my-api.plantnet.org") {
      const kind = url.pathname.includes("/diseases/") ? "diseases" : "identify"
      calls[kind].push({ url, form: init.body })
      return (kind === "diseases" ? diseases : identify)()
    }
    if (url.hostname === "api.open-meteo.com") {
      calls.weather.push(url)
      return Response.json(WEATHER)
    }
    if (url.hostname === "generativelanguage.googleapis.com") {
      const body = JSON.parse(init.body)
      const hasImage = JSON.stringify(body).includes("inlineData")
      calls[hasImage ? "diagnosis" : "advice"].push(body)
      return hasImage ? diagnosis() : advice()
    }
    throw new Error(`unexpected fetch to ${url}`)
  })
  return calls
}

function request({ crop = "soybean", bytes = JPEG_BYTES, lat = "30.45", lon = "-91.19", cookie = "session=abc" } = {}) {
  const form = new FormData()
  form.append("image", new Blob([bytes], { type: "image/jpeg" }), "leaf.jpg")
  form.append("crop", crop)
  if (lat !== null) form.append("lat", lat)
  if (lon !== null) form.append("lon", lon)
  return new Request("http://localhost:3000/api/plant-check", {
    method: "POST",
    headers: cookie ? { cookie } : {},
    body: form,
  })
}

const diseasesReply = (score) => () =>
  Response.json({
    results: [
      { name: "CERCSO", score, description: "Cercospora sojina - Frogeye leaf spot", images: [] },
      { name: "SEPTGL", score: score / 3, description: "Septoria glycines - Brown spot", images: [] },
      { name: "PSDMSG", score: score / 6, description: "Bacterial blight", images: [] },
    ],
  })

test("a confident Pl@ntNet result is used directly, and the model only writes the advice", async (t) => {
  const calls = mockServices(t, { identify: () => assert.fail("a picked crop skips plant ID"), diseases: diseasesReply(0.72) })

  const response = await POST(request())
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.ok(isPlantCheckResult(body), "the browser's shape check accepts the route's real answer")
  assert.equal(isPlantCheckResult({ error: "x" }), false)
  assert.equal(body.source, "plantnet")
  assert.equal(body.plant.name, "Soybean")
  assert.equal(body.disease.top.name, "Cercospora sojina - Frogeye leaf spot")
  assert.equal(body.disease.top.code, "CERCSO")
  assert.equal(body.disease.runnersUp.length, 2)
  assert.equal(body.weather.past7Days.days, 7)
  assert.deepEqual(body.advice.actions, ADVICE.actions)
  assert.deepEqual(body.notices, [])

  // What was sent where: the key stays server-side, the leaf organ is set, location is rounded.
  const sent = calls.diseases[0]
  assert.equal(sent.url.searchParams.get("api-key"), "plantnet-test-key")
  assert.equal(sent.form.get("organs"), "leaf")
  assert.equal(calls.weather[0].searchParams.get("latitude"), "30.45")
  assert.equal(calls.diagnosis.length, 0)
  assert.equal(calls.advice.length, 1)
  assert.match(JSON.stringify(calls.advice[0]), /Frogeye leaf spot/)
  assert.match(JSON.stringify(calls.advice[0]), /Past 7 days/)
})

test("below a 0.3 disease score the AI check takes over and the advice gets its probability", async (t) => {
  const calls = mockServices(t, {
    identify: () => assert.fail("a picked crop skips plant ID"),
    diseases: diseasesReply(0.12),
    diagnosis: () =>
      geminiReply({
        diagnoses: [
          { name: "Frogeye leaf spot", confidence: 0.41, evidence: "Small grey spots with reddish edges." },
          { name: "Healthy", confidence: 0.3, evidence: "Most of the leaf is green." },
        ],
      }),
  })

  const body = await (await POST(request())).json()

  assert.equal(body.source, "ai")
  assert.equal(body.disease.top.name, "Frogeye leaf spot")
  assert.equal(body.disease.top.evidence, "Small grey spots with reddish edges.")
  assert.deepEqual(body.advice.actions, ADVICE.actions, "no step is added for a low probability")
  assert.match(JSON.stringify(calls.advice[0]), /41% probability/)
  assert.equal(calls.diagnosis.length, 1)
  assert.match(JSON.stringify(calls.diagnosis[0]), /Soybean/)
})

test("when the AI fallback is down, the card keeps Pl@ntNet's result and says the service is not available", async (t) => {
  mockServices(t, {
    identify: () => assert.fail("a picked crop skips plant ID"),
    diseases: diseasesReply(0.2),
    diagnosis: () => Response.json({ error: { message: "overloaded" } }, { status: 503 }),
    advice: () => Response.json({ error: { message: "overloaded" } }, { status: 503 }),
  })

  const response = await POST(request())
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.source, "plantnet")
  assert.equal(body.disease.top.code, "CERCSO")
  assert.equal(body.advice, null)
  assert.deepEqual(body.notices, [NOTICES.aiUnavailable, NOTICES.adviceUnavailable])
})

test("with crop 'other', Pl@ntNet names the plant, and its 404 means not recognized", async (t) => {
  const identified = mockServices(t, {
    identify: () =>
      Response.json({
        results: [{ score: 0.88, species: { scientificNameWithoutAuthor: "Solanum lycopersicum", commonNames: ["Tomato"] } }],
      }),
    diseases: diseasesReply(0.7),
  })

  const body = await (await POST(request({ crop: "other", lat: null, lon: null }))).json()
  assert.equal(body.plant.name, "Tomato")
  assert.equal(body.plant.confidence, 0.88)
  assert.equal(body.weather, null)
  assert.equal(identified.weather.length, 0)
  assert.equal(identified.identify[0].form.get("organs"), "leaf")

  t.mock.restoreAll()
  mockServices(t, {
    identify: () => Response.json({ statusCode: 404, error: "Not Found", message: "Species not found" }, { status: 404 }),
    diseases: diseasesReply(0.7),
  })
  const unknown = await (await POST(request({ crop: "other" }))).json()
  assert.equal(unknown.plant.from, "unknown")
  assert.ok(unknown.notices.includes(NOTICES.plantNotRecognized))
})

test("guests, non-image files and bad locations are refused before any outside call", async (t) => {
  const calls = mockServices(t, { identify: () => assert.fail(), diseases: () => assert.fail() })

  const guest = await POST(request({ cookie: null }))
  assert.equal(guest.status, 401)

  const svg = await POST(request({ bytes: new TextEncoder().encode("<svg onload=alert(1)>") }))
  assert.equal(svg.status, 415)

  const badCrop = await POST(request({ crop: "<script>" }))
  assert.equal(badCrop.status, 400)

  const badPlace = await POST(request({ lat: "999", lon: "10" }))
  assert.equal(badPlace.status, 400)

  assert.equal(calls.diseases.length + calls.weather.length + calls.advice.length, 0)
})

test("when no service can diagnose the photo, the route answers 503 with a readable message", async (t) => {
  mockServices(t, {
    identify: () => assert.fail("a picked crop skips plant ID"),
    diseases: () => Response.json({ message: "error: remote IP not allowed" }, { status: 403 }),
    diagnosis: () => Response.json({ error: { message: "quota" } }, { status: 429 }),
  })

  const response = await POST(request())
  const body = await response.json()

  assert.equal(response.status, 503)
  assert.match(body.error, /not available/)
  assert.doesNotMatch(JSON.stringify(body), /remote IP|plantnet-test-key/)
})
