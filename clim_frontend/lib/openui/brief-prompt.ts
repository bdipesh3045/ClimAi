import { generateSystemPrompt } from "@openuidev/lang-core";
import librarySpec from "./spec.json";

/**
 * The system prompt is generated from the OpenUI component library so the model
 * only ever emits components this app can render.
 *
 * `spec.json` is the output of `openui generate` for @openuidev/react-ui@0.18.5
 * (the same library `openuiLibrary` renders). Regenerate it if that package is
 * upgraded, otherwise prompt and renderer can disagree.
 */
const { promptOptions, ...library } = librarySpec;

let cachedSystemPrompt: string | null = null;

export function seasonBriefSystemPrompt(): string {
  cachedSystemPrompt ??= generateSystemPrompt({ cloud: true, library, promptOptions });
  return cachedSystemPrompt;
}

/**
 * Sent as the user message, followed by the deterministic comparison payload.
 * The payload is the only source of numbers: this page makes agronomic claims,
 * so the model is not allowed to add, round differently, or extrapolate.
 */
export const SEASON_BRIEF_INSTRUCTION = `Render one dashboard for a season-comparison page from the DATA JSON below.

Rules:
- Emit ONLY OpenUI Lang. No prose outside the program.
- Every number, date, label and sentence you show must come from DATA, copied exactly as given. Never compute new values, never round differently, never add typical ranges, costs or dates. If DATA has no value for something, leave it out.
- Do not invent crops, risks, sources or recommendations. Use the provided verdicts, challenges and recommendations verbatim (you may shorten a reason only by dropping a trailing clause).
- Missing chart values are null: skip those points rather than plotting zero.
- Units are given in DATA.charts.tempUnit and DATA.charts.rainUnit.

Structure the dashboard as one Stack with, in this order:
1. A CardHeader naming the location and the compared window, with a one-line subtitle stating the baseline and outlook labels.
2. A four-item SnippetCardBlock of headline metrics: temperature shift, rainfall shift, days above the stated threshold, and longest dry spell. Use IconText for the label and BoldText for the value, and put the unit inside the value.
3. A "Season shape" card containing a LineChart for monthly temperature (two Series: baseline and outlook, in tempUnit) and a BarChart for monthly rainfall (two Series: baseline and outlook, in rainUnit), each with all twelve months on the x-axis.
4. A Table of crop verdicts with columns Crop, Verdict, Why, and ECOCROP optimum (temperature range + annual rainfall when present). Style the verdict per row so Continue reads as success, Caution as warning, Reconsider as danger.
5. A TagBlock of challenges, one Tag per challenge using its level (Elevated → danger, Moderate → warning, Low → success) and its detail shortened to one clause.
6. A Steps block of the recommended actions, in the given order.
7. A final TextContent footnote: "Generated from the comparison above. The cards below are the source of record."

Keep it dense and scannable: short labels, no filler sentences, no duplicated section titles.`;

/**
 * Planting & weather page: climatological normals checked against an ECOCROP
 * optimum. The rules keep the model from presenting normals as a forecast.
 */
export const PLANTING_BRIEF_INSTRUCTION = `Render one dashboard summarizing a planting-window analysis from the DATA JSON below.

Rules:
- Emit ONLY OpenUI Lang. No prose outside the program.
- Every number, month, label and sentence must come from DATA, copied exactly as given. Never compute totals, averages, month counts or percentages, and never re-round a value.
- DATA is real climatology (monthly normals) compared with FAO ECOCROP optimums. Never call it a forecast, a live measurement, or a prediction.
- Do not add advice, caveats or agronomic guidance of your own. The only narrative text you may show is DATA.suitability.summary, DATA.rainfall.summary and the entries of DATA.notes, quoted as given.
- Never invent a month, a crop, a range or a planting window. If DATA.window.monthNames is empty, show DATA.window.label exactly and say no window is claimed.

Structure the dashboard as one Stack with, in this order:
1. A CardHeader with DATA.crop.name and DATA.crop.scientificName, and a subtitle combining DATA.location.label with DATA.baseline.label.
2. A four-item SnippetCardBlock: DATA.window.label as the planting window, DATA.suitability.suitableMonths plus " of 12" as suitable months, DATA.rainfall.annual as annual rainfall, and DATA.crop.tempOptimal as the optimal temperature range.
3. A Table of DATA.months with columns Month, Mean temp, Rainfall, and In window, using tempDisplay, rainDisplay and the inWindow flag as Yes/No.
4. A Callout carrying DATA.suitability.summary, then a second Callout carrying DATA.rainfall.summary.
5. A card listing DATA.notes as short bullet lines, headed "How this window was derived".
6. A final TextContent footnote naming DATA.sources.observed, DATA.sources.requirements and DATA.sources.geocoding.

Keep it dense and scannable: short labels, no filler sentences, no duplicated section titles.`;
