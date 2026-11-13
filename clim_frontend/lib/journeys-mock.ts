// ===========================================================================
// MOCK DATA for Crop Journey. Everything fake lives in this file.
//
// Each export has the same shape as the real thing that will replace it:
//   MOCK_JOURNEYS        -> journeys from the backend (per account)
//   MOCK_NEXT_ACTIONS    -> next-action rules or the AI
//   mockYieldPredict()   -> POST /api/yield-predict (the yield model)
//   mockHealthCheck()    -> the plant health image model
//   MOCK_EXPERT_GUIDE, mockExpertReaction() -> the AI crop expert
// Swap one function body at a time; the components do not need to change.
// ===========================================================================

import { SEASON_DAYS, addDays, todayIso, type ActionType, type Journey, type JourneyCrop, type YieldCrop } from "@/lib/journeys";

// --------------------------------------------------------------- journeys

// Sowing dates are relative to today so the demo always shows a growing crop
// (Soybeans "Growing — Day 42", Rice "Growing — Day 19").
const SOY_SOWN_DAYS_AGO = 42;
const RICE_SOWN_DAYS_AGO = 19;

export function buildMockJourneys(): Journey[] {
  const soySown = addDays(todayIso(), -SOY_SOWN_DAYS_AGO);
  const riceSown = addDays(todayIso(), -RICE_SOWN_DAYS_AGO);
  return [
    {
      id: "soybeans-baton-rouge",
      crop: "Soybeans",
      location: "Baton Rouge, Louisiana",
      sownOn: soySown,
      seasonDays: SEASON_DAYS.Soybeans,
      sample: true,
      entries: [
        { id: "s1", date: soySown, type: "sowing", details: "Planted about 140,000 seeds per acre in 30-inch rows." },
        { id: "s2", date: addDays(soySown, 3), type: "watering", details: "Light irrigation, about half an inch, to help emergence." },
        {
          id: "s3",
          date: addDays(soySown, 9),
          type: "photo",
          details: "Even emergence across the field.",
          photoUrl: "/images/soybean-field.webp",
        },
        { id: "s4", date: addDays(soySown, 21), type: "fertilizer", details: "Side-dressed potassium, 60 lb per acre, as the soil test advised." },
        { id: "s5", date: addDays(soySown, 30), type: "pesticide", details: "Spot-sprayed for bean leaf beetles along the north edge." },
        { id: "s6", date: addDays(soySown, 38), type: "note", details: "Canopy closing between rows. Scouting once a week." },
      ],
    },
    {
      id: "rice-crowley",
      crop: "Rice",
      location: "Crowley, Louisiana",
      sownOn: riceSown,
      seasonDays: SEASON_DAYS.Rice,
      sample: true,
      entries: [
        { id: "r1", date: riceSown, type: "sowing", details: "Drill-seeded at about 80 lb per acre." },
        { id: "r2", date: addDays(riceSown, 2), type: "watering", details: "Flushed the field to start germination." },
        {
          id: "r3",
          date: addDays(riceSown, 10),
          type: "photo",
          details: "Seedlings at the two-leaf stage.",
          photoUrl: "/images/rice-field.webp",
        },
        { id: "r4", date: addDays(riceSown, 14), type: "fertilizer", details: "Pre-flood nitrogen applied on dry soil." },
        { id: "r5", date: addDays(riceSown, 17), type: "note", details: "Permanent flood planned in about a week." },
      ],
    },
  ];
}

// --------------------------------------------------------------- next actions

/** Typical next jobs by day of the season. PLUG-IN: replace with rules or the AI. */
export const MOCK_NEXT_ACTIONS: Record<string, Array<{ day: number; action: string }>> = {
  Soybeans: [
    { day: 7, action: "Check emergence and stand count" },
    { day: 21, action: "Scout for weeds and insects" },
    { day: 45, action: "Scout for stink bugs as pods form" },
    { day: 60, action: "Check soil moisture during pod fill" },
    { day: 105, action: "Watch for leaf drop before harvest" },
    { day: 120, action: "Harvest" },
  ],
  Rice: [
    { day: 21, action: "Apply the permanent flood" },
    { day: 35, action: "Scout for rice water weevil" },
    { day: 60, action: "Mid-season nitrogen at panicle start" },
    { day: 90, action: "Scout for blast during heading" },
    { day: 115, action: "Drain the field before harvest" },
    { day: 130, action: "Harvest" },
  ],
};

