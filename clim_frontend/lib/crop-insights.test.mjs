// Run with: npm test
import assert from "node:assert/strict"
import test from "node:test"

import { buildChecks, formatWeight, rainCoverage, waterVerdict } from "./crop-insights.ts"

const RICE = {
  crop: "Rice",
  needs: {
    tempC: [20, 30],
    tempLimitC: [10, 36],
    rainMm: [1200, 2000],
    rainLimitMm: [1000, 4000],
    ph: [5.5, 7.0],
    soilTypes: ["clay", "clay loam", "silt loam"],
  },
  factors: { warmth: 1, water: 0, "soil type": 0.4 },
  mainLimit: "water",
  seasonTempC: 21,
  yearlyRainMm: 912,
  seasonRainMm: 475,
  drySeason: false,
}
const FARM = { acres: 40, soilType: "loam", irrigated: false }

test("explains water from the API numbers, irrigation first", () => {
  assert.equal(waterVerdict(RICE, false), "That is less than it needs.")
  assert.equal(waterVerdict(RICE, true), "Your irrigation covers the shortfall.")
  assert.match(waterVerdict({ ...RICE, yearlyRainMm: 1500, drySeason: true }, false), /about 19 in falls/)
})

test("builds warmth, water and soil checks with US units", () => {
  const [warmth, water, soil] = buildChecks(RICE, FARM)

  assert.match(warmth.text, /about 70°F\. Rice grows best between 68°F and 86°F\. That is just right\./)
  assert.equal(warmth.tone, "good")
  assert.equal(water.tone, "poor")
  assert.equal(water.scale.valueLabel, "Your land: 36 in")
  assert.match(soil.text, /prefers clay, clay loam or silt loam soil/)
  assert.equal(buildChecks(RICE, { ...FARM, soilType: null }).length, 2)
})

test("formats harvest weights and rain coverage", () => {
  assert.equal(formatWeight(1500), "1,500 lb")
  assert.equal(formatWeight(9800), "4.9 tons")
  assert.equal(formatWeight(392000), "196 tons")
  assert.equal(rainCoverage(RICE), 76)
})
