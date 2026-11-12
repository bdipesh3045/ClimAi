// Plain-language explanations built only from the crop analysis API response.
// Nothing here invents data: every number comes from the backend, converted to US units.

import type { CropRecommendation, FarmInputs, Range } from "./crop-analysis"

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
export const TOTAL_CHECKS = 4 // warmth, water, soil pH, soil type
const MM_PER_INCH = 25.4
const LB_PER_TON = 2000
const FULL_MARK = 0.999
const WORKABLE_MARK = 0.5

export type Tone = "good" | "fair" | "poor"

export interface Scale {
  lowLabel: string
  highLabel: string
  valueLabel: string
  bestStart: number // percent along the bar
  bestEnd: number
  marker: number
}

export interface Check {
  kind: "warmth" | "water" | "soil"
  name: string
  tone: Tone
  status: string
  text: string
  scale: Scale | null
}

const STATUS: Record<Tone, string> = { good: "Optimal range", fair: "Workable", poor: "Risk" }
const FACTOR_LABELS: Record<string, string> = {
  warmth: "Warmth",
  water: "Water",
  "soil type": "Soil type",
  "soil acidity": "Soil pH",
}

export const toFahrenheit = (celsius: number) => Math.round((celsius * 9) / 5 + 32)
export const toInches = (mm: number) => Math.round(mm / MM_PER_INCH)
export const shortMonth = (month: string) => month.slice(0, 3)
export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
export const factorLabel = (name: string) => FACTOR_LABELS[name] ?? capitalize(name)
export const toneOf = (value: number): Tone =>
  value >= FULL_MARK ? "good" : value >= WORKABLE_MARK ? "fair" : "poor"

const degrees = (celsius: number) => `${toFahrenheit(celsius)}°F`
const inches = (mm: number) => `${toInches(mm)} in`

