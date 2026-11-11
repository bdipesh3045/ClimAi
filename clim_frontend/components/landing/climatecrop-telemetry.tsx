"use client";

import { useState } from "react";
import {
  CloudRain,
  MapPin,
  Search,
  Sprout,
  Sun,
  ThermometerSun,
} from "lucide-react";

type TelemetryProfile = {
  name: string;
  country: string;
  coordinates: string;
  soilContext: string;
  status: string;
  confidence: string;
  rainfall: string;
  soil: string;
  solar: string;
  crops: string;
  aliases: string[];
};

const regionProfiles: Record<string, TelemetryProfile> = {
  klaten: {
    name: "Klaten Regency, Central Java",
    country: "ID",
    coordinates: "7.7058° S, 110.6014° E",
    soilContext: "Volcanic loam soil · Sub-tropical monsoon",
    status: "Optimal growth",
    confidence: "94.8%",
    rainfall: "2,140 mm/yr",
    soil: "31.4% / 26.8°C",
    solar: "19.2 MJ/m²",
    crops: "Paddy, tobacco, shallots",
    aliases: ["klaten", "java", "indonesia"],
  },
  midwest: {
    name: "Iowa Corn Belt, USA",
    country: "US",
    coordinates: "41.8780° N, 93.0977° W",
    soilContext: "Rich mollisol topsoil · Prairie humus",
    status: "High viability",
    confidence: "96.2%",
    rainfall: "910 mm/yr",
    soil: "24.1% / 18.2°C",
    solar: "22.5 MJ/m²",
    crops: "Yellow corn, soybeans, oats",
    aliases: ["iowa", "midwest", "usa"],
  },
  gujarat: {
    name: "Gujarat Semi-Arid Basin, India",
    country: "IN",
    coordinates: "22.2587° N, 71.1924° E",
    soilContext: "Black cotton vertisol · Calcareous",
    status: "Drip setup recommended",
    confidence: "88.4%",
    rainfall: "730 mm/yr",
    soil: "18.6% / 29.5°C",
    solar: "24.8 MJ/m²",
    crops: "Cotton, groundnut, sesame",
    aliases: ["gujarat", "india", "punjab"],
  },
  salinas: {
    name: "Salinas Valley, California",
    country: "US",
    coordinates: "36.6777° N, 121.6555° W",
    soilContext: "Marine sedimentary sandy loam",
    status: "Peak microclimate",
    confidence: "97.9%",
    rainfall: "340 mm/yr",
    soil: "28.0% / 17.5°C",
    solar: "21.1 MJ/m²",
    crops: "Romaine lettuce, strawberries, celery",
    aliases: ["salinas", "california"],
  },
};

const presets = [
  { key: "klaten", label: "Klaten, Central Java" },
  { key: "midwest", label: "Iowa Corn Belt, USA" },
  { key: "gujarat", label: "Gujarat, India" },
  { key: "salinas", label: "Salinas Valley, CA" },
];

