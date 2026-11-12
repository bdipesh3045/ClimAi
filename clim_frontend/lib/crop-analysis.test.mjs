// Run with: npm test (Node 23.6+ runs the TypeScript import directly)
import assert from "node:assert/strict"
import test from "node:test"

import { parseCropAnalysis } from "./crop-analysis.ts"

const MAIZE = {
  crop: "Maize",
  emoji: "🌽",
  category: "cereal",
  season_days: 120,
  needs: {
    temp_c: [18, 33],
    temp_limit_c: [10, 45],
    rain_mm: [600, 1200],
    rain_limit_mm: [400, 1800],
    ph: [5.5, 7.0],
    soil_types: ["loam", "silt loam"],
  },
  score: 100,
  level: "Great fit",
  main_limit: "warmth",
  factors: { warmth: 1, water: 1, "soil type": 1 },
  plant_month: "May",
  harvest_month: "September",
  season_temp_c: 21.5,
  yearly_rain_mm: 912,
  season_rain_mm: 475,
  dry_season: false,
  harvest_lb_per_acre: 9800,
  harvest_lb_total: 392000,
  harvest_what: "grain",
  missing: ["soil pH"],
}

const RESPONSE = {
  message: "Crop recommendations ready.",
  location: "Des Moines, Iowa",
  farm: { acres: 40, soil_type: "silt loam", irrigated: false },
  climate: {
    source: "NASA POWER 30-year monthly climatology",
    monthly_temp_c: [-6, -3, 4, 11, 17, 22, 24, 23, 18, 11, 3, -4],
    monthly_rain_mm: [25, 32, 55, 95, 125, 130, 115, 105, 80, 65, 50, 35],
  },
  recommendations: [MAIZE],
}

test("reads a crop analysis response from the backend", () => {
  const result = parseCropAnalysis(RESPONSE)

  assert.equal(result.location, "Des Moines, Iowa")
  assert.equal(result.monthlyRainMm.length, 12)
  assert.deepEqual(result.farm, { acres: 40, soilType: "silt loam", irrigated: false })
  assert.deepEqual(result.recommendations[0], {
    crop: "Maize",
    emoji: "🌽",
    category: "cereal",
    seasonDays: 120,
    needs: {
      tempC: [18, 33],
      tempLimitC: [10, 45],
      rainMm: [600, 1200],
      rainLimitMm: [400, 1800],
      ph: [5.5, 7.0],
      soilTypes: ["loam", "silt loam"],
    },
    score: 100,
    level: "Great fit",
    mainLimit: "warmth",
    factors: { warmth: 1, water: 1, "soil type": 1 },
    plantMonth: "May",
    harvestMonth: "September",
    seasonTempC: 21.5,
    yearlyRainMm: 912,
    seasonRainMm: 475,
    drySeason: false,
    harvestLbPerAcre: 9800,
    harvestLbTotal: 392000,
    harvestWhat: "grain",
    missing: ["soil pH"],
  })
})

test("keeps nulls for year-round crops and poor fits", () => {
  const coffee = {
    ...MAIZE,
    crop: "Coffee (arabica)",
    score: 12,
    level: "Not recommended",
    plant_month: null,
    harvest_month: null,
    harvest_lb_per_acre: null,
    harvest_lb_total: null,
  }

  const [rec] = parseCropAnalysis({ ...RESPONSE, recommendations: [coffee] }).recommendations

  assert.equal(rec.plantMonth, null)
  assert.equal(rec.harvestLbTotal, null)
  assert.equal(rec.level, "Not recommended")
})

test("rejects a response with a wrong field type", () => {
  const broken = { ...RESPONSE, recommendations: [{ ...MAIZE, score: "100" }] }

  assert.throws(() => parseCropAnalysis(broken), /field "score"/)
})

test("rejects a response that is not crop analysis", () => {
  assert.throws(() => parseCropAnalysis({ error: "nope" }), /climate is not an object/)
  assert.throws(() => parseCropAnalysis(null), /response is not an object/)
})
