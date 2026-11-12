// Shapes the Flask account routes return, checked before the page trusts them.
// Plain TypeScript only (no enums or parameter properties) so `node --test` can import it.

export const FARM_SIZE_UNITS = ["acres", "hectares"] as const
export type FarmSizeUnit = (typeof FARM_SIZE_UNITS)[number]

export type User = { id: number; email: string }

export type FarmerProfile = {
  fullName: string
  phone: string | null
  farmName: string | null
  location: string
  coordinates: { lat: number; lon: number }
  farm: { size: number; sizeUnit: FarmSizeUnit }
  soilType: string | null
  irrigation: { available: boolean; method: string | null }
  currentCrops: string[]
  updatedAt: string
}

/** What the profile form sends to PUT /api/profile. */
export type ProfileInput = Omit<FarmerProfile, "updatedAt">

export type Account = { user: User; profile: FarmerProfile | null }

const DEFAULT_HOME = "/dashboard"
const PROFILE_PAGE = "/profile"
const BAD_RESPONSE = "The server sent an unexpected response. Please try again."

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isTextOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isUser(value: unknown): value is User {
  return isRecord(value) && isNumber(value.id) && typeof value.email === "string"
}

function isProfile(value: unknown): value is FarmerProfile {
  if (!isRecord(value)) return false
  const { coordinates, farm, irrigation, currentCrops } = value
  return typeof value.fullName === "string"
    && isTextOrNull(value.phone)
    && isTextOrNull(value.farmName)
    && typeof value.location === "string"
    && isRecord(coordinates) && isNumber(coordinates.lat) && isNumber(coordinates.lon)
    && isRecord(farm) && isNumber(farm.size)
    && FARM_SIZE_UNITS.some((unit) => unit === farm.sizeUnit)
    && isTextOrNull(value.soilType)
    && isRecord(irrigation) && typeof irrigation.available === "boolean" && isTextOrNull(irrigation.method)
    && Array.isArray(currentCrops) && currentCrops.every((crop) => typeof crop === "string")
    && typeof value.updatedAt === "string"
}

/** Read the {user, profile} body from signup, login, and /me. Throws a readable error on anything else. */
export function parseAccount(data: unknown): Account {
  if (!isRecord(data) || !isUser(data.user) || !(data.profile === null || isProfile(data.profile))) {
    throw new Error(BAD_RESPONSE)
  }
  return { user: data.user, profile: data.profile }
}

/** Read the {profile} body from PUT /api/profile. */
export function parseProfile(data: unknown): FarmerProfile {
  if (!isRecord(data) || !isProfile(data.profile)) throw new Error(BAD_RESPONSE)
  return data.profile
}

/** Accept a ?next= value only when it is a path on this site, so sign-in cannot redirect elsewhere.
 * Resolving it the way the router will (URL parsers drop tabs and newlines, and read "\\" as "/")
 * catches tricks like "/\t/evil.example" that a plain prefix check misses. */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null
  const base = "http://same-site.invalid"
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return null
  }
  return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : null
}

/** Farmers who have not filled in their profile go there first. */
export function destinationAfterSignIn(account: Account, nextPath: string | null): string {
  if (account.profile === null) return PROFILE_PAGE
  return nextPath ?? DEFAULT_HOME
}
