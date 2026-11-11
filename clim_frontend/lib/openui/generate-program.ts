import { seasonBriefSystemPrompt } from "./brief-prompt";

const GATEWAY_URL = "https://api.thesys.dev/v1/embed/chat/completions";
const MODEL = "google/gemini-3.6-flash-free";
const UPSTREAM_TIMEOUT_MS = 45_000;

export type BriefResult =
  | { ok: true; program: string }
  | { ok: false; status: number; error: string };

/**
 * One OpenUI generation: component-library system prompt + a page-specific
 * instruction + the deterministic payload the page already rendered.
 * Nothing is stored; the caller decides what to do with the program.
 */
export async function generateOpenuiProgram(
  instruction: string,
  payload: string,
  apiKey: string,
): Promise<BriefResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        temperature: 0.2,
        messages: [
          { role: "system", content: seasonBriefSystemPrompt() },
          { role: "user", content: `${instruction}\n\nDATA:\n${payload}` },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("[openui-brief] gateway failed:", upstream.status, detail.slice(0, 400));
      return { ok: false, status: 502, error: "The brief generator is temporarily unavailable." };
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const program = data.choices?.[0]?.message?.content;

    if (typeof program !== "string" || program.trim() === "") {
      console.error("[openui-brief] empty program from gateway");
      return { ok: false, status: 502, error: "The brief generator returned nothing." };
    }

    return { ok: true, program };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[openui-brief] request failed:", aborted ? "timeout" : error);
    return {
      ok: false,
      status: 503,
      error: aborted
        ? "The brief took too long to generate."
        : "The brief generator is unavailable.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const BRIEF_MODEL = MODEL;