/** General jobs for crops without their own list, placed by share of the season. */
const GENERIC_NEXT_ACTIONS: Array<{ share: number; action: string }> = [
  { share: 0.08, action: "Check emergence and the stand" },
  { share: 0.25, action: "Scout for weeds and pests" },
  { share: 0.5, action: "Watch water and pests at flowering" },
  { share: 0.85, action: "Plan the harvest" },
  { share: 1, action: "Harvest" },
];

export function mockNextAction(crop: JourneyCrop, day: number, seasonDays: number) {
  const list =
    MOCK_NEXT_ACTIONS[crop] ??
    GENERIC_NEXT_ACTIONS.map(({ share, action }) => ({ day: Math.round(share * seasonDays), action }));
  return list.find((item) => item.day >= day) ?? null;
}

// --------------------------------------------------------------- yield model

export type YieldInput = {
  crop: YieldCrop;
  rainfallMm: number;
  tempC: number;
  pesticidesTonnes: number;
};

/** Same shape as the planned POST /api/yield-predict response. */
export type YieldPrediction = {
  predictedYieldHgHa: number;
  baselineYieldHgHa: number;
  pctChange: number;
  why: Array<{ feature: "rainfall" | "temperature" | "pesticides"; importance: number }>;
  decisionPath: string[];
  source: string;
};

// Mock curve: a smooth made-up response around each crop's typical yield. Not a model.
const MOCK_YIELD = {
  Soybeans: { baseline: 15533, bias: 16.7, tempOpt: 20.5, tempK: 0.554, rainOpt: 1150, rainK: 39.8, pestK: 4,
    why: { pesticides: 0.51, temperature: 0.28, rainfall: 0.21 } },
  Rice: { baseline: 35878, bias: 8.7, tempOpt: 26, tempK: 0.4, rainOpt: 1600, rainK: 30, pestK: 3,
    why: { rainfall: 0.55, temperature: 0.27, pesticides: 0.18 } },
} as const;

/**
 * PLUG-IN: replace this body with
 *   const res = await fetch(`${API_BASE}/api/yield-predict`, { method: "POST", body: JSON.stringify(input), ... })
 *   return (await res.json()) as YieldPrediction
 */
export async function mockYieldPredict(input: YieldInput): Promise<YieldPrediction> {
  const m = MOCK_YIELD[input.crop];
  const temp = -m.tempK * (input.tempC - m.tempOpt) ** 2;
  const rain = -m.rainK * ((input.rainfallMm - m.rainOpt) / 1000) ** 2;
  const pest = m.pestK * Math.log(Math.max(input.pesticidesTonnes, 100) / 37_000);
  const pctChange = Math.round(Math.max(-80, Math.min(80, m.bias + temp + rain + pest)) * 10) / 10;
  return {
    predictedYieldHgHa: Math.round(m.baseline * (1 + pctChange / 100)),
    baselineYieldHgHa: m.baseline,
    pctChange,
    why: (Object.entries(m.why) as Array<[YieldPrediction["why"][number]["feature"], number]>)
      .map(([feature, importance]) => ({ feature, importance }))
      .sort((a, b) => b.importance - a.importance),
    decisionPath: [], // the real model returns the rule it followed; the panel shows a slot for it
    source: "Demo data. The trained yield model will replace these numbers.",
  };
}

// --------------------------------------------------------------- health model

export type HealthResult =
  | { status: "healthy"; confidence: number }
  | { status: "defect"; name: string; confidence: number };

