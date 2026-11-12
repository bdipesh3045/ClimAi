"use client";

import { useEffect, useRef, useState } from "react";
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
import { CalendarDays, CloudRain, CloudSun, Info, MapPin, ThermometerSun, X } from "lucide-react";
import { PageIntro } from "@/components/shared/page-intro";
import { PlantingBrief } from "@/components/weather/planting-brief";
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
  SowChart,
  Spec,
  SpecGrid,
  StateBlock,
  buttonClass,
  selectClass,
  type SowState,
} from "@/components/shared/ui-kit";
import {
  ChartLegend,
  axisTick,
  chartInk,
  tooltipLabelStyle,
  tooltipStyle,
} from "@/components/charts/chart-kit";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Planting & weather — presentation only.
// Location search, crop search (FAO ECOCROP) and the planting window itself are
// all served by the Flask backend. The window is derived from NASA POWER
// monthly normals against the crop's ECOCROP optimum; nothing here is sampled.
// ---------------------------------------------------------------------------

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

type Units = "imperial" | "metric";
type LocationResult = { label: string; lat: number; lon: number };
type CropResult = {
  id: string;
  name: string;
  scientificName: string;
  tempOptimalC: [number, number];
  rainOptimalMmYear: [number, number] | null;
};
type MonthRow = {
  index: number;
  month: string;
  tempSuitable: boolean;
  tempDisplay: string;
  rainDisplay: string;
  temp: number | null;
  rain: number | null;
  inWindow: boolean;
};
type Point = { month: string; value: number | null };
type Plan = {
  generatedAt: string;
  location: LocationResult;
  units: Units;
  crop: {
    name: string;
    scientificName: string;
    lifeForm: string | null;
    tempOptimal: string;
    rainOptimal: string;
  };
  baseline: { years: number[]; label: string; monthsAvailable: number };
  window: {
    start: number | null;
    end: number | null;
    label: string;
    months: number[];
    monthNames: string[];
  };
  suitability: { suitableMonths: number; verdict: string; summary: string };
  rainfall: {
    annual: string;
    annualValue: number | null;
    withinOptimal: boolean | null;
    summary: string;
  };
  months: MonthRow[];
  charts: {
    temperature: Array<Point & { optimalLow: number; optimalHigh: number }>;
    rainfall: Point[];
    tempUnit: string;
    rainUnit: string;
  };
  notes: string[];
  sources: { observed: string; requirements: string; geocoding: string };
};

type LookupStatus = "idle" | "loading" | "done" | "empty" | "error" | "short";

function sowState(month: MonthRow): SowState {
  if (month.temp === null) return "unknown";
  if (month.inWindow) return "window";
  if (month.tempSuitable) return "suitable";
  return "off";
}

