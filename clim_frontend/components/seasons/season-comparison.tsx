"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ClipboardCopy,
  CloudRain,
  Download,
  MapPin,
  Minus,
  Sprout,
  Sun,
  ThermometerSun,
  Timer,
  Wheat,
  X,
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
import { PageIntro } from "@/components/shared/page-intro";
import { useAppData } from "@/components/providers/app-data-provider";
import { LocationMap } from "@/components/shared/location-map";
import { SearchField } from "@/components/shared/search-field";
import {
  Field,
  HelpText,
  Panel,
  PanelHead,
  Pill,
  ResultItem,
  ResultList,
  Segmented,
  Skeleton,
  SourceNote,
  Spec,
  SpecGrid,
  SowChart,
  StateBlock,
  buttonClass,
  selectClass,
  inputClass,
  type Tone,
} from "@/components/shared/ui-kit";
import {
  ChartLegend,
  axisTick,
  chartInk,
  tooltipLabelStyle,
  tooltipStyle,
} from "@/components/charts/chart-kit";

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

function levelTone(level: string): Tone {
  if (level === "Elevated") return "bad";
  if (level === "Moderate") return "warn";
  if (level === "Low") return "good";
  return "neutral";
}

function verdictTone(verdict: string): Tone {
  if (verdict === "Continue") return "good";
  if (verdict === "Reconsider") return "bad";
  return "warn";
}

function TrendIcon({ trend, size = 15 }: { trend: string; size?: number }) {
  if (trend === "up") return <ArrowUpRight size={size} aria-hidden="true" />;
  if (trend === "down") return <ArrowDownRight size={size} aria-hidden="true" />;
  return <Minus size={size} aria-hidden="true" />;
}

