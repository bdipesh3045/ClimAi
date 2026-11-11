import { PLANTING_BRIEF_INSTRUCTION } from "@/lib/openui/brief-prompt";
import { generateOpenuiProgram } from "@/lib/openui/generate-program";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PAYLOAD_CHARACTERS = 20_000;

/**
 * Lays out the planting calendar and simulated weather preview as an OpenUI
 * dashboard. All values are demo data supplied by the browser; the model only
 * arranges them, so it must never describe them as a live forecast.
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

  const context = (body as { context?: unknown } | null)?.context;
  if (typeof context !== "object" || context === null) {
    return Response.json({ error: "A planting context payload is required." }, { status: 400 });
  }

  const payload = JSON.stringify(context);
  if (payload.length > MAX_PAYLOAD_CHARACTERS) {
    return Response.json({ error: "The planting payload is too large." }, { status: 413 });
  }

  const result = await generateOpenuiProgram(PLANTING_BRIEF_INSTRUCTION, payload, apiKey);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ program: result.program });
}