/** "loam, silt loam or clay" */
export function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`
}

export function formatWeight(pounds: number): string {
  if (pounds < LB_PER_TON) return `${Math.round(pounds).toLocaleString("en-US")} lb`
  const tons = pounds / LB_PER_TON
  return `${tons < 10 ? tons.toFixed(1) : Math.round(tons).toLocaleString("en-US")} tons`
}

/** First two parts of a long geocoder label: "Monroe, Ouachita Parish, Louisiana, ..." → "Monroe, Ouachita Parish" */
export const shortPlace = (location: string) => location.split(",").slice(0, 2).join(",").trim()

export const allChecksPass = (rec: CropRecommendation) =>
  Object.values(rec.factors).every((value) => value >= FULL_MARK)

function scale(value: number, best: Range, limit: Range, format: (n: number) => string, valueName: string): Scale {
  const position = (n: number) => Math.min(100, Math.max(0, ((n - limit[0]) / (limit[1] - limit[0])) * 100))
  return {
    lowLabel: `Min ${format(limit[0])}`,
    highLabel: `Max ${format(limit[1])}`,
    valueLabel: `${valueName}: ${format(value)}`,
    bestStart: position(best[0]),
    bestEnd: position(best[1]),
    marker: position(value),
  }
}

function warmthCheck(rec: CropRecommendation): Check {
  const value = rec.factors.warmth ?? 0
  const [low, high] = rec.needs.tempC
  const verdict =
    value >= FULL_MARK ? "That is just right."
      : rec.seasonTempC < low ? "That is cooler than it likes."
        : "That is warmer than it likes."
  return {
    kind: "warmth",
    name: "Warmth check",
    tone: toneOf(value),
    status: STATUS[toneOf(value)],
    text: `Your growing season averages about ${degrees(rec.seasonTempC)}. ${rec.crop} grows best between ${degrees(low)} and ${degrees(high)}. ${verdict}`,
    scale: scale(rec.seasonTempC, rec.needs.tempC, rec.needs.tempLimitC, degrees, "Your average"),
  }
}

/** Mirrors the backend water rule: irrigation covers a dry year or a dry growing season. */
export function waterVerdict(rec: CropRecommendation, irrigated: boolean): string {
  const [low, high] = rec.needs.rainMm
  const tooDry = rec.yearlyRainMm < low
  if (irrigated && (tooDry || rec.drySeason)) return "Your irrigation covers the shortfall."
  if (rec.drySeason) {
    return `Only about ${inches(rec.seasonRainMm)} falls during its growing season, so expect dry spells without irrigation.`
  }
  if (tooDry) return "That is less than it needs."
  if (rec.yearlyRainMm > high) return "That is more than it likes, so watch drainage."
  return "That is enough water for this crop."
}

function waterCheck(rec: CropRecommendation, farm: FarmInputs): Check {
  const value = rec.factors.water ?? 0
  const [low, high] = rec.needs.rainMm
  return {
    kind: "water",
    name: "Water check",
    tone: toneOf(value),
    status: STATUS[toneOf(value)],
    text: `About ${inches(rec.yearlyRainMm)} of rain falls here in a year. ${rec.crop} does best with ${inches(low)} to ${inches(high)}. ${waterVerdict(rec, farm.irrigated)}`,
    scale: scale(rec.yearlyRainMm, rec.needs.rainMm, rec.needs.rainLimitMm, inches, "Your land"),
  }
}

function soilTypeCheck(rec: CropRecommendation, soilType: string): Check {
  const value = rec.factors["soil type"] ?? 0
  return {
    kind: "soil",
    name: "Soil type check",
    tone: toneOf(value),
    status: value >= FULL_MARK ? "Good match" : "Weaker match",
    text: value >= FULL_MARK
      ? `Your ${soilType} soil suits ${rec.crop}.`
      : `${rec.crop} prefers ${joinOr(rec.needs.soilTypes)} soil. Your ${soilType} soil is a weaker match.`,
    scale: null,
  }
}

export function buildChecks(rec: CropRecommendation, farm: FarmInputs): Check[] {
  const checks = [warmthCheck(rec), waterCheck(rec, farm)]
  if (farm.soilType !== null && "soil type" in rec.factors) {
    checks.push(soilTypeCheck(rec, farm.soilType))
  }
  return checks
}

export function summaryLine(rec: CropRecommendation): string {
  if (allChecksPass(rec)) return "Everything we checked looks right for this crop."
  const percent = Math.round((rec.factors[rec.mainLimit] ?? 0) * 100)
  return `Weakest point: ${factorLabel(rec.mainLimit).toLowerCase()} (${percent}% match).`
}

/** One short line for an alternative crop card. */
export function watchOut(rec: CropRecommendation, farm: FarmInputs): { label: string; text: string } {
  if (allChecksPass(rec)) return { label: "Key factor", text: "everything we checked fits this land." }
  const [tempLow, tempHigh] = rec.needs.tempC
  const [rainLow, rainHigh] = rec.needs.rainMm
  const texts: Record<string, string> = {
    warmth: `the season averages ${degrees(rec.seasonTempC)}, and it grows best at ${degrees(tempLow)} to ${degrees(tempHigh)}.`,
    water: rec.drySeason && !farm.irrigated
      ? `only about ${inches(rec.seasonRainMm)} of rain falls during its growing season.`
      : `${inches(rec.yearlyRainMm)} of rain a year, and it does best with ${inches(rainLow)} to ${inches(rainHigh)}.`,
    "soil type": `it prefers ${joinOr(rec.needs.soilTypes)} soil.`,
  }
  return { label: "Watch out", text: texts[rec.mainLimit] ?? `${factorLabel(rec.mainLimit).toLowerCase()} is the weakest match.` }
}

/** Share of the crop's minimum yearly rain that rain alone provides, capped at 100. */
export const rainCoverage = (rec: CropRecommendation) =>
  Math.min(100, Math.round((rec.yearlyRainMm / rec.needs.rainMm[0]) * 100))

export function extremes(values: number[]): { highIndex: number; lowIndex: number } {
  const highIndex = values.indexOf(Math.max(...values))
  const lowIndex = values.indexOf(Math.min(...values))
  return { highIndex, lowIndex }
}