export function ClimateCropTelemetry() {
  const [query, setQuery] = useState(regionProfiles.klaten.name);
  const [profile, setProfile] = useState(regionProfiles.klaten);
  const [statusMessage, setStatusMessage] = useState(
    "Showing an illustrative regional sample, not live sensor readings.",
  );

  function chooseRegion(key: string) {
    const nextProfile = regionProfiles[key];
    if (!nextProfile) return;
    setProfile(nextProfile);
    setQuery(nextProfile.name);
    setStatusMessage(
      `Showing illustrative sample data for ${nextProfile.name}.`,
    );
  }

  function runAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      setStatusMessage("Enter a location to view a sample profile.");
      return;
    }

    const match = Object.entries(regionProfiles).find(([, region]) =>
      region.aliases.some((alias) => normalizedQuery.includes(alias)),
    );

    if (match) {
      setProfile(match[1]);
      setQuery(match[1].name);
      setStatusMessage(
        `Showing illustrative sample data for ${match[1].name}.`,
      );
      return;
    }

    setProfile({
      name: query.trim(),
      country: "DEMO",
      coordinates: "No connected weather station",
      soilContext: "Illustrative sample profile",
      status: "Demo estimate",
      confidence: "91.2%",
      rainfall: "1,220 mm/yr",
      soil: "27.5% / 22.1°C",
      solar: "20.4 MJ/m²",
      crops: "Adaptive grains, legumes",
      aliases: [],
    });
    setStatusMessage(
      "This is a synthesized demo profile only; connect a data provider for real measurements.",
    );
  }

  return (
    <section
      id="location-finder"
      aria-labelledby="telemetry-heading"
      className="mx-auto my-12 w-full max-w-7xl scroll-mt-6 px-4 sm:px-8"
    >
      <div className="rounded-3xl border border-brand-border bg-white p-5 shadow-[0_14px_40px_-12px_rgba(15,38,23,0.12)] sm:p-8 lg:p-10">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-brand-forest">
              <MapPin size={19} aria-hidden="true" />
            </div>
            <h2
              id="telemetry-heading"
              className="mt-3 font-heading text-2xl font-extrabold tracking-[-0.04em] text-brand-dark sm:text-3xl"
            >
              Check Microclimate Viability for Your Plot
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-subtle">
              Explore sample rainfall, soil, and crop indicators for a few
              representative growing regions.
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            aria-label="Sample locations"
          >
            <span className="mr-1 text-xs font-semibold text-brand-subtle">
              Popular regions:
            </span>
            {presets.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => chooseRegion(key)}
                className="rounded-full border border-brand-border bg-brand-cream px-3 py-1.5 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={runAnalysis}
        >
          <div className="relative min-w-0 flex-1">
            <label htmlFor="climatecrop-location" className="sr-only">
              Search for a farm location
            </label>
            <MapPin
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-emerald-800"
              size={19}
              aria-hidden="true"
            />
            <input
              id="climatecrop-location"
              name="location"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.nativeEvent.isComposing || event.keyCode === 229)
                )
                  event.preventDefault();
              }}
              placeholder="Search a region or coordinates"
              autoComplete="off"
              className="min-h-14 w-full rounded-2xl border border-brand-border bg-brand-cream/60 pr-4 pl-12 text-sm font-medium text-brand-dark outline-none transition focus:border-brand-forest focus:ring-2 focus:ring-emerald-200 sm:text-base"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand-forest px-7 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest sm:text-base"
          >
            <Search size={16} aria-hidden="true" /> Run Telemetry
          </button>
        </form>

        <div
          className="mt-7 rounded-2xl border border-brand-border bg-brand-cream/70 p-5 sm:p-6"
          aria-label="Illustrative telemetry results"
        >
          <div className="flex flex-col gap-4 border-b border-brand-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-extrabold text-emerald-900">
                {profile.country}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-lg font-bold text-brand-dark">
                    {profile.name}
                  </h3>
                  <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                    {profile.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-brand-subtle">
                  Geo: {profile.coordinates} · {profile.soilContext}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:justify-end">
              <span className="text-xs font-semibold text-brand-subtle">
                Sample viability score:
              </span>
              <span className="rounded-full border border-brand-border bg-white px-3 py-1.5 text-sm font-extrabold text-brand-dark">
                {profile.confidence}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={CloudRain}
              label="Mean rainfall (seasonal)"
              value={profile.rainfall}
              note="Illustrative annual estimate"
            />
            <MetricCard
              icon={ThermometerSun}
              label="Topsoil moisture & temperature"
              value={profile.soil}
              note="Sample conditions"
            />
            <MetricCard
              icon={Sun}
              label="Solar radiance (PAR)"
              value={profile.solar}
              note="Sample photoperiod"
            />
            <MetricCard
              icon={Sprout}
              label="Recommended crops"
              value={profile.crops}
              note="Example crop matches"
            />
          </div>
          <p
            role="status"
            aria-live="polite"
            className="mt-4 text-xs leading-5 text-brand-subtle"
          >
            {statusMessage}
          </p>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof CloudRain;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-brand-border bg-white p-4">
      <div className="flex items-center gap-2 text-brand-forest">
        <Icon size={15} aria-hidden="true" />
        <span className="text-xs font-medium text-brand-subtle">{label}</span>
      </div>
      <p className="mt-2 break-words font-heading text-lg font-bold text-brand-dark">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-emerald-700">{note}</p>
    </article>
  );
}
