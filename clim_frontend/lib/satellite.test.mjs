// Run with: npm test (Node 23.6+ runs the TypeScript import directly)
import assert from "node:assert/strict"
import test from "node:test"

import { satelliteImageUrl } from "./satellite.ts"

const MERCATOR_EDGE = 20037508.342789244

function bboxOf(url) {
  return new URL(url).searchParams.get("bbox").split(",").map(Number)
}

test("asks Esri World Imagery for a 2:1 image centered on the farm", () => {
  const url = new URL(satelliteImageUrl(0, 0))

  assert.equal(url.origin, "https://server.arcgisonline.com")
  assert.equal(url.pathname, "/ArcGIS/rest/services/World_Imagery/MapServer/export")
  assert.equal(url.searchParams.get("f"), "image")
  assert.equal(url.searchParams.get("bboxSR"), "3857")
  assert.deepEqual(bboxOf(url.href), [-600, -300, 600, 300])
})

test("keeps the same ground width away from the equator", () => {
  const lat = 41.5868
  const lon = -93.625
  const [xmin, ymin, xmax, ymax] = bboxOf(satelliteImageUrl(lat, lon))
  const x = (lon * MERCATOR_EDGE) / 180
  const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * MERCATOR_EDGE) / Math.PI

  assert.ok(Math.abs((xmin + xmax) / 2 - x) <= 1, "centered east-west")
  assert.ok(Math.abs((ymin + ymax) / 2 - y) <= 1, "centered north-south")
  assert.ok(Math.abs((xmax - xmin) * Math.cos((lat * Math.PI) / 180) - 1200) <= 2, "about 1.2 km across")
})

test("returns null when the point cannot be drawn", () => {
  for (const [lat, lon] of [[Number.NaN, 0], [0, Number.POSITIVE_INFINITY], [89, 0], [0, 181]]) {
    assert.equal(satelliteImageUrl(lat, lon), null, `${lat},${lon}`)
  }
})
