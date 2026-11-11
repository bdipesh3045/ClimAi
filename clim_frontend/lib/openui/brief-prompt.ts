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
 * Planting & weather page. Every value there is simulated demo data, so the
 * instruction spends its rules on not dressing them up as a real forecast.
 */
export const PLANTING_BRIEF_INSTRUCTION = `Render one dashboard for a planting-calendar page from the DATA JSON below.

Rules:
- Emit ONLY OpenUI Lang. No prose outside the program.
- Every number, month, label and sentence must come from DATA, copied exactly as given. Never compute day counts, dates, growing-degree days or percentages, and never round differently.
- DATA.currentConditions and DATA.sevenDayOutlook are SIMULATED demonstration values. Never call them a forecast, never imply they are live or measured, and never tell the reader what to do based on them.
- Do not add advice, caveats or agronomic guidance of your own. The only advisory text you may show is DATA.typicalWindow.note and DATA.disclaimer, quoted as given.
- If DATA.alerts is empty, say so once in a Callout and make clear no alert feed is connected. Do not invent warnings.

Structure the dashboard as one Stack with, in this order:
1. A CardHeader naming the crop, the year and the location, with a one-line subtitle giving DATA.typicalWindow.status and the start–end months.
2. A four-item SnippetCardBlock: typical window start, typical window end, current temperature (mark it simulated), and recent rainfall (mark it simulated).
3. A "Planting calendar" card with a TagBlock: one Tag per entry in DATA.calendar, success when inTypicalWindow is true and neutral when false, so the twelve months read as a strip.
4. A Table of the seven-day outlook with columns Day, Sky, High, Low, and Rain chance, labelled as simulated.
5. A Callout carrying DATA.typicalWindow.note as given.
6. The alerts from DATA.alerts as a TagBlock, or the no-feed Callout described above.
7. A final TextContent footnote quoting DATA.disclaimer.

Keep it dense and scannable: short labels, no filler sentences, no duplicated section titles.`;
