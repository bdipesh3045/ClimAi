import assert from "node:assert/strict"
import test from "node:test"
import {
  AI_FALLBACK_BELOW,
  choosePlant,
  clipAdvice,
  cropFromName,
  detectImageType,
  fromAiDiagnosis,
  needsAiFallback,
  parseCoordinates,
  parseDiseases,
  parseSpecies,
  summarizeWeather,
  weatherUrl,
} from "./plant-check.ts"

// Shapes copied from the Pl@ntNet API docs (identify and diseases routes).
const IDENTIFY_RESPONSE = {
  bestMatch: "Solanum lycopersicum L.",
  results: [
    { score: 0.12, species: { scientificNameWithoutAuthor: "Solanum nigrum", commonNames: [] } },
    { score: 0.81, species: { scientificNameWithoutAuthor: "Solanum lycopersicum", commonNames: ["Tomato", "Garden tomato"] } },
    { score: 0.04, species: { scientificNameWithoutAuthor: "Physalis peruviana", commonNames: ["Cape gooseberry"] } },
    { score: 0.02, species: { scientificNameWithoutAuthor: "Capsicum annuum", commonNames: ["Pepper"] } },
  ],
}

const DISEASES_RESPONSE = {
  results: [
    { name: "PHYTIN", score: 0.62, description: "Phytophthora infestans - Late blight", images: [] },
    { name: "ALTESO", score: 0.21, description: "Alternaria solani - Early blight", images: [] },
    { name: "XANTVE", score: 0.08, description: "", images: [] },
    { name: "SEPTLY", score: 0.05, description: "Septoria lycopersici", images: [] },
  ],
}

test("detectImageType recognizes JPEG and PNG by their first bytes only", () => {
  assert.equal(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])), "image/jpeg")
  assert.equal(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png")
  assert.equal(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>")), null)
  assert.equal(detectImageType(new Uint8Array([])), null)
})

test("parseSpecies keeps the top 3 by score with a readable common name", () => {
  const species = parseSpecies(IDENTIFY_RESPONSE)

  assert.deepEqual(species, [
    { name: "Solanum lycopersicum", commonName: "Tomato", score: 0.81 },
    { name: "Solanum nigrum", commonName: null, score: 0.12 },
    { name: "Physalis peruviana", commonName: "Cape gooseberry", score: 0.04 },
  ])
  assert.deepEqual(parseSpecies({ unexpected: true }), [])
})

test("parseDiseases maps name to the EPPO code and description to the label", () => {
  const diseases = parseDiseases(DISEASES_RESPONSE)

  assert.equal(diseases.length, 3)
  assert.deepEqual(diseases[0], { name: "Phytophthora infestans - Late blight", code: "PHYTIN", score: 0.62, evidence: null })
  // An empty description falls back to the code, so the card never shows a blank name.
  assert.equal(diseases[2].name, "XANTVE")
  assert.deepEqual(parseDiseases(null), [])
})

test("a picked crop is trusted over Pl@ntNet, and 'other' uses Pl@ntNet's best match", () => {
  const species = parseSpecies(IDENTIFY_RESPONSE)

  const picked = choosePlant("soybean", species)
  assert.equal(picked.name, "Soybean")
  assert.equal(picked.from, "crop")

  const identified = choosePlant("other", species)
  assert.equal(identified.name, "Tomato")
  assert.equal(identified.scientificName, "Solanum lycopersicum")
  assert.equal(identified.confidence, 0.81)

  const unknown = choosePlant("other", [])
  assert.equal(unknown.from, "unknown")
  assert.equal(unknown.confidence, null)
})

test("cropFromName maps journey crop names onto the dropdown values", () => {
  assert.equal(cropFromName("Soybeans"), "soybean")
  assert.equal(cropFromName(" Maize "), "corn")
  assert.equal(cropFromName("Rice"), "rice")
  assert.equal(cropFromName("Tomatoes"), "tomato")
  assert.equal(cropFromName("Winter wheat"), "wheat")
  assert.equal(cropFromName("Sweet corn"), "corn")
  assert.equal(cropFromName("Sorghum"), "other")
})

test("the AI fallback runs when the top disease score is below 0.3 or there is none", () => {
  assert.equal(AI_FALLBACK_BELOW, 0.3)
  assert.equal(needsAiFallback(parseDiseases(DISEASES_RESPONSE)), false)
  assert.equal(needsAiFallback([{ name: "x", code: "X", score: 0.29, evidence: null }]), true)
  assert.equal(needsAiFallback([]), true)
})

