// Types and a checked parser for the Flask /api/crop-analysis response, plus the
// sessionStorage hand-off from the Crop Finder form to the results page.
// The backend is a separate service, so its JSON is validated before the page renders it.

const FIT_LEVELS = ["Great fit", "Good fit", "Possible with care", "Not recommended"] as const
const STORAGE_KEY = "climateai:crop-analysis"

export type CropFitLevel = (typeof FIT_LEVELS)[number]
export type Range = [number, number]

export interface CropNeeds {
  tempC: Range
  tempLimitC: Range
  rainMm: Range
  rainLimitMm: Range
  ph: Range
  soilTypes: string[]
}

export interface CropRecommendation {
  crop: string
  emoji: string
  category: string
  seasonDays: number
  needs: CropNeeds
  score: number
  level: CropFitLevel
  mainLimit: string
  factors: Record<string, number>
  plantMonth: string | null
  harvestMonth: string | null
  seasonTempC: number
  yearlyRainMm: number
  seasonRainMm: number
  drySeason: boolean
  harvestLbPerAcre: number | null
  harvestLbTotal: number | null
  harvestWhat: string
  missing: string[]
}

export interface FarmInputs {
  acres: number | null
  soilType: string | null
  irrigated: boolean
}

export interface CropAnalysisResult {
  location: string | null
  farm: FarmInputs
  climateSource: string
  monthlyTempC: number[]
  monthlyRainMm: number[]
  recommendations: CropRecommendation[]
}

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === "string"
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean"
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)
const isStringOrNull = (value: unknown): value is string | null => value === null || isString(value)
const isNumberOrNull = (value: unknown): value is number | null => value === null || isNumber(value)
const isArray = (value: unknown): value is unknown[] => Array.isArray(value)
const isStringArray = (value: unknown): value is string[] => isArray(value) && value.every(isString)
const isRange = (value: unknown): value is Range => isArray(value) && value.length === 2 && value.every(isNumber)
const isTwelveNumbers = (value: unknown): value is number[] =>
  isArray(value) && value.length === 12 && value.every(isNumber)
const isNumberRecord = (value: unknown): value is Record<string, number> =>
  isObject(value) && Object.values(value).every(isNumber)
const isFitLevel = (value: unknown): value is CropFitLevel => FIT_LEVELS.some((level) => level === value)

function field<T>(source: JsonObject, key: string, check: (value: unknown) => value is T): T {
  const value = source[key]
  if (!check(value)) {
    throw new Error(`The crop analysis service sent an unexpected response (field "${key}").`)
  }
  return value
}

function object(value: unknown, name: string): JsonObject {
  if (!isObject(value)) {
    throw new Error(`The crop analysis service sent an unexpected response (${name} is not an object).`)
  }
  return value
}

function parseNeeds(value: unknown): CropNeeds {
  const raw = object(value, "needs")
  return {
    tempC: field(raw, "temp_c", isRange),
    tempLimitC: field(raw, "temp_limit_c", isRange),
    rainMm: field(raw, "rain_mm", isRange),
    rainLimitMm: field(raw, "rain_limit_mm", isRange),
    ph: field(raw, "ph", isRange),
    soilTypes: field(raw, "soil_types", isStringArray),
  }
}

function parseRecommendation(value: unknown): CropRecommendation {
  const raw = object(value, "recommendation")
  return {
    crop: field(raw, "crop", isString),
    emoji: field(raw, "emoji", isString),
    category: field(raw, "category", isString),
    seasonDays: field(raw, "season_days", isNumber),
    needs: parseNeeds(raw.needs),
    score: field(raw, "score", isNumber),
    level: field(raw, "level", isFitLevel),
    mainLimit: field(raw, "main_limit", isString),
    factors: field(raw, "factors", isNumberRecord),
    plantMonth: field(raw, "plant_month", isStringOrNull),
    harvestMonth: field(raw, "harvest_month", isStringOrNull),
    seasonTempC: field(raw, "season_temp_c", isNumber),
    yearlyRainMm: field(raw, "yearly_rain_mm", isNumber),
    seasonRainMm: field(raw, "season_rain_mm", isNumber),
    drySeason: field(raw, "dry_season", isBoolean),
    harvestLbPerAcre: field(raw, "harvest_lb_per_acre", isNumberOrNull),
    harvestLbTotal: field(raw, "harvest_lb_total", isNumberOrNull),
    harvestWhat: field(raw, "harvest_what", isString),
    missing: field(raw, "missing", isStringArray),
  }
}

/** Check the backend JSON and convert it to the shape the page uses. Throws an Error with a readable message. */
export function parseCropAnalysis(data: unknown): CropAnalysisResult {
  const response = object(data, "response")
  const climate = object(response.climate, "climate")
  const farm = object(response.farm, "farm")
  return {
    location: field(response, "location", isStringOrNull),
    farm: {
      acres: field(farm, "acres", isNumberOrNull),
      soilType: field(farm, "soil_type", isStringOrNull),
      irrigated: field(farm, "irrigated", isBoolean),
    },
    climateSource: field(climate, "source", isString),
    monthlyTempC: field(climate, "monthly_temp_c", isTwelveNumbers),
    monthlyRainMm: field(climate, "monthly_rain_mm", isTwelveNumbers),
    recommendations: field(response, "recommendations", isArray).map(parseRecommendation),
  }
}

/** Keep the raw backend response for the results page. Survives a refresh, cleared when the tab closes. */
export function saveCropAnalysis(data: unknown): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    throw new Error("Your browser blocked saving the results. Allow site storage and try again.")
  }
}

/** The last saved analysis, or null if there is none. Throws if the stored data is unreadable. */
export function loadCropAnalysis(): CropAnalysisResult | null {
  const stored = window.sessionStorage.getItem(STORAGE_KEY)
  return stored === null ? null : parseCropAnalysis(JSON.parse(stored))
}