const MOCK_DEFECTS: Record<string, string[]> = {
  Soybeans: ["Frogeye leaf spot", "Septoria brown spot"],
  Rice: ["Rice blast", "Brown spot"],
};
const GENERIC_DEFECTS = ["Leaf spot", "Possible nutrient deficiency"];

/**
 * PLUG-IN: replace this body with the image model call, e.g.
 *   const body = new FormData(); body.append("image", file); body.append("crop", crop)
 *   const res = await fetch(`${API_BASE}/api/plant-health`, { method: "POST", body })
 *   return (await res.json()) as HealthResult
 */
export async function mockHealthCheck(file: File, crop: JourneyCrop): Promise<HealthResult> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  // Deterministic by file size, so the same photo always gives the same demo answer.
  const seed = file.size;
  const confidence = 0.78 + (seed % 17) / 100;
  if (seed % 3 === 0) return { status: "healthy", confidence };
  const defects = MOCK_DEFECTS[crop] ?? GENERIC_DEFECTS;
  return { status: "defect", name: defects[seed % defects.length], confidence };
}

// --------------------------------------------------------------- expert guide

export type ExpertStep = {
  id: string;
  title: string;
  /** Why the expert asks for it. */
  why: string;
  /** Timeline entry logged when the farmer marks the step done. */
  logsAs: ActionType;
};

export type ExpertStage = {
  /** Matches the stage names in lib/journeys.ts. */
  stage: string;
  summary: string;
  steps: ExpertStep[];
  watchFor: string[];
};

