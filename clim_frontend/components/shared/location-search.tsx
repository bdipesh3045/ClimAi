"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { LocationMap } from "@/components/shared/location-map";
import { SearchField } from "@/components/shared/search-field";
import { HelpText, Panel, PanelHead, ResultItem, ResultList, buttonClass } from "@/components/shared/ui-kit";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

type LocationResult = { label: string; lat: number; lon: number };

/**
 * The workspace location. Looked up through the backend's geocoding proxy so
 * every page can start from the same place with real coordinates; a typed
 * name can still be saved on its own when the lookup is unavailable.
 */
export function LocationSearch() {
  const { location, coordinates, setLocation } = useAppData();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error" | "short" | "saved">("idle");

  async function search() {
    const q = query.trim();
    if (q.length < 3) {
      setStatus("short");
      return;
    }
    setStatus("loading");
    setResults([]);
    try {
      const response = await fetch(`${API_BASE}/api/locations/search?q=${encodeURIComponent(q)}`);
      const payload = (await response.json()) as { results?: LocationResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "failed");
      setResults(payload.results ?? []);
      setStatus((payload.results ?? []).length ? "idle" : "empty");
    } catch {
      setStatus("error");
    }
  }

  function choose(item: LocationResult) {
    setLocation(item.label, { lat: item.lat, lon: item.lon });
    setQuery("");
    setResults([]);
    setStatus("saved");
  }

  function saveTyped() {
    const typed = query.trim();
    if (!typed) return;
    setLocation(typed, null);
    setQuery("");
    setResults([]);
    setStatus("saved");
  }

  return (
    <Panel id="location" className="scroll-mt-24 p-5 sm:p-6" aria-labelledby="location-search-heading">
      <PanelHead
        id="location-search-heading"
        icon={MapPin}
        title="Where are you growing?"
        description="Search a city, parish or address. Every tool starts from this location."
      />

      <div className="mt-5">
        <label htmlFor="workspace-location-search" className="sr-only">
          Search for a location
        </label>
        <SearchField
          id="workspace-location-search"
          value={query}
          onChange={(value) => {
            setQuery(value);
            if (status !== "loading") setStatus("idle");
          }}
          onSubmit={() => void search()}
          loading={status === "loading"}
          placeholder="e.g. Baton Rouge, Louisiana"
        />
        {results.length > 0 && (
          <ResultList label="Matching locations">
            {results.map((item) => (
              <ResultItem key={`${item.lat}-${item.lon}-${item.label}`} onSelect={() => choose(item)} primary={item.label} />
            ))}
          </ResultList>
        )}
        <div role="status" aria-live="polite">
          {status === "short" && <HelpText>Enter at least 3 characters.</HelpText>}
          {status === "saved" && <HelpText tone="good">Location saved. The other tools will start here.</HelpText>}
          {(status === "empty" || status === "error") && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <HelpText tone={status === "error" ? "error" : "mute"} className="mt-0">
                {status === "empty"
                  ? "No matches. Try a nearby city or add the state."
                  : "Location lookup is unavailable right now."}
              </HelpText>
              <button type="button" onClick={saveTyped} className={buttonClass({ variant: "ghost", size: "sm" })}>
                Save “{query.trim()}” without a map
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        {location && coordinates ? (
          <LocationMap
            lat={coordinates.lat}
            lon={coordinates.lon}
            label={location}
            className="h-[260px]"
          />
        ) : (
          <div className="flex h-[150px] flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-[#c8cfc0] bg-paper px-4 text-center">
            <p className="text-[14px] font-semibold text-ink-soft">
              {location ? location : "No location saved yet"}
            </p>
            <p className="text-[13px] text-ink-mute">
              {location ? "Saved without coordinates. Search to add it to the map." : "Search above to see it on the map."}
            </p>
          </div>
        )}
        {location && coordinates && (
          <p className="mt-2.5 text-[13.5px] text-ink-soft">
            <span className="font-semibold text-ink">Saved:</span> {location}
          </p>
        )}
      </div>
    </Panel>
  );
}
