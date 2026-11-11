"use client";

import { useState } from "react";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/components/providers/app-data-provider";

export function LocationSearch() {
  const { location, setLocation } = useAppData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextLocation = query.trim();
    if (!nextLocation) {
      setStatus("Enter a location to continue.");
      return;
    }

    setLocation(nextLocation);
    setQuery("");
    setStatus("Location saved. Live place lookup is not connected.");
  }

  return (
    <section
      className="rounded-2xl border border-[#e3e9e0] bg-white p-5 shadow-sm sm:p-6"
      aria-labelledby="location-search-heading"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#edf4e9] text-[#2e6d42]">
          <MapPin size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] text-[#7f8b7f] uppercase">
            Location search
          </p>
          <h2
            id="location-search-heading"
            className="mt-1 font-heading text-xl font-bold tracking-[-0.03em]"
          >
            Where are you growing?
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#778177]">
            Search any city, region, or postal code. No preset places or
            suggestions.
          </p>
        </div>
      </div>

      <form className="mt-5" onSubmit={handleSubmit}>
        <label htmlFor="workspace-location-search" className="sr-only">
          Search for a location
        </label>
        <div className="flex flex-col gap-2 rounded-2xl border border-[#dfe7dc] bg-[#f8faf6] p-2 transition-shadow focus-within:ring-2 focus-within:ring-[#2f7044] focus-within:ring-offset-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2">
            <Search
              size={17}
              className="shrink-0 text-[#778878]"
              aria-hidden="true"
            />
            <Input
              id="workspace-location-search"
              type="search"
              autoComplete="off"
              placeholder="Enter a location"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (status) setStatus("");
              }}
              className="h-11 min-w-0 border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-[#9aa49a] focus-visible:ring-0"
            />
          </div>
          <Button
            type="submit"
            disabled={!query.trim()}
            className="h-11 rounded-xl bg-[#1f5032] px-5 text-sm font-semibold text-white hover:bg-[#163d26] disabled:opacity-50"
          >
            Search <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
        <p className="text-[#828d82]">
          {location ? (
            <>
              Current location:{" "}
              <span className="font-semibold text-[#345c3c]">{location}</span>
            </>
          ) : (
            "No location selected yet."
          )}
        </p>
        <p role="status" aria-live="polite" className="text-[#2e6d42]">
          {status}
        </p>
      </div>
    </section>
  );
}