/** Stage-by-stage playbook per crop. PLUG-IN: the AI expert replaces this. */
export const MOCK_EXPERT_GUIDE: Record<string, ExpertStage[]> = {
  Soybeans: [
    {
      stage: "Germination",
      summary: "Seedlings are breaking through. A good stand now sets the ceiling for the whole season.",
      steps: [
        { id: "soy-moisture", title: "Check moisture at seeding depth", why: "Seeds need steady moisture for the first week to emerge evenly.", logsAs: "watering" },
        { id: "soy-stand", title: "Count plants in a few spots", why: "About 100,000 plants per acre or more is a healthy stand; fewer may mean replanting.", logsAs: "note" },
      ],
      watchFor: ["Soil crusting after heavy rain", "Seedling disease in cold, wet soil"],
    },
    {
      stage: "Growing",
      summary: "Leaves are building the factory that will fill the pods. Keep weeds and insects down before the canopy closes.",
      steps: [
        { id: "soy-weeds", title: "Control weeds before the canopy closes", why: "Weeds that compete in the first six weeks cost the most yield.", logsAs: "pesticide" },
        { id: "soy-scout", title: "Scout for leaf-feeding insects", why: "Bean leaf beetles and loopers are easiest to manage before flowering.", logsAs: "note" },
        { id: "soy-nodules", title: "Dig a few plants and check root nodules", why: "Pink nodules mean the plant is making its own nitrogen.", logsAs: "photo" },
      ],
      watchFor: ["Leaf feeding above 30% of the leaf area", "Yellowing that may mean poor nodulation"],
    },
    {
      stage: "Flowering",
      summary: "Flowers and pods are forming. This is when stress costs the most, so water and pests matter most now.",
      steps: [
        { id: "soy-stinkbug", title: "Sweep-net for stink bugs weekly", why: "Stink bugs feed on developing seeds and lower both yield and quality.", logsAs: "note" },
        { id: "soy-water", title: "Water if the field turns dry", why: "Drought during pod fill is the biggest single yield risk.", logsAs: "watering" },
        { id: "soy-fungicide", title: "Decide on a fungicide at early pod", why: "Only worth it if leaf disease is showing and the weather is wet.", logsAs: "pesticide" },
      ],
      watchFor: ["Stink bugs above threshold", "Frogeye leaf spot in humid weather"],
    },
    {
      stage: "Maturing",
      summary: "Seeds are filling and the plants will start to yellow. Protect what's there and plan the harvest.",
      steps: [
        { id: "soy-stopwater", title: "Stop irrigating once pods are full", why: "Extra water late in the season adds cost without adding yield.", logsAs: "note" },
        { id: "soy-plan", title: "Book the harvest and check moisture", why: "Harvest near 13% seed moisture to avoid drying costs and shattering.", logsAs: "note" },
      ],
      watchFor: ["Pod shattering if harvest is delayed", "Late-season stink bugs"],
    },
    {
      stage: "Ready to harvest",
      summary: "The season is done. Harvest promptly and write down what you learned.",
      steps: [
        { id: "soy-harvest", title: "Harvest the field", why: "Every week of delay risks lodging and pod shatter.", logsAs: "note" },
        { id: "soy-record", title: "Record the yield", why: "Your own numbers make next season's plan sharper than any average.", logsAs: "note" },
      ],
      watchFor: ["Rain delays at harvest"],
    },
  ],
  Rice: [
    {
      stage: "Germination",
      summary: "Seeds are sprouting. Keep the soil moist until the stand is even.",
      steps: [
        { id: "rice-flush", title: "Flush the field if the soil dries", why: "Rice seedlings need moist soil to emerge evenly.", logsAs: "watering" },
        { id: "rice-stand", title: "Check the stand", why: "About 10 to 20 plants per square foot gives a good start.", logsAs: "note" },
      ],
      watchFor: ["Birds feeding on seed", "Uneven emergence on high spots"],
    },
    {
      stage: "Growing",
      summary: "Tillers are forming. Get nitrogen and the permanent flood right, and keep weeds out before flooding.",
      steps: [
        { id: "rice-weeds", title: "Clean up weeds before the flood", why: "The flood suppresses weeds best when it goes onto a clean field.", logsAs: "pesticide" },
        { id: "rice-nitrogen", title: "Apply pre-flood nitrogen on dry soil", why: "Nitrogen applied to dry soil and then flooded is used most efficiently.", logsAs: "fertilizer" },
        { id: "rice-flood", title: "Bring up the permanent flood", why: "A steady 2 to 4 inch flood controls weeds and feeds the crop.", logsAs: "watering" },
      ],
      watchFor: ["Rice water weevil scars on leaves", "Flood levels dropping"],
    },
    {
      stage: "Flowering",
      summary: "The panicle is forming and heading. Keep the flood steady and watch for disease.",
      steps: [
        { id: "rice-midseason", title: "Mid-season nitrogen if the crop looks pale", why: "A boost at panicle start can lift yield on hungry fields.", logsAs: "fertilizer" },
        { id: "rice-disease", title: "Scout for blast and sheath blight", why: "Both spread fast in warm, humid weather around heading.", logsAs: "note" },
      ],
      watchFor: ["Diamond-shaped leaf lesions (blast)", "Lesions on the sheath near the water line"],
    },
    {
      stage: "Maturing",
      summary: "Grain is filling. Plan the drain and the harvest.",
      steps: [
        { id: "rice-drain", title: "Drain the field about two weeks before harvest", why: "A firm field lets the combine in without rutting.", logsAs: "watering" },
        { id: "rice-moisture", title: "Check grain moisture", why: "Harvest at about 18 to 20% moisture for the best milling quality.", logsAs: "note" },
      ],
      watchFor: ["Lodging after storms", "Stink bugs in the heads"],
    },
    {
      stage: "Ready to harvest",
      summary: "The season is done. Harvest promptly and write down what you learned.",
      steps: [
        { id: "rice-harvest", title: "Harvest the field", why: "Delays lower milling quality.", logsAs: "note" },
        { id: "rice-record", title: "Record the yield", why: "Your own numbers make next season's plan sharper than any average.", logsAs: "note" },
      ],
      watchFor: ["Rain delays at harvest"],
    },
  ],
};

