// Browser side of the plant health check: shrink the photo, call /api/plant-check, and turn
// failures into sentences a farmer can act on.

import { isPlantCheckResult, type Coordinates, type Crop, type PlantCheckResult } from "./plant-check"

// Pl@ntNet resizes to 1280 px on the short side anyway; sending more only slows the upload.
const SHORT_SIDE_PX = 1280
// Also cap the long side, so a panorama cannot grow past the server's 4 MB limit.
const LONG_SIDE_PX = 2560
const JPEG_QUALITY = 0.9
const LOCATION_TIMEOUT_MS = 10_000

/**
 * Re-encode the photo as a JPEG at most 1280 px on its short side. This also fixes phone
 * rotation and drops EXIF data such as the GPS position before the photo leaves the device.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("This photo format cannot be read here. Use a JPG or PNG photo.")
  }
  const { width, height } = bitmap
  const scale = Math.min(1, SHORT_SIDE_PX / Math.min(width, height), LONG_SIDE_PX / Math.max(width, height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    throw new Error("The photo could not be prepared in this browser. Try another browser.")
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY))
  if (!blob) throw new Error("The photo could not be prepared. Try another photo.")
  return blob
}

function messageFor(status: number, body: unknown): string {
  const serverMessage = (body as { error?: unknown } | null)?.error
  if (typeof serverMessage === "string" && serverMessage) return serverMessage
  if (status === 401) return "Sign in to check plant health."
  if (status === 413) return "The photo is too large. Try a smaller photo."
  if (status === 429) return "Too many checks in a short time. Please wait a few minutes."
  return "The plant health check is not available right now. Please try again later."
}

export async function requestPlantCheck(
  photo: Blob,
  crop: Crop,
  coords: Coordinates | null,
  signal?: AbortSignal,
): Promise<PlantCheckResult> {
  const form = new FormData()
  form.append("image", photo, "leaf.jpg")
  form.append("crop", crop)
  if (coords) {
    form.append("lat", String(coords.lat))
    form.append("lon", String(coords.lon))
  }
  let response: Response
  try {
    response = await fetch("/api/plant-check", { method: "POST", body: form, signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error("Could not reach the server. Check your connection and try again.")
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok || body === null) throw new Error(messageFor(response.status, body))
  if (!isPlantCheckResult(body)) throw new Error("The server sent an unexpected answer. Please try again.")
  return body
}

/** The device's position, or a readable reason it is not available. */
export function currentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser cannot share your location."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied. The check will run without weather."
              : "Your location could not be found. The check will run without weather.",
          ),
        ),
      { timeout: LOCATION_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
    )
  })
}
