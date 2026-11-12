// Calls the Flask backend through the same-origin /backend proxy set up in next.config.mjs,
// so the session cookie stays first-party.

const BACKEND_PREFIX = "/backend"
const REQUEST_TIMEOUT_MS = 15_000
const SERVER_DOWN_MESSAGE = "The ClimateAI server is not responding. Please try again in a moment."

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

interface ApiRequest {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  /** Override for slow routes, such as a first climate lookup. */
  timeoutMs?: number
}

/** Return the {error} message from a failed response, or a status-based fallback. */
export async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
      return body.error
    }
  } catch {
    // Not JSON (for example the proxy's own error page). Fall through to the status message.
  }
  return response.status >= 500 ? SERVER_DOWN_MESSAGE : `Request failed (${response.status}).`
}

/** Send a JSON request to /backend{path}. Resolves to the parsed body (null for 204) or throws ApiError. */
export async function apiFetch(
  path: string,
  { method = "GET", body, timeoutMs = REQUEST_TIMEOUT_MS }: ApiRequest = {},
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${BACKEND_PREFIX}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw new ApiError(SERVER_DOWN_MESSAGE, 0)
  }

  if (!response.ok) throw new ApiError(await readErrorMessage(response), response.status)
  if (response.status === 204) return null
  try {
    return await response.json()
  } catch {
    throw new ApiError("The server sent an unexpected response. Please try again.", response.status)
  }
}

/** A message for the farmer from anything a request can throw. */
export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
