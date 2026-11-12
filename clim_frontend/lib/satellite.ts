// Satellite snapshot of a farm from Esri World Imagery, as a plain image URL, so no map
// library is needed. The service's export operation renders any Web Mercator box as a JPEG.

const EXPORT_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
const MERCATOR_EDGE = 20037508.342789244 // Web Mercator x at longitude 180
const MAX_MERCATOR_LAT = 85.05112878 // Web Mercator cannot draw beyond this latitude
const GROUND_HALF_WIDTH_M = 600 // about 1.2 km across: a farm and the land around it
const IMAGE_WIDTH = 800
const IMAGE_HEIGHT = 400 // 2:1, close to the preview box, which crops the edges

// Esri requires this credit next to the imagery (from the service's copyrightText).
export const SATELLITE_ATTRIBUTION = "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community"

/** Image URL centered on the point, or null when the point is missing or outside the map. */
export function satelliteImageUrl(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > MAX_MERCATOR_LAT || Math.abs(lon) > 180) return null

  const x = (lon * MERCATOR_EDGE) / 180
  const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * MERCATOR_EDGE) / Math.PI
  // Mercator stretches distances away from the equator. Widen the box to keep 1.2 km on the ground.
  const halfWidth = GROUND_HALF_WIDTH_M / Math.cos((lat * Math.PI) / 180)
  const halfHeight = (halfWidth * IMAGE_HEIGHT) / IMAGE_WIDTH
  const bbox = [x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight].map((v) => v.toFixed(0)).join(",")

  const params = new URLSearchParams({
    bbox,
    bboxSR: "3857",
    imageSR: "3857",
    size: `${IMAGE_WIDTH},${IMAGE_HEIGHT}`,
    format: "jpg",
    f: "image",
  })
  return `${EXPORT_URL}?${params}`
}