function formatValue(value: unknown, unit: string, spaced = false) {
  return typeof value === "number" ? `${value.toFixed(1)}${spaced ? " " : ""}${unit}` : "unavailable";
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

  // --- Shared workspace location: start from it, and keep it in step ---
  const {
    location: savedLocation,
    coordinates: savedCoordinates,
    setLocation: setSavedLocation,
  } = useAppData();
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || location || !savedLocation || !savedCoordinates) return;
    prefilled.current = true;
    setLocation({ label: savedLocation, lat: savedCoordinates.lat, lon: savedCoordinates.lon });
    setLocationQuery(savedLocation);
  }, [location, savedLocation, savedCoordinates]);

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
    prefilled.current = true;
    setSavedLocation(item.label, { lat: item.lat, lon: item.lon });
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

  // Window band shading follows the backend's window months.
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

  const isLoading = status === "loading";

  return (
    <div>
      <PageIntro
        title="What changed since last season?"
        description="Compare a past season's observed weather with the coming season's outlook, then see whether each crop you grew still fits. Observed history and outlook are always labelled separately."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* ------------------------------------------------ controls */}
        <Panel
          aria-label="Comparison settings"
          className="animate-rise p-5 xl:sticky xl:top-[88px] xl:max-h-[calc(100dvh-112px)] xl:overflow-y-auto"
        >
          <div className="flex flex-col gap-5">
            <Field label="Location" htmlFor="season-location">
              <SearchField
                id="season-location"
                value={locationQuery}
                onChange={(value) => {
                  setLocationQuery(value);
                  setLocation(null);
                  setLocationResults([]);
                  setLocationStatus("idle");
                }}
                onSubmit={() => void searchLocation()}
                loading={locationStatus === "loading"}
                placeholder="City, parish or address"
              />
              {location ? (
                <HelpText tone="good" className="flex items-start gap-1.5">
                  <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    Using {location.label}
                    <span className="tabular text-ink-mute">
                      {" "}
                      ({location.lat.toFixed(4)}, {location.lon.toFixed(4)})
                    </span>
                  </span>
                </HelpText>
              ) : locationResults.length > 0 ? (
                <ResultList label="Matching locations">
                  {locationResults.map((item) => (
                    <ResultItem
                      key={`${item.lat}-${item.lon}-${item.label}`}
                      onSelect={() => chooseLocation(item)}
                      primary={item.label}
                    />
                  ))}
                </ResultList>
              ) : (
                <HelpText tone={locationStatus === "error" ? "error" : "mute"}>
                  {locationStatus === "empty"
                    ? "No matches. Try a nearby city or add the state."
                    : locationStatus === "error"
                      ? "Location search failed. Check that the backend is running."
                      : "Type a location and press Search, then pick a result."}
                </HelpText>
              )}
            </Field>

            <Field label="Crops you grew" htmlFor="crop-search">
              <SearchField
                id="crop-search"
                value={cropQuery}
                onChange={setCropQuery}
                onClear={() => setCropQuery("")}
                loading={cropStatus === "loading"}
                placeholder="Search FAO ECOCROP: sorghum, tomato…"
              />
              {selectedCrops.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-2" aria-label="Selected crops">
                  {selectedCrops.map((crop) => (
                    <li key={crop.scientificName}>
                      <button
                        type="button"
                        onClick={() => removeCrop(crop.scientificName)}
                        aria-label={`Remove ${crop.name}`}
                        className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-forest pr-2.5 pl-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-forest-deep"
                      >
                        {crop.name}
                        <X size={14} className="opacity-70 group-hover:opacity-100" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div aria-live="polite">
                {cropStatus === "loading" && <HelpText>Searching ECOCROP…</HelpText>}
                {cropStatus === "error" && (
                  <HelpText tone="error">Crop search failed. Check that the backend is running.</HelpText>
                )}
                {cropStatus === "empty" && (
                  <HelpText>No ECOCROP crop matches “{cropQuery.trim()}”.</HelpText>
                )}
                {cropResults.length > 0 && (
                  <ResultList label="Matching crops">
                    {cropResults.map((crop) => (
                      <ResultItem
                        key={`${crop.id}-${crop.scientificName}`}
                        onSelect={() => addCrop(crop)}
                        primary={crop.name}
                        secondary={<em>{crop.scientificName}</em>}
                        meta={
                          <>
                            Optimum {Math.round(crop.tempOptimalC[0])}–{Math.round(crop.tempOptimalC[1])}°C
                            {crop.rainOptimalMmYear
                              ? ` · ${Math.round(crop.rainOptimalMmYear[0])}–${Math.round(crop.rainOptimalMmYear[1])} mm/yr`
                              : ""}
                          </>
                        }
                      />
                    ))}
                  </ResultList>
                )}
                {cropSource && cropResults.length > 0 && (
                  <SourceNote className="mt-1.5">Source: {cropSource}</SourceNote>
                )}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Past season" htmlFor="prev-season">
                <select
                  id="prev-season"
                  value={previousYear}
                  onChange={(event) => setPreviousYear(event.target.value)}
                  className={selectClass}
                >
                  {previousYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year} · observed
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Baseline" htmlFor="baseline-span">
                <select
                  id="baseline-span"
                  value={baselineSpan}
                  onChange={(event) => setBaselineSpan(event.target.value)}
                  className={selectClass}
                >
                  <option value="1">Single year</option>
                  <option value="3">3-year average</option>
                  <option value="5">5-year average</option>
                </select>
              </Field>
              <Field label="Window starts" htmlFor="planting-month">
                <select
                  id="planting-month"
                  value={plantingMonth}
                  onChange={(event) => setPlantingMonth(event.target.value)}
                  className={selectClass}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={String(index)}>
                      {month}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Window ends" htmlFor="harvest-month">
                <select
                  id="harvest-month"
                  value={harvestMonth}
                  onChange={(event) => setHarvestMonth(event.target.value)}
                  className={selectClass}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={String(index)}>
                      {month}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-ink-soft" id="units-label">
                Units
              </p>
              <Segmented<Units>
                ariaLabel="Units"
                className="w-full"
                value={units}
                options={[
                  { value: "imperial", label: "°F / in" },
                  { value: "metric", label: "°C / mm" },
                ]}
                onChange={(option) => {
                  setUnits(option);
                  if (status === "success" && location && selectedCrops.length > 0) {
                    void handleCompare(option);
                  }
                }}
              />
              <HelpText>
                Verdicts, risks and shifts are scored only over the growing window. The upcoming side
                is a seasonal outlook (ECMWF SEAS5), not a day-by-day forecast.
              </HelpText>
            </div>

            <details className="group rounded-[12px] border border-line bg-paper px-4 py-3">
              <summary className="cursor-pointer list-none text-[13.5px] font-semibold text-ink-soft marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  Optional field details
                  <span className="text-[12.5px] font-normal text-ink-mute group-open:hidden">
                    Dates, problems, irrigation
                  </span>
                </span>
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Planting date" htmlFor="field-planting-date">
                  <input
                    id="field-planting-date"
                    type="date"
                    value={plantingDate}
                    onChange={(event) => setPlantingDate(event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Harvest date" htmlFor="field-harvest-date">
                  <input
                    id="field-harvest-date"
                    type="date"
                    value={harvestDate}
                    onChange={(event) => setHarvestDate(event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Past problems" htmlFor="field-problems">
                  <input
                    id="field-problems"
                    type="text"
                    value={problems}
                    onChange={(event) => setProblems(event.target.value)}
                    placeholder="e.g. late rain, pests"
                    className={inputClass}
                  />
                </Field>
                <Field label="Irrigation" htmlFor="field-irrigation">
                  <select
                    id="field-irrigation"
                    value={irrigation}
                    onChange={(event) => setIrrigation(event.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select if applicable</option>
                    <option value="None">None</option>
                    <option value="Drip">Drip</option>
                    <option value="Sprinkler">Sprinkler</option>
                    <option value="Flood">Flood</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
              </div>
            </details>

            <button
              type="button"
              onClick={() => void handleCompare()}
              disabled={isLoading}
              className={buttonClass({ size: "lg", className: "w-full" })}
            >
              {isLoading ? "Comparing seasons…" : "Compare seasons"}
            </button>
          </div>
        </Panel>

        {/* ------------------------------------------------ readout */}
        <div className="min-w-0 space-y-6">
          {status === "idle" && !result && (
            <StateBlock kind="empty" icon={Wheat} title="No comparison yet" className="animate-rise">
              Pick a location and the crops you grew, then press Compare seasons. The backend pulls
              NASA POWER history, the Open-Meteo seasonal outlook and FAO ECOCROP requirements.
              Missing values stay marked “unavailable” and are never filled in.
            </StateBlock>
          )}

          {isLoading && <ReadoutSkeleton />}

          {status === "error" && (
            <StateBlock
              kind="error"
              title="Could not load the comparison"
              action={
                <button
                  type="button"
                  onClick={() => void handleCompare()}
                  className={buttonClass({ variant: "danger", size: "sm" })}
                >
                  Try again
                </button>
              }
            >
              {errorMessage}
            </StateBlock>
          )}

          {result && status === "success" && (
            <>
              <Panel tone="readout" className="animate-rise" aria-labelledby="season-readout-heading">
                <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2
                          id="season-readout-heading"
                          className="font-display text-[24px] leading-[1.15] text-ink"
                        >
                          {result.location.label.split(",").slice(0, 2).join(",")}
                        </h2>
                        <p className="mt-1.5 text-[14px] text-ink-mute">
                          {result.baseline.label} observed vs {result.outlook.label} · growing
                          window {result.window.label}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={downloadCsv}
                          className={buttonClass({ variant: "secondary", size: "sm" })}
                        >
                          <Download size={15} aria-hidden="true" /> CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => void copySummary()}
                          className={buttonClass({ variant: "secondary", size: "sm" })}
                          aria-live="polite"
                        >
                          {copied ? (
                            <>
                              <Check size={15} aria-hidden="true" /> Copied
                            </>
                          ) : (
                            <>
                              <ClipboardCopy size={15} aria-hidden="true" /> Copy summary
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                    <SpecGrid columns={2}>
                      <Spec
                        label="Temperature shift"
                        icon={ThermometerSun}
                        tone="clay"
                        value={
                          <span className="inline-flex items-center gap-1">
                            {result.overview.tempShift.display}
                            <TrendIcon trend={result.overview.tempShift.trend} size={18} />
                          </span>
                        }
                        note={`Outlook vs ${result.baseline.label}`}
                      />
                      <Spec
                        label="Rainfall shift"
                        icon={CloudRain}
                        tone="sow"
                        value={
                          <span className="inline-flex items-center gap-1">
                            {result.overview.rainShift.display}
                            <TrendIcon trend={result.overview.rainShift.trend} size={18} />
                          </span>
                        }
                        note={`Outlook vs ${result.baseline.label}`}
                      />
                      <Spec
                        label="Observed history"
                        value={`${result.baseline.monthsAvailable}/12`}
                        note={`NASA POWER months · ${result.baseline.label}`}
                      />
                      <Spec
                        label="Outlook coverage"
                        tone="marigold"
                        value={`${result.outlook.windowMonthsAvailable}/${result.outlook.windowMonthsTotal}`}
                        note={`${result.window.label} months with outlook data`}
                      />
                    </SpecGrid>
                    <LocationMap
                      lat={result.location.lat}
                      lon={result.location.lon}
                      label={result.location.label}
                      className="min-h-[240px]"
                    />
                    </div>

                    <SowChart
                      className="mt-6"
                      title="Growing window"
                      legend={{ window: `Scored months (${result.window.label})`, off: "Outside window" }}
                      months={MONTHS.map((month, index) => {
                        const temp = result.charts.temperature[index];
                        const rain = result.charts.rainfall[index];
                        return {
                          state: result.window.months.includes(index) ? "window" : "off",
                          detail: temp
                            ? `observed ${formatValue(temp.baseline, result.charts.tempUnit)}, outlook ${formatValue(temp.outlook, result.charts.tempUnit)}; rain observed ${formatValue(rain?.baseline, result.charts.rainUnit, true)}`
                            : undefined,
                        };
                      })}
                    />
                </div>
              </Panel>

              <Panel className="p-5 sm:p-6" aria-labelledby="verdicts-heading">
                <PanelHead
                  id="verdicts-heading"
                  icon={Sprout}
                  title="Should last season’s crops stay?"
                  description={`Scored over the ${result.window.label} window against each crop’s FAO ECOCROP optimum. Broad guides only; variety and field conditions decide.`}
                />
                <ul className="mt-4 divide-y divide-line-soft">
                  {result.verdicts.map((row) => (
                    <li key={row.crop} className="grid gap-2 py-4 first:pt-1 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
                      <div>
                        <p className="font-display text-[18px] leading-tight text-ink">{row.crop}</p>
                        <Pill tone={verdictTone(row.verdict)} className="mt-2">
                          {row.verdict}
                        </Pill>
                      </div>
                      <div>
                        <p className="text-[14.5px] leading-[1.6] text-ink-soft">{row.reason}</p>
                        {row.requirement && (
                          <SourceNote className="mt-1.5">
                            ECOCROP optimum for <em>{row.requirement.scientificName}</em>:{" "}
                            {row.requirement.optimalTempRange} · {row.requirement.optimalAnnualRain}
                          </SourceNote>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <section className="grid gap-6 2xl:grid-cols-2" aria-label="Seasonal charts">
                <Panel className="p-5 sm:p-6" aria-labelledby="temp-chart-heading">
                  <PanelHead
                    id="temp-chart-heading"
                    icon={ThermometerSun}
                    title="Temperature"
                    description={result.overview.tempSummary}
                  />
                  <ChartLegend
                    className="mt-4"
                    items={[
                      { label: `${result.baseline.label} observed`, color: chartInk.heat },
                      { label: "Outlook", color: chartInk.outlook, kind: "dashed" },
                      { label: "Growing window", color: chartInk.band, kind: "band" },
                    ]}
                  />
                  <div className="mt-3 h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.charts.temperature} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={chartInk.grid} />
                        {windowAreas?.map((area, index) => (
                          <ReferenceArea
                            key={index}
                            x1={area.x1}
                            x2={area.x2}
                            fill={chartInk.band}
                            fillOpacity={0.08}
                            stroke="none"
                          />
                        ))}
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} tick={axisTick} />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={44}
                          tick={axisTick}
                          domain={["auto", "auto"]}
                          tickFormatter={(value: number) => `${value}°`}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelStyle={tooltipLabelStyle}
                          formatter={(value, name) => [
                            `${typeof value === "number" ? value.toFixed(1) : "unavailable"}${result.charts.tempUnit}`,
                            name,
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="baseline"
                          name={`${result.baseline.label} observed`}
                          stroke={chartInk.heat}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="outlook"
                          name="Outlook"
                          stroke={chartInk.outlook}
                          strokeWidth={2.5}
                          strokeDasharray="6 4"
                          dot={{ r: 3, fill: chartInk.outlook }}
                          activeDot={{ r: 4 }}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <ChartFootnote result={result} />
                </Panel>

                <Panel className="p-5 sm:p-6" aria-labelledby="rain-chart-heading">
                  <PanelHead
                    id="rain-chart-heading"
                    icon={CloudRain}
                    title="Rainfall"
                    description={result.overview.rainSummary}
                  />
                  <ChartLegend
                    className="mt-4"
                    items={[
                      { label: `${result.baseline.label} observed`, color: chartInk.rain, kind: "bar" },
                      { label: "Outlook", color: chartInk.outlook, kind: "bar" },
                      { label: "Growing window", color: chartInk.band, kind: "band" },
                    ]}
                  />
                  <div className="mt-3 h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.charts.rainfall} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={3}>
                        <CartesianGrid vertical={false} stroke={chartInk.grid} />
                        {windowAreas?.map((area, index) => (
                          <ReferenceArea
                            key={index}
                            x1={area.x1}
                            x2={area.x2}
                            fill={chartInk.band}
                            fillOpacity={0.08}
                            stroke="none"
                          />
                        ))}
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} tick={axisTick} />
                        <YAxis tickLine={false} axisLine={false} width={44} tick={axisTick} />
                        <Tooltip
                          cursor={{ fill: "rgb(30 74 48 / 0.06)" }}
                          contentStyle={tooltipStyle}
                          labelStyle={tooltipLabelStyle}
                          formatter={(value, name) => [
                            `${typeof value === "number" ? value.toFixed(1) : "unavailable"} ${result.charts.rainUnit}`,
                            name,
                          ]}
                        />
                        <Bar dataKey="baseline" name={`${result.baseline.label} observed`} fill={chartInk.rain} radius={[3, 3, 0, 0]} maxBarSize={14} />
                        <Bar dataKey="outlook" name="Outlook" fill={chartInk.outlook} radius={[3, 3, 0, 0]} maxBarSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ChartFootnote result={result} />
                </Panel>
              </section>

              {result.extremes && (
                <Panel className="p-5 sm:p-6" aria-labelledby="extremes-heading">
                  <PanelHead
                    id="extremes-heading"
                    icon={Sun}
                    title="Last season’s extremes"
                    description="Daily NASA POWER observations for the observed season."
                  />
                  <SpecGrid columns={3} className="mt-4">
                    <Spec
                      label={`Days above ${result.extremes.thresholdDisplay}`}
                      icon={ThermometerSun}
                      tone="clay"
                      value={result.extremes.daysAboveThreshold}
                    />
                    <Spec
                      label="Hottest day"
                      icon={Sun}
                      tone="clay"
                      value={result.extremes.hottestDayDisplay}
                      note={result.extremes.hottestDate ?? undefined}
                    />
                    <Spec
                      label="Longest dry spell"
                      icon={Timer}
                      tone="sow"
                      value={`${result.extremes.longestDrySpellDays} days`}
                    />
                  </SpecGrid>
                </Panel>
              )}

              <Panel className="overflow-hidden" aria-labelledby="risks-heading">
                <div className="p-5 pb-4 sm:p-6 sm:pb-4">
                  <PanelHead
                    id="risks-heading"
                    icon={ThermometerSun}
                    title="Risks to watch"
                    description={`Climate challenges over the ${result.window.label} window.`}
                  />
                </div>
                <table className="w-full border-t border-line text-left">
                  <thead className="hidden bg-paper text-[12.5px] text-ink-mute sm:table-header-group">
                    <tr>
                      <th scope="col" className="w-[26%] px-6 py-2.5 font-semibold">Risk</th>
                      <th scope="col" className="w-[16%] px-3 py-2.5 font-semibold">Level</th>
                      <th scope="col" className="px-6 py-2.5 font-semibold">What the data shows</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {result.challenges.map((challenge) => (
                      <tr key={challenge.key} className="block px-5 py-4 sm:table-row sm:p-0">
                        <th scope="row" className="block font-heading text-[15px] font-bold text-ink sm:table-cell sm:px-6 sm:py-4">
                          {challenge.label}
                        </th>
                        <td className="mt-1.5 block sm:table-cell sm:px-3 sm:py-4">
                          <Pill tone={levelTone(challenge.level)}>{challenge.level}</Pill>
                        </td>
                        <td className="mt-2 block text-[14px] leading-[1.55] text-ink-soft sm:table-cell sm:px-6 sm:py-4">
                          {challenge.detail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              <Panel tone="quiet" className="border border-forest/10 bg-forest-tint/60 p-5 sm:p-6" aria-labelledby="next-heading">
                <h2 id="next-heading" className="font-heading text-[17px] font-bold text-ink">
                  What to do next
                </h2>
                <ol className="mt-3 space-y-2.5">
                  {result.recommendations.map((action, index) => (
                    <li key={index} className="flex items-start gap-3 rounded-[10px] bg-panel px-4 py-3 text-[14.5px] leading-[1.55] text-ink-soft">
                      <span className="tabular mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-[12px] font-bold text-white">
                        {index + 1}
                      </span>
                      {action}
                    </li>
                  ))}
                </ol>
              </Panel>

              <SourceNote>
                Sources: observed, NASA POWER monthly and daily; outlook, Open-Meteo Seasonal Forecast
                API (ECMWF SEAS5 ensemble mean); crop requirements, FAO ECOCROP; geocoding,
                OpenStreetMap Nominatim. Scored over the {result.window.label} growing window;
                missing outlook months are shown as gaps, never filled in. Generated{" "}
                {result.generatedAt} for {result.location.label}.
              </SourceNote>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartFootnote({ result }: { result: Comparison }) {
  return (
    <SourceNote className="mt-3">
      NASA POWER (observed {result.baseline.label}) · Open-Meteo seasonal outlook ({result.outlook.label}
      {result.outlook.range ? `, ${result.outlook.range.start} → ${result.outlook.range.end}` : ", range unavailable"}).
      Months outside the outlook horizon show the observed baseline only.
    </SourceNote>
  );
}

/** Same footprint as the readout, so the answer lands without a layout jump. */
function ReadoutSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">
        Loading real climate data: NASA POWER observations, Open-Meteo seasonal outlook and FAO
        ECOCROP crop requirements.
      </span>
      <Panel tone="readout" className="overflow-hidden">
        <div className="p-5 sm:p-6">
          <Skeleton className="h-7 w-2/5" />
          <Skeleton className="mt-2.5 h-4 w-3/5" />
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-[110px]" />
              ))}
            </div>
            <Skeleton className="min-h-[240px]" />
          </div>
          <Skeleton className="mt-6 h-[74px]" />
        </div>
      </Panel>
      <p className="text-[13.5px] text-ink-mute">
        Fetching NASA POWER observations, the Open-Meteo seasonal outlook and FAO ECOCROP
        requirements. This usually takes a few seconds.
      </p>
      <Skeleton className="h-[220px]" />
    </div>
  );
}

export default SeasonComparison;