/** General playbook for crops without their own. Step ids are prefixed "gen-". */
const GENERIC_EXPERT_GUIDE: ExpertStage[] = [
  {
    stage: "Germination",
    summary: "The crop is getting established. An even stand now sets up the rest of the season.",
    steps: [
      { id: "gen-moisture", title: "Keep the seedbed moist", why: "Seeds and young plants need steady moisture to establish evenly.", logsAs: "watering" },
      { id: "gen-stand", title: "Check the stand for gaps", why: "Gaps found early can still be replanted.", logsAs: "note" },
    ],
    watchFor: ["Soil crusting after heavy rain", "Seedlings dying off in wet, cold soil"],
  },
  {
    stage: "Growing",
    summary: "The plants are building leaves and roots. Keep competition and pests down.",
    steps: [
      { id: "gen-weeds", title: "Control weeds early", why: "Weeds take the most yield while the crop is young.", logsAs: "pesticide" },
      { id: "gen-feed", title: "Feed the crop if it looks pale", why: "Pale, slow growth often means the crop needs nutrients.", logsAs: "fertilizer" },
      { id: "gen-scout", title: "Scout for pests weekly", why: "Pests are cheapest to manage before numbers build up.", logsAs: "note" },
    ],
    watchFor: ["Leaf damage from insects", "Yellowing leaves"],
  },
  {
    stage: "Flowering",
    summary: "The crop is flowering or forming its harvest. Stress now costs the most.",
    steps: [
      { id: "gen-water", title: "Keep water steady", why: "Drought during flowering and fruit set does the most damage.", logsAs: "watering" },
      { id: "gen-disease", title: "Check leaves for disease", why: "Disease spreads fast in warm, humid weather.", logsAs: "photo" },
    ],
    watchFor: ["Wilting in the afternoon heat", "Spots or mould on leaves"],
  },
  {
    stage: "Maturing",
    summary: "The harvest is filling out. Protect it and get ready to harvest.",
    steps: [
      { id: "gen-plan", title: "Plan the harvest", why: "Harvesting at the right moment protects both yield and quality.", logsAs: "note" },
    ],
    watchFor: ["Storm damage or lodging", "Late pests"],
  },
  {
    stage: "Ready to harvest",
    summary: "The season is done. Harvest promptly and write down what you learned.",
    steps: [
      { id: "gen-harvest", title: "Harvest", why: "Delays risk weather damage and lower quality.", logsAs: "note" },
      { id: "gen-record", title: "Record the yield", why: "Your own numbers make next season's plan sharper than any average.", logsAs: "note" },
    ],
    watchFor: ["Rain delays at harvest"],
  },
];

/** The crop's own playbook, or the general one when there isn't one yet. */
export function expertGuideFor(crop: JourneyCrop): { stages: ExpertStage[]; general: boolean } {
  const own = MOCK_EXPERT_GUIDE[crop];
  return own ? { stages: own, general: false } : { stages: GENERIC_EXPERT_GUIDE, general: true };
}

/** Steps the sample journeys have already completed, so the guide looks lived-in. */
export const MOCK_DONE_STEPS: Record<string, string[]> = {
  "soybeans-baton-rouge": ["soy-moisture", "soy-stand", "soy-scout"],
  "rice-crowley": ["rice-flush", "rice-stand"],
};

/** The expert's reaction to the most recent timeline entry. PLUG-IN: the AI writes this. */
export function mockExpertReaction(type: ActionType, crop: JourneyCrop): string {
  const reactions: Record<ActionType, string> = {
    sowing: "Good start. Check the stand in about a week and note any gaps.",
    watering:
      crop === "Rice"
        ? "Noted. Keep the flood steady; a drop of more than an inch lets weeds back in."
        : "Noted. Water reaches the roots best when the soil isn't already saturated; skip it if rain is due.",
    pesticide: "Logged. Respect the label's re-entry interval, and scout again in about a week to see if it worked.",
    fertilizer: "Logged. Watch the colour of new leaves over the next 10 days; a deeper green means it's taken up.",
    photo: "Thanks for the photo. A photo every week or two makes changes easy to spot.",
    note: "Noted. Notes like this are what make next season's decisions better.",
  };
  return reactions[type];
}