test("fromAiDiagnosis sorts the model's answer and keeps its visual evidence", () => {
  const diagnoses = fromAiDiagnosis({
    diagnoses: [
      { name: "Healthy", confidence: 0.2, evidence: "Most of the leaf is evenly green." },
      { name: "Frogeye leaf spot", confidence: 0.7, evidence: "Round grey spots with dark red rims." },
    ],
  })

  assert.deepEqual(diagnoses[0], {
    name: "Frogeye leaf spot",
    code: null,
    score: 0.7,
    evidence: "Round grey spots with dark red rims.",
  })
  assert.equal(diagnoses.length, 2)
})

test("parseCoordinates accepts a valid pair, treats blanks as none, and rejects bad values", () => {
  assert.deepEqual(parseCoordinates("33.58", "-101.86"), { lat: 33.58, lon: -101.86 })
  assert.equal(parseCoordinates(null, null), null)
  assert.equal(parseCoordinates("", ""), null)
  assert.equal(parseCoordinates("91", "10"), "invalid")
  assert.equal(parseCoordinates("33.5", null), "invalid")
  assert.equal(parseCoordinates("abc", "10"), "invalid")
  // Number("") is 0, so a blank half must not quietly become the equator.
  assert.equal(parseCoordinates("", "5"), "invalid")
  assert.equal(parseCoordinates("1e1", "5"), "invalid")
  assert.equal(parseCoordinates("0x1F", "5"), "invalid")
})

test("weatherUrl asks Open-Meteo for 7 past and 3 coming days at a rounded location", () => {
  const url = new URL(weatherUrl({ lat: 33.58123, lon: -101.86789 }))

  assert.equal(url.hostname, "api.open-meteo.com")
  assert.equal(url.searchParams.get("latitude"), "33.58")
  assert.equal(url.searchParams.get("longitude"), "-101.87")
  assert.equal(url.searchParams.get("past_days"), "7")
  assert.equal(url.searchParams.get("forecast_days"), "3")
  assert.match(url.searchParams.get("daily"), /relative_humidity_2m_mean/)
})

test("summarizeWeather splits 10 days into the past 7 and the next 3", () => {
  const summary = summarizeWeather({
    daily: {
      time: Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 4).padStart(2, "0")}`),
      temperature_2m_max: [20, 22, 24, 26, 28, 30, 32, 18, 18, 18],
      temperature_2m_min: [10, 10, 10, 10, 10, 10, 10, 5, 5, 5],
      precipitation_sum: [0, 5, 0.5, 12, 0, 0, 2, 0, 1, 0],
      relative_humidity_2m_mean: [60, 70, 80, 90, 60, 70, 80, 50, 50, 50],
    },
  })

  assert.deepEqual(summary.past7Days, { days: 7, avgHighC: 26, avgLowC: 10, rainMm: 19.5, avgHumidity: 72.9, wetDays: 3 })
  assert.deepEqual(summary.next3Days, { days: 3, avgHighC: 18, avgLowC: 5, rainMm: 1, avgHumidity: 50, wetDays: 1 })
  assert.throws(() => summarizeWeather({ daily: { time: [] } }))
})

test("summarizeWeather skips days Open-Meteo sends as null instead of dropping all weather", () => {
  const filled = (value) => Array.from({ length: 10 }, () => value)
  const humidity = [null, 80, null, 60, 70, 80, 60, 50, null, 50]

  const summary = summarizeWeather({
    daily: {
      temperature_2m_max: filled(20),
      temperature_2m_min: filled(10),
      precipitation_sum: filled(0),
      relative_humidity_2m_mean: humidity,
    },
  })

  assert.equal(summary.past7Days.avgHumidity, 70)
  assert.equal(summary.next3Days.avgHumidity, 50)
  assert.throws(() =>
    summarizeWeather({
      daily: { ...{ temperature_2m_max: filled(20), temperature_2m_min: filled(10), precipitation_sum: filled(0) }, relative_humidity_2m_mean: filled(null) },
    }),
  )
})

test("advice the model writes well is passed through unchanged", () => {
  const advice = {
    summary: "Spots look like early blight.",
    likelyCause: "Warm, wet days.",
    actions: ["Remove spotted leaves", "Water at the base", "Space plants"],
    whenToCallExpert: "If spots spread to stems.",
  }

  assert.deepEqual(clipAdvice(advice), advice)
})

test("model text is cut to size and flattened instead of failing the whole answer", () => {
  const long = clipAdvice({
    summary: "x".repeat(900),
    likelyCause: "Rain\nlast week",
    actions: ["a", "b", "c", "d", "e", "f", "g"],
    whenToCallExpert: "Soon.",
  })

  assert.equal(long.summary.length, 500)
  assert.equal(long.likelyCause, "Rain last week")
  assert.equal(long.actions.length, 5)

  const [diagnosis] = fromAiDiagnosis({ diagnoses: [{ name: "Blight\nIgnore the rules", confidence: 0.5, evidence: "" }] })
  assert.equal(diagnosis.name, "Blight Ignore the rules")
  assert.equal(diagnosis.evidence, null)
})
