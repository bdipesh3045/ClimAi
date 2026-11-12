"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { SATELLITE_ATTRIBUTION, satelliteImageUrl } from "@/lib/satellite";

export type FarmLocation = { label: string; lat: number; lon: number };

type GeoResult = {
  display_name: string;
  lat: string;
  lon: string;
};

interface FarmLocationSearchProps {
  value: FarmLocation | null;
  onChange: (location: FarmLocation | null) => void;
}

/** Place search (OpenStreetMap Nominatim) with a map preview. The text input is named
 * "location", so a parent form's FormData includes the place name. */
export function FarmLocationSearch({ value, onChange }: FarmLocationSearchProps) {
  const [locationQuery, setLocationQuery] = useState(value?.label ?? "");
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "loading" | "empty" | "error"
  >("idle");

  async function searchLocation() {
    const q = locationQuery.trim();
    if (q.length < 3) return;

    setGeoStatus("loading");
    onChange(null);
    setGeoResults([]);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) {
        throw new Error(`Location search failed (${response.status}).`);
      }

      const results: GeoResult[] = await response.json();
      setGeoResults(results);
      setGeoStatus(results.length === 0 ? "empty" : "idle");
    } catch {
      setGeoResults([]);
      setGeoStatus("error");
    }
  }

  function chooseLocation(location: GeoResult) {
    onChange({
      label: location.display_name,
      lat: Number.parseFloat(location.lat),
      lon: Number.parseFloat(location.lon),
    });
    setLocationQuery(location.display_name);
    setGeoResults([]);
    setGeoStatus("idle");
  }

  return (
      <div className="space-y-3">
        <label
          htmlFor="farm-location"
          className="block text-[12px] font-bold tracking-[0.12em] text-[#5f7163] uppercase"
        >
          Search Farm Location or Agro-Climatic Zone
        </label>
        <div className="flex items-center gap-3 rounded-[14px] border border-[#dfe8df] bg-[#f9fbf9] px-3 py-3 shadow-inner shadow-[#edf2ed]">
          <Search className="h-4 w-4 text-[#4d6858]" />
          <input
            id="farm-location"
            name="location"
            type="text"
            required
            autoComplete="off"
            placeholder="City, region, or address"
            value={locationQuery}
            onChange={(event) => {
              setLocationQuery(event.target.value);
              onChange(null);
              setGeoResults([]);
              setGeoStatus("idle");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchLocation();
              }
            }}
            className="w-full border-0 bg-transparent text-[15px] text-[#1e2d29] placeholder:text-[#8c9a92] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void searchLocation()}
            disabled={geoStatus === "loading"}
            className="shrink-0 rounded-full bg-[#1b4d35] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {geoStatus === "loading" ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-[16px] border border-[#dfe8df] bg-[#eef3ee] p-3">
            {value ? (
              <SatellitePreview location={value} />
            ) : (
              <div
                role="img"
                aria-label="Map preview coming soon"
                className="relative h-[260px] overflow-hidden rounded-[12px] border border-[#d6e1d5] bg-[radial-gradient(circle_at_20%_25%,rgba(133,180,128,0.35),transparent_18%),linear-gradient(160deg,#edf5ed_0%,#ddeade_30%,#d5e2d5_100%)]"
              >
                <div className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.5),transparent)]" />
                <div className="absolute left-[18%] top-[28%] h-10 w-10 rounded-full border-2 border-white/60 bg-[#7ea685]/70" />
                <div className="absolute left-[52%] top-[22%] h-12 w-12 rounded-full border-2 border-white/60 bg-[#7ea685]/80" />
                <div className="absolute right-[16%] top-[20%] h-8 w-8 rounded-full border-2 border-white/60 bg-[#7ea685]/60" />
                <div className="absolute inset-0">
                  <svg
                    viewBox="0 0 400 220"
                    className="h-full w-full"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M40,120 C110,60,170,35,230,80 S320,150,370,95"
                      fill="none"
                      stroke="#a3b9a2"
                      strokeWidth="3"
                      strokeDasharray="8 12"
                    />
                    <path
                      d="M90,160 C150,140,190,150,250,120 S340,80,380,105"
                      fill="none"
                      stroke="#a7bca6"
                      strokeWidth="2.5"
                      strokeDasharray="7 9"
                    />
                    <path
                      d="M60,80 C120,100,165,55,195,70 S300,120,360,60"
                      fill="none"
                      stroke="#a7bca6"
                      strokeWidth="2.5"
                      strokeDasharray="7 9"
                    />
                  </svg>
                </div>
                <div className="absolute left-[48%] top-[46%] flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#1b4d35] text-[12px] font-bold text-white">
                  ●
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-white/25">
                  <span className="rounded-full border border-[#dfe8df] bg-white/95 px-4 py-2 text-[12px] font-semibold text-[#294c37] shadow-sm">
                    Map preview coming soon
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-[16px] border border-[#dfe8df] bg-[#f8faf7] p-3">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-[#76857d] uppercase">
              Location preview
            </p>
            {value ? (
              <div className="mt-3 flex min-h-24 items-start gap-2 rounded-[14px] border border-[#dfe8df] bg-white px-3 py-3 text-[12px] leading-5 text-[#52645a]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="break-words">{value.label}</p>
                  <p className="mt-2 text-[#7c857e]">
                    {value.lat.toFixed(4)},{" "}
                    {value.lon.toFixed(4)}
                  </p>
                </div>
              </div>
            ) : geoResults.length > 0 ? (
              <div className="mt-3 flex max-h-[260px] flex-col gap-1 overflow-y-auto rounded-[14px] border border-[#dfe8df] bg-white p-2 text-[12px] leading-5 text-[#52645a]">
                {geoResults.map((geoResult) => (
                  <button
                    key={`${geoResult.lat}-${geoResult.lon}-${geoResult.display_name}`}
                    type="button"
                    onClick={() => chooseLocation(geoResult)}
                    className="rounded-lg px-2 py-1.5 text-left hover:bg-[#eef4ee]"
                  >
                    {geoResult.display_name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex min-h-24 items-start gap-2 rounded-[14px] border border-[#dfe8df] bg-white px-3 py-3 text-[12px] leading-5 text-[#52645a]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                {geoStatus === "empty"
                  ? "No matches. Try a nearby city or add the state."
                  : geoStatus === "error"
                    ? "Location search failed. Try again."
                    : "Type a location and press Search."}
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

/** Esri satellite snapshot with a pin on the chosen point. */
function SatellitePreview({ location }: { location: FarmLocation }) {
  const imageUrl = satelliteImageUrl(location.lat, location.lon);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (imageUrl === null || failedUrl === imageUrl) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-[12px] border border-[#d6e1d5] bg-[#e4ece3] px-4 text-center text-[12px] text-[#52645a]">
        Satellite view is not available for this location right now.
      </div>
    );
  }

  return (
    <div className="relative h-[260px] overflow-hidden rounded-[12px] border border-[#d6e1d5] bg-[#dfe7de]">
      {/* A plain img: the URL is an Esri-rendered snapshot, so next/image would add nothing. */}
      <img
        src={imageUrl}
        alt={`Satellite view of ${location.label}`}
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(imageUrl)}
        className="h-full w-full object-cover"
      />
      <MapPin
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-full fill-[#1b4d35] text-white drop-shadow-md"
      />
      <span className="absolute right-1 bottom-1 max-w-[calc(100%-0.5rem)] rounded bg-black/55 px-1.5 py-0.5 text-[9px] leading-tight text-white">
        {SATELLITE_ATTRIBUTION}
      </span>
    </div>
  );
}
