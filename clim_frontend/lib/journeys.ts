// Crop Journey: types and plain date helpers. These stay when real journey data replaces
// the mocks in lib/journeys-mock.ts.

/** Any crop from clim_backend/crops.json (served by GET /backend/journeys/crops). */
export type JourneyCrop = string;
/** Crops the yield model covers. */
export type YieldCrop = "Soybeans" | "Rice";
export const YIELD_CROPS: YieldCrop[] = ["Soybeans", "Rice"];

export type CropOption = { name: string; category: string; seasonDays: number };
export type ActionType = "sowing" | "watering" | "pesticide" | "fertilizer" | "photo" | "note";

export type JourneyEntry = {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  type: ActionType;
  details: string;
  /** Object URL for a photo picked in this session, or a path under /public for sample photos. */
  photoUrl?: string;
};

export type Journey = {
  id: string;
  crop: JourneyCrop;
  location: string;
  /** ISO date, YYYY-MM-DD. */
  sownOn: string;
  seasonDays: number;
  /** True for the built-in sample journeys, shown with a "Sample journey" label. */
  sample: boolean;
  entries: JourneyEntry[];
};

// Days from planting to harvest for the sample journeys, the same values as clim_backend/crops.json.
export const SEASON_DAYS: Record<YieldCrop, number> = { Soybeans: 120, Rice: 130 };

export const ACTION_LABELS: Record<ActionType, string> = {
  sowing: "Sowing",
  watering: "Watering",
  pesticide: "Pesticide",
  fertilizer: "Fertilizer",
  photo: "Photo",
  note: "Note",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso() {
  return toIso(new Date());
}

export function addDays(iso: string, days: number) {
  const date = parse(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** "Mar 10", or "Mar 10, 2025" when it is not this year. */
export function formatDate(iso: string) {
  const date = parse(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `${MONTHS[date.getMonth()]} ${date.getDate()}${sameYear ? "" : `, ${date.getFullYear()}`}`;
}

export function daysBetween(fromIso: string, toIsoDate: string) {
  return Math.round((parse(toIsoDate).getTime() - parse(fromIso).getTime()) / DAY_MS);
}

/** Day of the season today; sowing day is day 0. */
export function daysSinceSowing(journey: Journey) {
  return Math.max(0, daysBetween(journey.sownOn, todayIso()));
}

export function expectedHarvest(journey: Journey) {
  return addDays(journey.sownOn, journey.seasonDays);
}

/** 0 to 1, from sowing to expected harvest. */
export function progress(journey: Journey) {
  return Math.min(1, daysSinceSowing(journey) / journey.seasonDays);
}

// Stage names by share of the season. Only used to label the stage, not to judge the crop.
const STAGES: Array<[upTo: number, name: string]> = [
  [0.1, "Germination"],
  [0.45, "Growing"],
  [0.7, "Flowering"],
  [1, "Maturing"],
];

export function stageFor(journey: Journey) {
  const share = progress(journey);
  if (share >= 1) return HARVEST_STAGE;
  return STAGES.find(([upTo]) => share < upTo)?.[1] ?? "Maturing";
}

export const HARVEST_STAGE = "Ready to harvest";

/** Every stage with its day range for this journey, the harvest stage last. */
export function stageRanges(journey: Journey) {
  let from = 0;
  const ranges = STAGES.map(([upTo, name]) => {
    const to = Math.round(upTo * journey.seasonDays);
    const range = { name, fromDay: from, toDay: to };
    from = to;
    return range;
  });
  return [...ranges, { name: HARVEST_STAGE, fromDay: journey.seasonDays, toDay: journey.seasonDays }];
}

/** Entries newest first; same-day entries keep the order they were added (latest on top). */
export function sortedEntries(journey: Journey) {
  return journey.entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (a.entry.date === b.entry.date ? b.index - a.index : a.entry.date < b.entry.date ? 1 : -1))
    .map(({ entry }) => entry);
}

export function lastPhoto(journey: Journey) {
  return sortedEntries(journey).find((entry) => entry.type === "photo");
}
