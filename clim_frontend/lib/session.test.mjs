// Run with: npm test (Node 23.6+ runs the TypeScript import directly)
import assert from "node:assert/strict"
import test from "node:test"

import { destinationAfterSignIn, parseAccount, parseProfile, safeNextPath } from "./session.ts"

const PROFILE = {
  fullName: "Asha Patel",
  phone: null,
  farmName: "Prairie Creek Farm",
  location: "Des Moines, Iowa, United States",
  coordinates: { lat: 41.6, lon: -93.61 },
  farm: { size: 40, sizeUnit: "acres" },
  soilType: "Silt",
  irrigation: { available: true, method: "Drip" },
  currentCrops: ["Corn", "Soybeans"],
  updatedAt: "2026-11-11T23:00:00+00:00",
}
const USER = { id: 7, email: "asha@example.com" }

test("parseAccount accepts a signed-in user with and without a profile", () => {
  assert.deepEqual(parseAccount({ user: USER, profile: null }), { user: USER, profile: null })
  assert.deepEqual(parseAccount({ user: USER, profile: PROFILE }), { user: USER, profile: PROFILE })
})

test("parseAccount rejects malformed payloads", () => {
  const bad = [
    null,
    "signed in",
    { profile: null },
    { user: { id: "7", email: USER.email }, profile: null },
    { user: USER, profile: { ...PROFILE, coordinates: null } },
    { user: USER, profile: { ...PROFILE, farm: { size: 40, sizeUnit: "miles" } } },
    { user: USER, profile: { ...PROFILE, currentCrops: [1] } },
    { user: USER, profile: { ...PROFILE, irrigation: { available: "yes", method: null } } },
  ]
  for (const payload of bad) {
    assert.throws(() => parseAccount(payload), Error, JSON.stringify(payload))
  }
})

test("parseProfile reads the profile save response", () => {
  assert.deepEqual(parseProfile({ profile: PROFILE }), PROFILE)
  assert.throws(() => parseProfile({ profile: null }))
})

test("safeNextPath keeps same-site paths and drops anything that could leave the site", () => {
  assert.equal(safeNextPath("/crop-finder/results"), "/crop-finder/results")
  assert.equal(safeNextPath("/profile?tab=farm#crops"), "/profile?tab=farm#crops")
  const offSite = [
    undefined, ["/dashboard"], "", "dashboard", "//evil.example", "/\\evil.example", "https://evil.example",
    "/\t/evil.example", "/\n/evil.example", "/\r/evil.example", // URL parsers drop these, leaving //evil.example
  ]
  for (const value of offSite) {
    assert.equal(safeNextPath(value), null, String(value))
  }
})

test("destinationAfterSignIn sends farmers without a profile to the profile page first", () => {
  assert.equal(destinationAfterSignIn({ user: USER, profile: null }, "/crop-finder"), "/profile")
  assert.equal(destinationAfterSignIn({ user: USER, profile: PROFILE }, "/crop-finder"), "/crop-finder")
  assert.equal(destinationAfterSignIn({ user: USER, profile: PROFILE }, null), "/dashboard")
})
