"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Droplets,
  MapPin,
  Minus,
  Search,
  ThermometerSun,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SeasonBrief } from "@/components/seasons/season-brief";
import { PageIntro } from "@/components/shared/page-intro";

// ---------------------------------------------------------------------------
// Season Comparison — presentation only.
// Every fetch (geocoding, NASA POWER observations, Open-Meteo seasonal
// outlook, FAO ECOCROP requirements) and every derived number (deltas,
// extremes, risk levels, crop verdicts, recommendations) happens in the Flask
// backend at /api/locations/search, /api/crops/search and /api/season/compare.
// ---------------------------------------------------------------------------

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5001"; // 5000 is taken by macOS AirPlay Receiver

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const GREEN_MID = "#398253";
const GREEN_LIGHT = "#8fbf92";

type Units = "imperial" | "metric";

type LocationResult = { label: string; lat: number; lon: number };

type CropResult = {
  id: string;
  name: string;
  scientificName: string;
  commonNames: string[];
  tempOptimalC: [number, number];
  rainOptimalMmYear: [number, number] | null;
};

type ChartPoint = { month: string; baseline: number | null; outlook: number | null };

type Challenge = { key: string; label: string; level: string; detail: string };

type VerdictRow = {
  crop: string;
  verdict: string;
  reason: string;
  requirement?: {
    scientificName: string;
    optimalTempRange: string;
    optimalAnnualRain: string;
  };
};

type Comparison = {
  generatedAt: string;
  location: { label: string; lat: number; lon: number };
  units: Units;
  window: { label: string; months: number[]; monthNames: string[] };
  baseline: { years: number[]; label: string; monthsAvailable: number };
  outlook: {
    label: string;
    range: { start: string; end: string } | null;
    windowMonthsAvailable: number;
    windowMonthsTotal: number;
  };
  overview: {
    tempShift: { value: number | null; display: string; trend: string };
    rainShift: { value: number | null; display: string; trend: string };
    tempSummary: string;
    rainSummary: string;
  };
  charts: {
    temperature: ChartPoint[];
    rainfall: ChartPoint[];
    tempUnit: string;
    rainUnit: string;
  };
  extremes: {
    daysAboveThreshold: number;
    thresholdDisplay: string;
    hottestDayDisplay: string;
    hottestDate: string | null;
    longestDrySpellDays: number;
  } | null;
  challenges: Challenge[];
  verdicts: VerdictRow[];
  recommendations: string[];
};

function levelStyles(level: string): string {
  if (level === "Elevated")
    return "bg-[#fbeae6] text-[#a33c32] border-[#f0cfc6]";
  if (level === "Moderate")
    return "bg-[#fdf3e3] text-[#9a6a1c] border-[#eed9ae]";
  if (level === "Low") return "bg-[#e9f2eb] text-[#1d4d31] border-[#cfe3d2]";
  return "bg-[#f1f3f1] text-[#6b7570] border-[#e0e5e0]";
}

function verdictStyles(verdict: string): string {
  if (verdict === "Continue")
    return "bg-[#e9f2eb] text-[#1d4d31] border-[#cfe3d2]";
  if (verdict === "Reconsider")
    return "bg-[#fbeae6] text-[#a33c32] border-[#f0cfc6]";
  return "bg-[#fdf3e3] text-[#9a6a1c] border-[#eed9ae]";
}

function TrendIcon({ trend, size = 13 }: { trend: string; size?: number }) {
  if (trend === "up") return <ArrowUpRight size={size} />;
  if (trend === "down") return <ArrowDownRight size={size} />;
  return <Minus size={size} />;
}