export function PlantingWeather() {
  const [locationQuery, setLocationQuery] = useState("");
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationStatus, setLocationStatus] = useState<LookupStatus>("idle");

  const [cropQuery, setCropQuery] = useState("");
  const [crop, setCrop] = useState<CropResult | null>(null);
  const [cropResults, setCropResults] = useState<CropResult[]>([]);
  const [cropStatus, setCropStatus] = useState<LookupStatus>("idle");

  const [baselineSpan, setBaselineSpan] = useState(3);
  const [units, setUnits] = useState<Units>("imperial");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<Plan | null>(null);

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

  async function searchLocation() {
    const query = locationQuery.trim();
    if (query.length < 3) {
      setLocationStatus("short");
      return;
    }
    setLocationStatus("loading");
    setLocation(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/locations/search?q=${encodeURIComponent(query)}`,
      );
      const payload = (await response.json()) as {
        results?: LocationResult[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Location search failed.");
      setLocationResults(payload.results ?? []);
      setLocationStatus((payload.results ?? []).length ? "done" : "empty");
    } catch {
      setLocationStatus("error");
    }
  }

  // Crop search is debounced; it hits the ECOCROP catalog through the backend.
  useEffect(() => {
    const query = cropQuery.trim();
    if (query.length < 2) {
      setCropResults([]);
      setCropStatus("idle");
      return;
    }
    setCropStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/crops/search?q=${encodeURIComponent(query)}&limit=8`,
        );
        const payload = (await response.json()) as {
          results?: CropResult[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Crop search failed.");
        setCropResults(payload.results ?? []);
        setCropStatus((payload.results ?? []).length ? "done" : "empty");
      } catch {
        setCropStatus("error");
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [cropQuery]);

  function chooseLocation(item: LocationResult) {
    setLocation(item);
    setLocationQuery(item.label);
    setLocationResults([]);
    setLocationStatus("idle");
    prefilled.current = true;
    setSavedLocation(item.label, { lat: item.lat, lon: item.lon });
  }

  function chooseCrop(item: CropResult) {
    setCrop(item);
    setCropQuery("");
    setCropResults([]);
    setCropStatus("idle");
  }

  async function fetchPlan(unitOverride?: Units) {
    if (!location) {
      setStatus("error");
      setErrorMessage("Search a location and pick a result from the list first.");
      return;
    }
    if (!crop) {
      setStatus("error");
      setErrorMessage("Search a crop and pick a result from the list first.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/planting/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          crop: { name: crop.name, scientificName: crop.scientificName },
          baselineSpan,
          units: unitOverride ?? units,
        }),
      });
      const payload = (await response.json()) as Plan & { error?: string };
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
          : "Could not load the planting window. Is the backend running on port 5000?",
      );
    }
  }

  function changeUnits(next: Units) {
    if (next === units) return;
    setUnits(next);
    if (result) void fetchPlan(next);
  }

  const isLoading = status === "loading";

  return (
    <div>
      <PageIntro
        title="When should this crop go in the ground?"
        description="Pick a location and a crop. The planting window is derived from NASA POWER monthly normals checked against the crop’s FAO ECOCROP optimum. No sample data."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* ------------------------------------------------ controls */}
        <Panel
          aria-label="Planting search"
          className="animate-rise p-5 xl:sticky xl:top-[88px] xl:max-h-[calc(100dvh-112px)] xl:overflow-y-auto"
        >
          <div className="flex flex-col gap-5">
            <Field label="Location" htmlFor="planting-location">
              <SearchField
                id="planting-location"
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
                    : locationStatus === "short"
                      ? "Enter at least 3 characters."
                      : locationStatus === "error"
                        ? "Location search failed. Check that the backend is running."
                        : "Type a location and press Search, then pick a result."}
                </HelpText>
              )}
            </Field>

            <Field label="Crop" htmlFor="crop-search">
              <SearchField
                id="crop-search"
                value={cropQuery}
                onChange={setCropQuery}
                onClear={() => setCropQuery("")}
                loading={cropStatus === "loading"}
                placeholder="Search FAO ECOCROP: rice, maize, cotton…"
              />
              {crop && (
                <div className="mt-2.5" aria-label="Selected crop">
                  <button
                    type="button"
                    onClick={() => setCrop(null)}
                    aria-label={`Remove ${crop.name}`}
                    className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-forest pr-2.5 pl-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-forest-deep"
                  >
                    {crop.name}
                    <X size={14} className="opacity-70 group-hover:opacity-100" aria-hidden="true" />
                  </button>
                </div>
              )}
              <div aria-live="polite">
                {cropStatus === "loading" && <HelpText>Searching ECOCROP…</HelpText>}
                {cropStatus === "error" && (
                  <HelpText tone="error">Crop search failed. Check that the backend is running.</HelpText>
                )}
                {cropStatus === "empty" && <HelpText>No crops match that name.</HelpText>}
                {cropStatus === "done" && cropResults.length > 0 && (
                  <ResultList label="Matching crops">
                    {cropResults.map((item) => (
                      <ResultItem
                        key={item.id}
                        onSelect={() => chooseCrop(item)}
                        primary={item.name}
                        secondary={<em>{item.scientificName}</em>}
                        meta={
                          <>
                            ECOCROP optimum {item.tempOptimalC[0]}–{item.tempOptimalC[1]}°C
                            {item.rainOptimalMmYear
                              ? ` · ${item.rainOptimalMmYear[0]}–${item.rainOptimalMmYear[1]} mm/yr`
                              : ""}
                          </>
                        }
                      />
                    ))}
                  </ResultList>
                )}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Climate baseline" htmlFor="planting-baseline">
                <select
                  id="planting-baseline"
                  value={baselineSpan}
                  onChange={(event) => setBaselineSpan(Number(event.target.value))}
                  className={selectClass}
                >
                  <option value={1}>Last year</option>
                  <option value={3}>Last 3 years</option>
                  <option value={5}>Last 5 years</option>
                </select>
              </Field>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Units</p>
                <Segmented<Units>
                  ariaLabel="Units"
                  className="w-full"
                  value={units}
                  onChange={changeUnits}
                  options={[
                    { value: "imperial", label: "°F / in" },
                    { value: "metric", label: "°C / mm" },
                  ]}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void fetchPlan()}
              disabled={isLoading}
              className={buttonClass({ size: "lg", className: "w-full" })}
            >
              {isLoading ? "Fetching climate data…" : "Find planting window"}
            </button>
          </div>
        </Panel>

        {/* ------------------------------------------------ readout */}
        <div className="min-w-0 space-y-6">
          {status === "idle" && (
            <StateBlock kind="empty" icon={CloudSun} title="No planting window yet" className="animate-rise">
              Choose a location and a crop, then press Find planting window. You will get a month-by-month
              sowing chart, the crop’s ECOCROP ranges and the local climate normals behind them.
            </StateBlock>
          )}

          {isLoading && (
            <div role="status" aria-live="polite" className="space-y-6">
              <span className="sr-only">Fetching NASA POWER climate normals and ECOCROP requirements.</span>
              <Panel tone="readout" className="p-5 sm:p-6">
                <Skeleton className="h-7 w-1/3" />
                <Skeleton className="mt-2.5 h-4 w-1/2" />
                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map((index) => (
                      <Skeleton key={index} className="h-[104px]" />
                    ))}
                  </div>
                  <Skeleton className="min-h-[224px]" />
                </div>
                <Skeleton className="mt-6 h-[80px]" />
              </Panel>
              <p className="text-[13.5px] text-ink-mute">
                Fetching NASA POWER monthly normals and the crop’s ECOCROP ranges…
              </p>
            </div>
          )}

          {status === "error" && (
            <StateBlock
              kind="error"
              title="Could not build the planting window"
              action={
                <button
                  type="button"
                  onClick={() => void fetchPlan()}
                  className={buttonClass({ variant: "danger", size: "sm" })}
                >
                  Try again
                </button>
              }
            >
              {errorMessage}
            </StateBlock>
          )}

          {status === "success" && result && (
            <>
              <Panel tone="readout" className="animate-rise p-5 sm:p-6" aria-labelledby="plan-heading">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="plan-heading" className="font-display text-[28px] leading-[1.1] text-ink">
                      {result.crop.name}
                    </h2>
                    <p className="mt-1.5 text-[14px] text-ink-mute">
                      <em>{result.crop.scientificName}</em>
                      {result.crop.lifeForm ? ` · ${result.crop.lifeForm}` : ""} ·{" "}
                      {result.location.label.split(",").slice(0, 2).join(",")}
                    </p>
                  </div>
                  <Pill tone={result.window.months.length > 0 ? "good" : "warn"} className="py-1.5 text-[13px] whitespace-normal">
                    {result.suitability.verdict}
                  </Pill>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                  <SpecGrid columns={2}>
                    <Spec
                      label="Planting window"
                      icon={CalendarDays}
                      tone="forest"
                      value={result.window.label}
                      note={`${result.window.monthNames.length} month${result.window.monthNames.length === 1 ? "" : "s"}`}
                    />
                    <Spec
                      label="Suitable months"
                      icon={ThermometerSun}
                      value={`${result.suitability.suitableMonths} of 12`}
                      note="Mean temperature inside the ECOCROP optimum"
                    />
                    <Spec
                      label="Annual rainfall"
                      icon={CloudRain}
                      tone="sow"
                      value={result.rainfall.annual}
                      note={`ECOCROP ${result.crop.rainOptimal}`}
                    />
                    <Spec
                      label="Optimal temperature"
                      icon={ThermometerSun}
                      tone="clay"
                      value={result.crop.tempOptimal}
                      note="ECOCROP growing range"
                    />
                  </SpecGrid>
                  <LocationMap
                    lat={result.location.lat}
                    lon={result.location.lon}
                    label={result.location.label}
                    className="min-h-[224px]"
                  />
                </div>

                <SowChart
                  className="mt-6"
                  legend={{
                    window: "Planting window",
                    suitable: "Temperature suitable",
                    off: "Outside range",
                    ...(result.months.some((month) => month.temp === null)
                      ? { unknown: "No data" }
                      : {}),
                  }}
                  months={result.months.map((month) => ({
                    state: sowState(month),
                    detail: `${month.tempDisplay}, ${month.rainDisplay}`,
                  }))}
                />

                <div className="mt-5 grid gap-3 border-t border-line-soft pt-4 text-[14.5px] leading-[1.6] text-ink-soft md:grid-cols-2">
                  <p>{result.suitability.summary}</p>
                  <p>{result.rainfall.summary}</p>
                </div>
              </Panel>

              <section className="grid gap-6 2xl:grid-cols-2" aria-label="Climate normals">
                <Panel className="p-5 sm:p-6" aria-labelledby="plan-temp-heading">
                  <PanelHead
                    id="plan-temp-heading"
                    icon={ThermometerSun}
                    title="Monthly mean temperature"
                    description={`${result.baseline.label} normals against the ECOCROP optimum (${result.crop.tempOptimal}).`}
                  />
                  <ChartLegend
                    className="mt-4"
                    items={[
                      { label: "Mean temperature", color: chartInk.heat },
                      { label: "ECOCROP optimum", color: chartInk.band, kind: "band" },
                    ]}
                  />
                  <div className="mt-3 h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.charts.temperature} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={chartInk.grid} vertical={false} />
                        {result.charts.temperature[0] && (
                          <ReferenceArea
                            y1={result.charts.temperature[0].optimalLow}
                            y2={result.charts.temperature[0].optimalHigh}
                            fill={chartInk.band}
                            fillOpacity={0.12}
                            stroke="none"
                            ifOverflow="extendDomain"
                          />
                        )}
                        <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} tickMargin={10} />
                        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} domain={["auto", "auto"]} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelStyle={tooltipLabelStyle}
                          formatter={(value) => [`${value} ${result.charts.tempUnit}`, "Mean"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={chartInk.heat}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: chartInk.heat }}
                          activeDot={{ r: 4.5 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="p-5 sm:p-6" aria-labelledby="plan-rain-heading">
                  <PanelHead
                    id="plan-rain-heading"
                    icon={CloudRain}
                    title="Monthly rainfall"
                    description={`Monthly totals from the same ${result.baseline.label} normals.`}
                  />
                  <ChartLegend
                    className="mt-4"
                    items={[{ label: `Rainfall (${result.charts.rainUnit})`, color: chartInk.rain, kind: "bar" }]}
                  />
                  <div className="mt-3 h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.charts.rainfall} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={chartInk.grid} vertical={false} />
                        <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} tickMargin={10} />
                        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} />
                        <Tooltip
                          cursor={{ fill: "rgb(30 74 48 / 0.06)" }}
                          contentStyle={tooltipStyle}
                          labelStyle={tooltipLabelStyle}
                          formatter={(value) => [`${value} ${result.charts.rainUnit}`, "Rain"]}
                        />
                        <Bar dataKey="value" fill={chartInk.rain} radius={[3, 3, 0, 0]} maxBarSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </section>

              <Panel className="overflow-hidden" aria-labelledby="month-table-heading">
                <div className="p-5 pb-4 sm:p-6 sm:pb-4">
                  <PanelHead
                    id="month-table-heading"
                    icon={CalendarDays}
                    title="Month by month"
                    description="Climate normals for each month and whether the mean temperature sits inside the crop’s optimum."
                  />
                </div>
                <div className="overflow-x-auto border-t border-line">
                  <table className="w-full min-w-[660px] text-left text-[13px]">
                    <thead className="bg-paper text-[12.5px] text-ink-mute">
                      <tr>
                        <th scope="col" className="sticky left-0 bg-paper px-4 py-2.5 font-semibold">
                          <span className="sr-only">Measure</span>
                        </th>
                        {result.months.map((month) => (
                          <th
                            key={month.month}
                            scope="col"
                            className={cn(
                              "px-1 py-2.5 text-center font-semibold",
                              month.inWindow && "bg-forest-tint text-forest",
                            )}
                          >
                            {month.month}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="tabular divide-y divide-line-soft">
                      <tr>
                        <th scope="row" className="sticky left-0 bg-panel px-4 py-3 whitespace-nowrap font-semibold text-ink-soft">
                          Mean temp
                        </th>
                        {result.months.map((month) => (
                          <td
                            key={month.month}
                            className={cn("px-1 py-3 text-center text-ink", month.inWindow && "bg-forest-tint/50")}
                          >
                            {month.tempDisplay}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className="sticky left-0 bg-panel px-4 py-3 whitespace-nowrap font-semibold text-ink-soft">
                          Rainfall
                        </th>
                        {result.months.map((month) => (
                          <td
                            key={month.month}
                            className={cn("px-1 py-3 text-center text-sow", month.inWindow && "bg-forest-tint/50")}
                          >
                            {month.rainDisplay}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className="sticky left-0 bg-panel px-4 py-3 whitespace-nowrap font-semibold text-ink-soft">
                          Temperature
                        </th>
                        {result.months.map((month) => (
                          <td
                            key={month.month}
                            className={cn("px-1 py-3 text-center", month.inWindow && "bg-forest-tint/50")}
                          >
                            <span
                              className={cn(
                                "text-[12.5px] font-semibold",
                                month.tempSuitable ? "text-forest" : "text-ink-mute",
                              )}
                            >
                              {month.tempSuitable ? "Suitable" : "Outside"}
                            </span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Panel>

              <PlantingBrief
                key={`${result.location.label}-${result.crop.scientificName}-${result.units}-${result.baseline.label}`}
                context={result}
              />

              <Panel tone="quiet" className="border border-line p-5 sm:p-6" aria-labelledby="derived-heading">
                <PanelHead id="derived-heading" icon={Info} title="How this window was derived" />
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-[1.6] text-ink-soft marker:text-ink-mute">
                  {result.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
                <SourceNote className="mt-4">
                  Sources: {result.sources.observed}; {result.sources.requirements};{" "}
                  {result.sources.geocoding}. Generated {result.generatedAt}.
                </SourceNote>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
