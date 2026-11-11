import { SEASON_BRIEF_INSTRUCTION } from "@/lib/openui/brief-prompt";
import { generateOpenuiProgram } from "@/lib/openui/generate-program";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PAYLOAD_CHARACTERS = 40_000;

/**
 * Turns the deterministic comparison payload the page already holds into an
 * OpenUI program. Nothing is stored: the browser sends the numbers it rendered,
 * the model lays them out, and the result goes back to that browser only.
 */
export async function POST(request: Request) {
  const apiKey = process.env.THESYS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The generative brief is not configured on this server." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const comparison = (body as { comparison?: unknown } | null)?.comparison;
  if (typeof comparison !== "object" || comparison === null) {
    return Response.json({ error: "A comparison payload is required." }, { status: 400 });
  }

  const payload = JSON.stringify(comparison);
  if (payload.length > MAX_PAYLOAD_CHARACTERS) {
    return Response.json({ error: "The comparison payload is too large." }, { status: 413 });
  }

  const result = await generateOpenuiProgram(SEASON_BRIEF_INSTRUCTION, payload, apiKey);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ program: result.program });
}
