"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Droplets, MapPin, Search, ThermometerSun } from "lucide-react";
import { PageIntro } from "@/components/shared/page-intro";
import { PlantingBrief } from "@/components/weather/planting-brief";

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

  return (
    <div>
      <PageIntro
        eyebrow="Plan with the season"
        title="Find a planting window backed by real climate data."
        description="Search a location and a crop. The window is derived from NASA POWER monthly normals checked against the FAO ECOCROP optimum for that crop — no sample data."
      />

      <section
        className="mb-6 rounded-2xl border border-[#e7ebe5] bg-white p-4 sm:p-5"
        aria-label="Planting search"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label
              htmlFor="planting-location"
              className="mb-1.5 block text-xs font-semibold text-[#42564a]"
            >
              Location
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-[#f9fbf9] px-3 py-2.5">
              <Search size={15} className="shrink-0 text-[#4d6858]" />
              <input
                id="planting-location"
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
                  : locationStatus === "short"
                    ? "Enter at least 3 characters."
                    : locationStatus === "error"
                      ? "Location search failed. Check that the backend is running."
                      : "Type a location and press Search, then pick a result."}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="crop-search" className="mb-1.5 block text-xs font-semibold text-[#42564a]">
              Crop (search the FAO ECOCROP database)
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-[#f9fbf9] px-3 py-2.5">
              <Search size={15} className="shrink-0 text-[#4d6858]" />
              <input
                id="crop-search"
                type="text"
                autoComplete="off"
                placeholder="Search any crop — e.g. rice, maize, cotton"
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

            {crop && (
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Selected crop">
                <button
                  type="button"
                  onClick={() => setCrop(null)}
                  title={`Remove ${crop.name}`}
                  className="rounded-full border border-[#1d4d31] bg-[#1b4d35] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {crop.name} ✕
                </button>
              </div>
            )}

            <div className="mt-2 text-xs" aria-live="polite">
              {cropStatus === "loading" && <p className="text-[#7c857e]">Searching ECOCROP…</p>}
              {cropStatus === "error" && (
                <p className="text-[#a33c32]">Crop search failed. Check that the backend is running.</p>
              )}
              {cropStatus === "empty" && <p className="text-[#7c857e]">No crops match that name.</p>}
              {cropStatus === "done" && cropResults.length > 0 && (
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border border-[#dfe8df] bg-white p-1.5">
                  {cropResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseCrop(item)}
                      className="rounded-lg px-2 py-1.5 text-left text-[#35463a] hover:bg-[#eef4ee]"
                    >
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-[#7c857e]"> · {item.scientificName}</span>
                      <span className="block text-[10px] text-[#8a9389]">
                        ECOCROP optimum {item.tempOptimalC[0]}–{item.tempOptimalC[1]}°C
                        {item.rainOptimalMmYear
                          ? ` · ${item.rainOptimalMmYear[0]}–${item.rainOptimalMmYear[1]} mm/yr`
                          : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-[#eef2ec] pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#42564a]">
              Baseline
              <select
                value={baselineSpan}
                onChange={(event) => setBaselineSpan(Number(event.target.value))}
                className="rounded-lg border border-[#dfe8df] bg-white px-2 py-1.5 text-xs font-medium text-[#1e2d29]"
              >
                <option value={1}>Last year</option>
                <option value={3}>Last 3 years</option>
                <option value={5}>Last 5 years</option>
              </select>
            </label>
            <div className="flex items-center gap-1 rounded-full border border-[#dfe8df] bg-white p-1">
              {(["imperial", "metric"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => changeUnits(option)}
                  aria-pressed={units === option}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    units === option ? "bg-[#1b4d35] text-white" : "text-[#4a594f]"
                  }`}
                >
                  {option === "imperial" ? "°F / in" : "°C / mm"}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchPlan()}
            disabled={status === "loading"}
            className="rounded-full bg-[#1b4d35] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {status === "loading" ? "Fetching climate data…" : "Find planting window"}
          </button>
        </div>

        {status === "error" && (
          <p role="alert" className="mt-3 rounded-xl bg-[#fdf0ed] px-3 py-2 text-xs leading-5 text-[#a33c32]">
            {errorMessage}
          </p>
        )}
      </section>

      {status === "success" && result && (
        <div className="space-y-5">
          <PlantingBrief
            key={`${result.location.label}-${result.crop.scientificName}-${result.units}-${result.baseline.label}`}
            context={result}
          />

          <section className="rounded-2xl border border-[#e7ebe5] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.14em] text-[#8a9389] uppercase">
                  Derived from {result.baseline.label} normals
                </p>
                <h2 className="mt-1 font-heading text-xl font-bold text-[#23372b]">
                  {result.crop.name} · {result.window.label}
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#6f7c72]">
                  {result.crop.scientificName}
                  {result.crop.lifeForm ? ` · ${result.crop.lifeForm}` : ""} ·{" "}
                  {result.location.label}
                </p>
              </div>
              <span className="rounded-full bg-[#eaf4f7] px-3 py-1.5 text-[10px] font-semibold text-[#3f6c78]">
                {result.suitability.verdict}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Planting window"
                value={result.window.label}
                hint={`${result.window.monthNames.length} month${result.window.monthNames.length === 1 ? "" : "s"}`}
                icon={CalendarDays}
              />
              <Stat
                label="Suitable months"
                value={`${result.suitability.suitableMonths} of 12`}
                hint="Mean temp inside ECOCROP optimum"
                icon={ThermometerSun}
              />
              <Stat
                label="Annual rainfall"
                value={result.rainfall.annual}
                hint={`ECOCROP ${result.crop.rainOptimal}`}
                icon={Droplets}
              />
              <Stat
                label="Optimal temperature"
                value={result.crop.tempOptimal}
                hint="ECOCROP growing range"
                icon={ThermometerSun}
              />
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-[#e7ebe5] bg-white p-5">
              <h3 className="font-heading text-base font-bold text-[#23372b]">
                Monthly mean temperature
              </h3>
              <p className="mt-1 text-[11px] text-[#7c857e]">
                Green band is the crop&rsquo;s ECOCROP optimum ({result.crop.tempOptimal}).
              </p>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.charts.temperature} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#eef2ec" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#7c857e" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#7c857e" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value) => [`${value} ${result.charts.tempUnit}`, "Mean"]}
                      contentStyle={{ fontSize: 11, borderRadius: 10, borderColor: "#dfe8df" }}
                    />
                    <ReferenceLine
                      y={result.charts.temperature[0]?.optimalLow}
                      stroke="#8fbf92"
                      strokeDasharray="4 4"
                      label={{ value: "optimum low", position: "insideBottomLeft", fontSize: 9, fill: "#5f8365" }}
                    />
                    <ReferenceLine
                      y={result.charts.temperature[0]?.optimalHigh}
                      stroke="#398253"
                      strokeDasharray="4 4"
                      label={{ value: "optimum high", position: "insideTopLeft", fontSize: 9, fill: "#2f6b42" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#1b4d35"
                      strokeWidth={2.2}
                      dot={{ r: 2.4, fill: "#1b4d35" }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl border border-[#e7ebe5] bg-white p-5">
              <h3 className="font-heading text-base font-bold text-[#23372b]">Monthly rainfall</h3>
              <p className="mt-1 text-[11px] text-[#7c857e]">
                Monthly totals from the same {result.baseline.label} normals.
              </p>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.charts.rainfall} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#eef2ec" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#7c857e" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#7c857e" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value) => [`${value} ${result.charts.rainUnit}`, "Rain"]}
                      contentStyle={{ fontSize: 11, borderRadius: 10, borderColor: "#dfe8df" }}
                    />
                    <Bar dataKey="value" fill="#8fb9c4" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-[#e7ebe5] bg-white p-5" aria-label="Month by month suitability">
            <h3 className="font-heading text-base font-bold text-[#23372b]">Month by month</h3>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {result.months.map((month) => (
                <div
                  key={month.month}
                  className={`rounded-xl border p-3 ${
                    month.inWindow
                      ? "border-[#398253] bg-[#eef6ee]"
                      : month.tempSuitable
                        ? "border-[#bcd6bd] bg-[#f6faf5]"
                        : "border-[#e7ebe5] bg-[#fbfcfa]"
                  }`}
                >
                  <p className="text-[10px] font-semibold tracking-[0.1em] text-[#6f7c72] uppercase">
                    {month.month}
                  </p>
                  <p className="mt-1 font-heading text-sm font-bold text-[#23372b]">
                    {month.tempDisplay}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#7c857e]">{month.rainDisplay}</p>
                  <p
                    className={`mt-1.5 text-[10px] font-semibold ${
                      month.tempSuitable ? "text-[#2f6b42]" : "text-[#8a9389]"
                    }`}
                  >
                    {month.tempSuitable ? "Suitable" : "Outside range"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-[#d8e2d5] bg-[#fbfcf9] p-5">
            <h3 className="text-sm font-semibold text-[#23372b]">How this window was derived</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {result.notes.map((note) => (
                <li key={note} className="text-xs leading-5 text-[#6f7c72]">
                  {note}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] leading-4 text-[#8a9389]">
              Sources: {result.sources.observed}; {result.sources.requirements}; {" "}
              {result.sources.geocoding}. Generated {result.generatedAt}.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Droplets;
}) {
  return (
    <div className="rounded-xl bg-[#f8faf8] p-3.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] text-[#7c857e] uppercase">
        <Icon size={12} />
        {label}
      </p>
      <p className="mt-1.5 font-heading text-lg font-bold text-[#23372b]">{value}</p>
      <p className="mt-0.5 text-[10px] text-[#8a9389]">{hint}</p>
    </div>
  );
}