export function SeasonComparison() {
  // Form state
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "empty" | "error"
  >("idle");
  const [location, setLocation] = useState<LocationResult | null>(null);

  const [cropQuery, setCropQuery] = useState("");
  const [cropResults, setCropResults] = useState<CropResult[]>([]);
  const [cropStatus, setCropStatus] = useState<
    "idle" | "loading" | "empty" | "error"
  >("idle");
  const [cropSource, setCropSource] = useState("");
  const [selectedCrops, setSelectedCrops] = useState<CropResult[]>([]);

  const [previousYear, setPreviousYear] = useState("2024");
  const [baselineSpan, setBaselineSpan] = useState("1");
  const [units, setUnits] = useState<Units>("imperial");
  const [plantingMonth, setPlantingMonth] = useState("3");
  const [harvestMonth, setHarvestMonth] = useState("8");

  const [plantingDate, setPlantingDate] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [problems, setProblems] = useState("");
  const [irrigation, setIrrigation] = useState("");

  // Result state
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<Comparison | null>(null);
  const [copied, setCopied] = useState(false);

  const previousYearOptions = ["2020", "2021", "2022", "2023", "2024", "2025"];
  const cropDebounce = useRef<number | null>(null);

  // --- Location search (backend geocoding proxy) ---
  async function searchLocation() {
    const q = locationQuery.trim();
    if (q.length < 3) return;
    setLocationStatus("loading");
    setLocationResults([]);
    try {
      const response = await fetch(
        `${API_BASE}/api/locations/search?q=${encodeURIComponent(q)}`,
      );
      if (!response.ok) throw new Error("failed");
      const payload = (await response.json()) as { results: LocationResult[] };
      setLocationResults(payload.results);
      setLocationStatus(payload.results.length === 0 ? "empty" : "idle");
    } catch {
      setLocationStatus("error");
    }
  }

  function chooseLocation(item: LocationResult) {
    setLocation(item);
    setLocationQuery(item.label);
    setLocationResults([]);
    setLocationStatus("idle");
  }

  // --- Crop search (backend ECOCROP catalog) ---
  const runCropSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (q.length < 2) {
      setCropResults([]);
      setCropStatus("idle");
      return;
    }
    setCropStatus("loading");
    try {
      const response = await fetch(
        `${API_BASE}/api/crops/search?q=${encodeURIComponent(q)}&limit=8`,
      );
      if (!response.ok) throw new Error("failed");
      const payload = (await response.json()) as {
        results: CropResult[];
        source?: string;
      };
      setCropResults(payload.results);
      setCropSource(payload.source ?? "");
      setCropStatus(payload.results.length === 0 ? "empty" : "idle");
    } catch {
      setCropResults([]);
      setCropStatus("error");
    }
  }, []);

  useEffect(() => {
    if (cropDebounce.current) window.clearTimeout(cropDebounce.current);
    cropDebounce.current = window.setTimeout(() => {
      void runCropSearch(cropQuery);
    }, 320);
    return () => {
      if (cropDebounce.current) window.clearTimeout(cropDebounce.current);
    };
  }, [cropQuery, runCropSearch]);

  function addCrop(crop: CropResult) {
    setSelectedCrops((current) =>
      current.some((item) => item.scientificName === crop.scientificName)
        ? current
        : [...current, crop],
    );
    setCropQuery("");
    setCropResults([]);
  }

  function removeCrop(scientificName: string) {
    setSelectedCrops((current) =>
      current.filter((item) => item.scientificName !== scientificName),
    );
  }

  // --- Compare (backend does all fetching + analysis) ---
  // Unit conversion happens in the backend, so switching units re-asks for
  // the same comparison rather than reformatting a stale payload.
  async function handleCompare(unitOverride?: Units) {
    if (!location) {
      setStatus("error");
      setErrorMessage("Search for your location and pick a result from the list first.");
      return;
    }
    if (selectedCrops.length === 0) {
      setStatus("error");
      setErrorMessage("Search for and select at least one previous crop.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    setResult(null);
    setCopied(false);

    try {
      const response = await fetch(`${API_BASE}/api/season/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          crops: selectedCrops.map((crop) => ({
            name: crop.name,
            scientificName: crop.scientificName,
          })),
          previousYear: Number.parseInt(previousYear, 10),
          baselineSpan: Number.parseInt(baselineSpan, 10),
          windowStart: Number.parseInt(plantingMonth, 10),
          windowEnd: Number.parseInt(harvestMonth, 10),
          units: unitOverride ?? units,
          fieldContext: { plantingDate, harvestDate, problems, irrigation },
        }),
      });

      const payload = (await response.json()) as Comparison & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Backend request failed (${response.status}).`);
      }
      setResult(payload);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load the comparison. Is the backend running on port 5000?",
      );
    }
  }

  function downloadCsv() {
    if (!result) return;
    const { tempUnit, rainUnit } = result.charts;
    const rows = [
      `Month,Baseline ${result.baseline.label} temp (${tempUnit}),Outlook temp (${tempUnit}),Baseline ${result.baseline.label} rain (${rainUnit}),Outlook rain (${rainUnit})`,
      ...result.charts.temperature.map((point, index) => {
        const rain = result.charts.rainfall[index];
        return `${point.month},${point.baseline ?? "unavailable"},${point.outlook ?? "unavailable"},${rain?.baseline ?? "unavailable"},${rain?.outlook ?? "unavailable"}`;
      }),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `season-comparison-${result.baseline.label}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function copySummary() {
    if (!result) return;
    const lines = [
      `Season comparison — ${result.location.label}`,
      `Baseline: ${result.baseline.label} · Outlook: ${result.outlook.label}`,
      `Growing window: ${result.window.label}`,
      `Temperature shift: ${result.overview.tempShift.display} · Rainfall shift: ${result.overview.rainShift.display}`,
      ...result.verdicts.map((row) => `${row.crop}: ${row.verdict} — ${row.reason}`),
      ...result.challenges.map((row) => `${row.label}: ${row.level} — ${row.detail}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    } catch {
      setCopied(false);
    }
  }

  // Green band shading follows the backend's window months.
  const windowAreas = (() => {
    if (!result || result.window.months.length === 0) return null;
    const sorted = [...result.window.months].sort((a, b) => a - b);
    const areas: { x1: string; x2: string }[] = [];
    let runStart = sorted[0];
    let previous = sorted[0];
    for (const index of sorted.slice(1)) {
      if (index !== previous + 1) {
        areas.push({ x1: MONTHS[runStart], x2: MONTHS[previous] });
        runStart = index;
      }
      previous = index;
    }
    areas.push({ x1: MONTHS[runStart], x2: MONTHS[previous] });
    return areas;
  })();

  return (
    <div>
      <PageIntro
        eyebrow="Learn from each season"
        title="What changed since last season?"
        description="Compare last season's observed conditions with the coming season's outlook, then get a suitability verdict for each crop you grew. Observed history and outlook are always labelled separately."
      />

      <section
        className="mb-6 rounded-2xl border border-[#e7ebe5] bg-white p-4 sm:p-5"
        aria-label="Comparison settings"
      >
        <div className="grid gap-4">
          {/* Location */}
          <div>
            <label htmlFor="season-location" className="mb-1.5 block text-xs font-semibold text-[#42564a]">
              Location
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-[#f9fbf9] px-3 py-2.5">
              <Search size={15} className="shrink-0 text-[#4d6858]" />
              <input
                id="season-location"
                type="text"
                autoComplete="off"
                placeholder="City, region, or address (US)"
                value={locationQuery}
                onChange={(event) => {
                  setLocationQuery(event.target.value);
                  setLocation(null);
                  setLocationResults([]);
                  setLocationStatus("idle");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchLocation();
                  }
                }}
                className="w-full border-0 bg-transparent text-sm text-[#1e2d29] placeholder:text-[#8c9a92] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void searchLocation()}
                disabled={locationStatus === "loading"}
                className="shrink-0 rounded-full bg-[#1b4d35] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {locationStatus === "loading" ? "Searching…" : "Search"}
              </button>
            </div>
            {location ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[#52645a]">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                <span>
                  {location.label}
                  <span className="text-[#7c857e]">
                    {" "}
                    ({location.lat.toFixed(4)}, {location.lon.toFixed(4)})
                  </span>
                </span>
              </p>
            ) : locationResults.length > 0 ? (
              <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl border border-[#dfe8df] bg-white p-1.5 text-xs">
                {locationResults.map((item) => (
                  <button
                    key={`${item.lat}-${item.lon}-${item.label}`}
                    type="button"
                    onClick={() => chooseLocation(item)}
                    className="rounded-lg px-2 py-1.5 text-left text-[#35463a] hover:bg-[#eef4ee]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[#7c857e]">
                {locationStatus === "empty"
                  ? "No matches. Try a nearby city or add the state."
                  : locationStatus === "error"
                    ? "Location search failed. Check that the backend is running."
                    : "Type a location and press Search, then pick a result."}
              </p>
            )}
          </div>

          {/* Crops — searched live in FAO ECOCROP via the backend */}
          <div>
            <label htmlFor="crop-search" className="mb-1.5 block text-xs font-semibold text-[#42564a]">
              Previous crops (search the FAO ECOCROP database)
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-[#f9fbf9] px-3 py-2.5">
              <Search size={15} className="shrink-0 text-[#4d6858]" />
              <input
                id="crop-search"
                type="text"
                autoComplete="off"
                placeholder="Search any crop — e.g. sorghum, tomato, cassava"
                value={cropQuery}
                onChange={(event) => setCropQuery(event.target.value)}
                className="w-full border-0 bg-transparent text-sm text-[#1e2d29] placeholder:text-[#8c9a92] focus:outline-none"
              />
              {cropQuery && (
                <button
                  type="button"
                  onClick={() => setCropQuery("")}
                  aria-label="Clear crop search"
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-[#4a594f] hover:bg-[#eef4ee]"
                >
                  ✕
                </button>
              )}
            </div>

            {selectedCrops.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Selected crops">
                {selectedCrops.map((crop) => (
                  <button
                    key={crop.scientificName}
                    type="button"
                    onClick={() => removeCrop(crop.scientificName)}
                    title={`Remove ${crop.name}`}
                    className="rounded-full border border-[#1d4d31] bg-[#1b4d35] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {crop.name} ✕
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2 text-xs" aria-live="polite">
              {cropStatus === "loading" && (
                <p className="text-[#7c857e]">Searching ECOCROP…</p>
              )}
              {cropStatus === "error" && (
                <p className="text-[#a33c32]">
                  Crop search failed. Check that the backend is running.
                </p>
              )}
              {cropStatus === "empty" && (
                <p className="text-[#7c857e]">
                  No ECOCROP crop matches “{cropQuery.trim()}”.
                </p>
              )}
              {cropResults.length > 0 && (
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border border-[#dfe8df] bg-white p-1.5">
                  {cropResults.map((crop) => (
                    <button
                      key={`${crop.id}-${crop.scientificName}`}
                      type="button"
                      onClick={() => addCrop(crop)}
                      className="rounded-lg px-2 py-1.5 text-left hover:bg-[#eef4ee]"
                    >
                      <span className="font-semibold text-[#1e2d29]">{crop.name}</span>
                      <span className="text-[#7c857e]"> · {crop.scientificName}</span>
                      <span className="block text-[11px] text-[#899289]">
                        Optimum {Math.round(crop.tempOptimalC[0])}–
                        {Math.round(crop.tempOptimalC[1])}°C
                        {crop.rainOptimalMmYear
                          ? ` · ${Math.round(crop.rainOptimalMmYear[0])}–${Math.round(crop.rainOptimalMmYear[1])} mm/yr`
                          : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {cropSource && cropResults.length > 0 && (
                <p className="mt-1 text-[10px] text-[#9aa39a]">Source: {cropSource}</p>
              )}
            </div>
          </div>

          {/* Seasons, baseline, units */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="prev-season" className="mb-1.5 block text-xs font-semibold text-[#42564a]">
                Previous season (observed)
              </label>
              <select
                id="prev-season"
                value={previousYear}
                onChange={(event) => setPreviousYear(event.target.value)}
                className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm text-[#1e2d29]"
              >
                {previousYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year} · observed
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="baseline-span" className="mb-1.5 block text-xs font-semibold text-[#42564a]">
                Baseline
              </label>
              <select
                id="baseline-span"
                value={baselineSpan}
                onChange={(event) => setBaselineSpan(event.target.value)}
                className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm text-[#1e2d29]"
              >
                <option value="1">Single year</option>
                <option value="3">3-year average</option>
                <option value="5">5-year average</option>
              </select>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-[#42564a]">Units</span>
              <div className="flex rounded-xl border border-[#dfe8df] bg-white p-1 text-xs font-semibold" role="group" aria-label="Units">
                {(["imperial", "metric"] as Units[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={units === option}
                    onClick={() => {
                      setUnits(option);
                      if (status === "success" && location && selectedCrops.length > 0) {
                        void handleCompare(option);
                      }
                    }}
                    className={`flex-1 rounded-lg px-3 py-2 transition ${
                      units === option
                        ? "bg-[#1b4d35] text-white"
                        : "text-[#4a594f] hover:bg-[#eef4ee]"
                    }`}
                  >
                    {option === "imperial" ? "°F / in" : "°C / mm"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Growing window */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="planting-month" className="mb-1.5 block text-xs font-semibold text-[#42564a]">
                Growing window starts
              </label>
              <select
                id="planting-month"
                value={plantingMonth}
                onChange={(event) => setPlantingMonth(event.target.value)}
                className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm text-[#1e2d29]"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={String(index)}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="harvest-month" className="mb-1.5 block text-xs font-semibold text-[#42564a]">
                Growing window ends
              </label>
              <select
                id="harvest-month"
                value={harvestMonth}
                onChange={(event) => setHarvestMonth(event.target.value)}
                className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm text-[#1e2d29]"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={String(index)}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="-mt-2 text-[11px] leading-4 text-[#7c857e]">
            Verdicts, challenges, and deltas are scored only over the growing window.
            Forecasts reach ~2 weeks, so the upcoming side is a seasonal outlook
            (ECMWF SEAS5), not a full-season forecast.
          </p>

          <details className="rounded-xl border border-[#dfe8df] bg-[#f9fbf9] px-3 py-3 text-xs text-[#4a5c53]">
            <summary className="cursor-pointer list-none font-semibold">
              Optional field details (planting / harvest / problems / irrigation)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-semibold">Planting date</span>
                <input
                  type="date"
                  value={plantingDate}
                  onChange={(event) => setPlantingDate(event.target.value)}
                  className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-semibold">Harvest date</span>
                <input
                  type="date"
                  value={harvestDate}
                  onChange={(event) => setHarvestDate(event.target.value)}
                  className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-semibold">Past problems</span>
                <input
                  type="text"
                  value={problems}
                  onChange={(event) => setProblems(event.target.value)}
                  placeholder="e.g. late rain, pests"
                  className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 placeholder:text-[#9aa79e]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-semibold">Irrigation</span>
                <select
                  value={irrigation}
                  onChange={(event) => setIrrigation(event.target.value)}
                  className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5"
                >
                  <option value="">Select if applicable</option>
                  <option value="None">None</option>
                  <option value="Drip">Drip</option>
                  <option value="Sprinkler">Sprinkler</option>
                  <option value="Flood">Flood</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCompare()}
              disabled={status === "loading"}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1b4d35] px-6 py-3 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(27,77,53,0.2)] transition hover:bg-[#123d2b] disabled:cursor-wait disabled:opacity-70"
            >
              {status === "loading" ? "Comparing…" : "Compare seasons"}
            </button>
            {result && status === "success" && (
              <>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="rounded-full border border-[#dfe8df] bg-white px-4 py-2.5 text-xs font-semibold text-[#1d4d31] hover:border-[#739a7e]"
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={() => void copySummary()}
                  className="rounded-full border border-[#dfe8df] bg-white px-4 py-2.5 text-xs font-semibold text-[#1d4d31] hover:border-[#739a7e]"
                >
                  {copied ? "Copied!" : "Copy summary"}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {status === "idle" && !result && (
        <div className="rounded-2xl border border-dashed border-[#d8e2d5] bg-[#fbfcf9] px-5 py-10 text-center">
          <p className="font-heading text-sm font-bold text-[#2c3a30]">No comparison yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#7e877e]">
            Search your location and crops, then press “Compare seasons”. The backend
            fetches NASA POWER, Open-Meteo and FAO ECOCROP data. Missing values are shown
            as “unavailable” — never filled in.
          </p>
        </div>
      )}

      {status === "loading" && (
        <div role="status" aria-live="polite" className="rounded-2xl border border-[#e7ebe5] bg-white px-5 py-10 text-center">
          <p className="font-heading text-sm font-bold text-[#2c3a30]">Loading real climate data…</p>
          <p className="mt-2 text-xs text-[#7e877e]">
            The backend is fetching NASA POWER observations, Open-Meteo seasonal outlook
            and FAO ECOCROP crop requirements.
          </p>
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="rounded-2xl border border-[#f0cfc6] bg-[#fdf0ed] px-5 py-6">
          <p className="font-heading text-sm font-bold text-[#a33c32]">Could not load the comparison</p>
          <p className="mt-1.5 text-xs leading-5 text-[#8a4a42]">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void handleCompare()}
            className="mt-3 rounded-full bg-[#a33c32] px-4 py-2 text-xs font-semibold text-white"
          >
            Try again
          </button>
        </div>
      )}

      {result && status === "success" && (
        <div className="space-y-5">
          <SeasonBrief
            key={`${result.generatedAt}-${result.location.label}-${result.units}-${result.window.label}`}
            comparison={result}
          />

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Season overview">
            <div className="rounded-2xl border border-[#e7ebe5] bg-white p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#69806b]">
                <TrendIcon trend={result.overview.tempShift.trend} /> Avg. temperature shift
              </p>
              <p className="mt-2 font-heading text-2xl font-bold text-[#1d4d31]">
                {result.overview.tempShift.display}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[#7e877e]">
                Outlook vs {result.baseline.label}, {result.window.label} window
              </p>
            </div>
            <div className="rounded-2xl border border-[#e7ebe5] bg-white p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#69806b]">
                <TrendIcon trend={result.overview.rainShift.trend} /> Rainfall shift
              </p>
              <p className="mt-2 font-heading text-2xl font-bold text-[#1d4d31]">
                {result.overview.rainShift.display}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[#7e877e]">
                Outlook vs {result.baseline.label}, {result.window.label} window
              </p>
            </div>
            <div className="rounded-2xl border border-[#e7ebe5] bg-white p-4">
              <p className="text-[11px] font-semibold text-[#69806b]">Previous · {result.baseline.label}</p>
              <p className="mt-2 font-heading text-sm font-bold text-[#2c3a30]">Observed history</p>
              <p className="mt-1 text-[11px] leading-4 text-[#7e877e]">
                NASA POWER monthly · {result.baseline.monthsAvailable}/12 months
              </p>
            </div>
            <div className="rounded-2xl border border-[#e7ebe5] bg-white p-4">
              <p className="text-[11px] font-semibold text-[#69806b]">Upcoming season</p>
              <p className="mt-2 font-heading text-sm font-bold text-[#2c3a30]">Seasonal outlook</p>
              <p className="mt-1 text-[11px] leading-4 text-[#7e877e]">
                {result.outlook.windowMonthsAvailable}/{result.outlook.windowMonthsTotal} window
                months · {result.outlook.label}
              </p>
            </div>
          </section>

          {result.extremes && (
            <section className="rounded-2xl border border-[#e7ebe5] bg-white p-4 sm:p-5" aria-label="Last season extremes">
              <p className="text-[10px] font-semibold tracking-[0.15em] text-[#8a9389] uppercase">
                Last season extremes · NASA POWER daily
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#f8faf7] p-3 text-center">
                  <p className="font-heading text-xl font-bold text-[#1d4d31]">
                    {result.extremes.daysAboveThreshold}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-[#7e877e]">
                    days above {result.extremes.thresholdDisplay}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f8faf7] p-3 text-center">
                  <p className="font-heading text-xl font-bold text-[#1d4d31]">
                    {result.extremes.hottestDayDisplay}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-[#7e877e]">
                    hottest day{result.extremes.hottestDate ? ` (${result.extremes.hottestDate})` : ""}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f8faf7] p-3 text-center">
                  <p className="font-heading text-xl font-bold text-[#1d4d31]">
                    {result.extremes.longestDrySpellDays}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-[#7e877e]">longest dry spell (days)</p>
                </div>
              </div>
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-2" aria-label="Seasonal charts">
            <div className="rounded-2xl border border-[#e7ebe5] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.13em] text-[#8a9389] uppercase">Monthly mean</p>
                  <h2 className="mt-1 font-heading text-lg font-bold">Temperature comparison</h2>
                  <p className="mt-1 text-xs text-[#7e877e]">
                    Monthly mean · {result.charts.tempUnit} · green band = {result.window.label}
                  </p>
                </div>
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#e9f2eb] text-[#1d4d31]">
                  <ThermometerSun size={17} />
                </span>
              </div>
              <div className="mt-4 h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.charts.temperature} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e7ebe5" />
                    {windowAreas?.map((area, index) => (
                      <ReferenceArea
                        key={index}
                        x1={area.x1}
                        x2={area.x2}
                        fill="#398253"
                        fillOpacity={0.07}
                        stroke="none"
                      />
                    ))}
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11, fill: "#758075" }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tick={{ fontSize: 11, fill: "#758075" }}
                      tickFormatter={(value: number) => `${value}°`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e7ebe5", fontSize: 12 }}
                      formatter={(value) => [
                        `${typeof value === "number" ? value.toFixed(1) : "unavailable"}${result.charts.tempUnit}`,
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="baseline"
                      name={`${result.baseline.label} observed`}
                      stroke={GREEN_MID}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="outlook"
                      name="Outlook"
                      stroke={GREEN_LIGHT}
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-[11px] text-[#7e877e]">
                Source: NASA POWER (observed {result.baseline.label}) · Open-Meteo seasonal outlook ({result.outlook.label}).
              </p>
              <p className="mt-1 text-xs font-medium leading-5 text-[#2c3a30]">{result.overview.tempSummary}</p>
            </div>

            <div className="rounded-2xl border border-[#e7ebe5] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.13em] text-[#8a9389] uppercase">Monthly total</p>
                  <h2 className="mt-1 font-heading text-lg font-bold">Rainfall comparison</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[#7e877e]">
                    <CalendarDays size={13} /> Monthly total · {result.charts.rainUnit} · green band = {result.window.label}
                  </p>
                </div>
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#e9f2eb] text-[#1d4d31]">
                  <Droplets size={17} />
                </span>
              </div>
              <div className="mt-4 h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.charts.rainfall} margin={{ top: 10, right: 16, left: 8, bottom: 0 }} barGap={4}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e7ebe5" />
                    {windowAreas?.map((area, index) => (
                      <ReferenceArea
                        key={index}
                        x1={area.x1}
                        x2={area.x2}
                        fill="#398253"
                        fillOpacity={0.07}
                        stroke="none"
                      />
                    ))}
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11, fill: "#758075" }} />
                    <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: "#758075" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e7ebe5", fontSize: 12 }}
                      formatter={(value) => [
                        `${typeof value === "number" ? value.toFixed(1) : "unavailable"} ${result.charts.rainUnit}`,
                      ]}
                    />
                    <Bar dataKey="baseline" name={`${result.baseline.label} observed`} fill={GREEN_MID} radius={[4, 4, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="outlook" name="Outlook" fill={GREEN_LIGHT} radius={[4, 4, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-[11px] text-[#7e877e]">
                Source: NASA POWER (observed {result.baseline.label}) · Open-Meteo seasonal outlook ({result.outlook.label}).
              </p>
              <p className="mt-1 text-xs font-medium leading-5 text-[#2c3a30]">{result.overview.rainSummary}</p>
            </div>
          </section>

          <section aria-label="Challenges and climate risks">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-[#8a9389] uppercase">
              Challenges &amp; climate risks · {result.window.label} window
            </p>
            <h2 className="mt-1 font-heading text-xl font-bold">What risks should you watch?</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {result.challenges.map((challenge) => (
                <div key={challenge.key} className="rounded-2xl border border-[#e7ebe5] bg-white p-4">
                  <span className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-bold ${levelStyles(challenge.level)}`}>
                    {challenge.level}
                  </span>
                  <p className="mt-2.5 font-heading text-sm font-bold text-[#2c3a30]">{challenge.label}</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#7e877e]">{challenge.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Crop suitability verdicts">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-[#8a9389] uppercase">
              Crop suitability · most important · {result.window.label} window
            </p>
            <h2 className="mt-1 font-heading text-xl font-bold">Should last season&apos;s crops stay?</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {result.verdicts.map((row) => (
                <article key={row.crop} className="rounded-2xl border border-[#e7ebe5] bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-sm font-bold text-[#2c3a30]">{row.crop}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${verdictStyles(row.verdict)}`}>
                      {row.verdict}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs leading-5 text-[#5f6d60]">{row.reason}</p>
                  {row.requirement && (
                    <p className="mt-2 text-[10px] leading-4 text-[#9aa39a]">
                      ECOCROP optimum {row.requirement.optimalTempRange} · {row.requirement.optimalAnnualRain}
                    </p>
                  )}
                </article>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[#7e877e]">
              Requirements come from the FAO ECOCROP database (optimal temperature and
              annual rainfall per species). Broad guides only — variety and field
              conditions decide.
            </p>
          </section>

          <section aria-label="Recommended actions" className="rounded-2xl bg-[#edf4ea] p-5 sm:p-6">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-[#64816a] uppercase">Recommended actions</p>
            <h2 className="mt-2 font-heading text-xl font-bold tracking-[-0.03em]">What to do next</h2>
            <ul className="mt-3 space-y-2.5">
              {result.recommendations.map((action, index) => (
                <li key={index} className="flex items-start gap-2.5 rounded-xl bg-white/80 p-3 text-xs leading-5 text-[#465248]">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1b4d35] text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  {action}
                </li>
              ))}
            </ul>
          </section>

          <p className="text-[11px] leading-5 text-[#7e877e]">
            Sources — observed: NASA POWER monthly and daily; outlook: Open-Meteo Seasonal
            Forecast API (ECMWF SEAS5 ensemble mean); crop requirements: FAO ECOCROP;
            geocoding: OpenStreetMap Nominatim. Scored over the {result.window.label} growing
            window; missing outlook months are shown as gaps, never filled in. Generated{" "}
            {result.generatedAt} for {result.location.label}.
          </p>
        </div>
      )}
    </div>
  );
}

export default SeasonComparison;
