// Server-side sign-in check shared by the Next.js API routes that need a signed-in farmer.
// Plain TypeScript only (no enums or parameter properties) so `node --test` can import it.

import { parseAccount, type Account } from "./session.ts"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:5001"
const ACCOUNT_TIMEOUT_MS = 5_000

export type AccountResult =
  | { kind: "signed-in"; account: Account }
  | { kind: "guest" }
  | { kind: "unavailable" }

/** Ask Flask who sent this request, by passing the browser's session cookie along. */
export async function fetchAccount(request: Request, logTag: string): Promise<AccountResult> {
  const cookie = request.headers.get("cookie")
  if (!cookie) return { kind: "guest" }
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(ACCOUNT_TIMEOUT_MS),
    })
    if (response.status === 401) return { kind: "guest" }
    if (!response.ok) {
      console.error(`[${logTag}] /api/auth/me returned ${response.status}`)
      return { kind: "unavailable" }
    }
    return { kind: "signed-in", account: parseAccount(await response.json()) }
  } catch (error) {
    console.error(`[${logTag}] could not load the signed-in account`, error)
    return { kind: "unavailable" }
  }
}
