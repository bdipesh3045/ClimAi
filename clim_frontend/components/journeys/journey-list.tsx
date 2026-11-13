"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Route, Search, X } from "lucide-react";
import { PageIntro } from "@/components/shared/page-intro";
import { useAppData } from "@/components/providers/app-data-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { SearchField } from "@/components/shared/search-field";
import {
  Field,
  HelpText,
  Panel,
  PanelHead,
  Pill,
  ResultItem,
  ResultList,
  Skeleton,
  StateBlock,
  buttonClass,
  inputClass,
} from "@/components/shared/ui-kit";
import { useJourneys } from "@/components/journeys/journey-store";
import { apiFetch, errorText } from "@/lib/api";
import { ProgressBar } from "@/components/journeys/parts";
import {
  ACTION_LABELS,
  daysSinceSowing,
  formatDate,
  progress,
  sortedEntries,
  stageFor,
  todayIso,
  type CropOption,
  type Journey,
  type JourneyCrop,
} from "@/lib/journeys";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5001";

type Place = { label: string; lat: number; lon: number };

/** "Baton Rouge, East Baton Rouge Parish, Louisiana, United States" -> "Baton Rouge, Louisiana". */
function shortPlace(label: string) {
  const parts = label.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(", ");
  const region = parts.length >= 3 ? parts[parts.length - 2] : parts[1];
  return `${parts[0]}, ${region}`.slice(0, 120);
}

// Shown if the crop list can't load, so a journey can still be started.
const FALLBACK_CROPS: CropOption[] = [
  { name: "Soybeans", category: "legume", seasonDays: 120 },
  { name: "Rice", category: "cereal", seasonDays: 130 },
];


export function JourneyList() {
  const { journeys, loadError, retryLoad } = useJourneys();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="My crop journeys"
        description="Follow each crop from sowing to harvest: everything done to it, how it is growing and what comes next."
        action={
          <button type="button" onClick={() => setCreating((open) => !open)} className={buttonClass()}>
            <Plus size={16} aria-hidden="true" />
            New journey
          </button>
        }
      />

      {creating && <NewJourneyForm onClose={() => setCreating(false)} />}

      {loadError && (
        <StateBlock
          kind="error"
          title="Your saved journeys could not be loaded"
          action={
            <button type="button" onClick={retryLoad} className={buttonClass({ variant: "danger", size: "sm" })}>
              Try again
            </button>
          }
        >
          {loadError} The sample journeys below still work.
        </StateBlock>
      )}

      {journeys === null ? (
        <div className="grid gap-6 md:grid-cols-2" aria-hidden="true">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[220px]" />
        </div>
      ) : journeys.length === 0 ? (
        <StateBlock kind="empty" icon={Route} title="No journeys yet">
          Start one with New journey.
        </StateBlock>
      ) : (
        <ul className="grid animate-rise grid-cols-1 gap-6 md:grid-cols-2">
          {journeys.map((journey) => (
            <li key={journey.id} className="min-w-0">
              <JourneyCard journey={journey} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JourneyCard({ journey }: { journey: Journey }) {
  const day = daysSinceSowing(journey);
  const latest = sortedEntries(journey)[0];
  return (
    <Link
      href={`/journeys/${journey.id}`}
      className="group block h-full rounded-[14px] border border-line bg-panel p-5 transition-[border-color,box-shadow] hover:border-forest-mid/40 hover:shadow-[0_12px_28px_-16px_rgb(18_48_31/0.3)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[24px] leading-[1.15] text-ink">{journey.crop}</h2>
          <p className="mt-1 text-[14px] text-ink-mute">
            {journey.location} · sown {formatDate(journey.sownOn)}
          </p>
        </div>
        <Pill tone="good" className="shrink-0">
          {stageFor(journey)}
        </Pill>
      </div>
      <div className="mt-5 flex items-baseline justify-between text-[13.5px]">
        <span className="font-semibold text-ink">
          Day {day} <span className="font-normal text-ink-mute">of about {journey.seasonDays}</span>
        </span>
        <span className="tabular text-ink-mute">{Math.round(progress(journey) * 100)}%</span>
      </div>
      <ProgressBar value={progress(journey)} label={`${journey.crop} season progress`} className="mt-2" />
      {latest && (
        <p className="mt-4 truncate text-[13.5px] text-ink-soft">
          <span className="font-semibold text-ink">Last: {ACTION_LABELS[latest.type]}</span> · {formatDate(latest.date)} ·{" "}
          {latest.details}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[12.5px] text-ink-mute">
          {journey.entries.length} action{journey.entries.length === 1 ? "" : "s"} logged
          {journey.sample ? " · Sample journey" : " · Saved"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-forest">
          Open journey
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function NewJourneyForm({ onClose }: { onClose: () => void }) {
  const { addJourney } = useJourneys();
  const { location: savedLocation, coordinates: savedCoordinates } = useAppData();
  const { state: auth } = useAuth();
  const profile = auth.status === "signed-in" ? auth.account.profile : null;
  // Start from the profile farm, else the workspace location.
  const startPlace: Place | null = profile
    ? { label: profile.location, ...profile.coordinates }
    : savedLocation && savedCoordinates
      ? { label: savedLocation, ...savedCoordinates }
      : null;
  const router = useRouter();
  const [crop, setCrop] = useState<JourneyCrop | null>("Soybeans");
  const [crops, setCrops] = useState<CropOption[]>(FALLBACK_CROPS);
  const [cropQuery, setCropQuery] = useState("");
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    apiFetch("/journeys/crops")
      .then((data) => {
        const list = (data as { crops?: CropOption[] } | null)?.crops;
        if (Array.isArray(list) && list.length > 0) setCrops(list);
      })
      .catch(() => setCrops(FALLBACK_CROPS));
  }, []);
  const selected = crops.find((c) => c.name === crop);
  const q = cropQuery.trim().toLowerCase();
  const matches = crops.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
  );
  const showList = browsing || q.length > 0;

  function chooseCrop(name: string) {
    setCrop(name);
    setCropQuery("");
    setBrowsing(false);
    setError("");
  }
  const [sownOn, setSownOn] = useState(todayIso());
  const [place, setPlace] = useState<Place | null>(startPlace);
  const [placeQuery, setPlaceQuery] = useState(startPlace?.label ?? "");
  const [placeResults, setPlaceResults] = useState<Place[]>([]);
  const [placeState, setPlaceState] = useState<"idle" | "loading" | "empty" | "error" | "short">("idle");

  async function searchPlaces() {
    const q = placeQuery.trim();
    if (q.length < 3) return setPlaceState("short");
    setPlaceState("loading");
    try {
      const response = await fetch(`${API_BASE}/api/locations/search?q=${encodeURIComponent(q)}`);
      const body = (await response.json()) as { results?: Place[] };
      if (!response.ok) throw new Error();
      setPlaceResults(body.results ?? []);
      setPlaceState((body.results ?? []).length ? "idle" : "empty");
    } catch {
      setPlaceState("error");
    }
  }
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!crop) return setError("Search for a crop and pick it from the list.");
    if (!place) return setError("Search for where the crop is growing and pick a result.");
    if (!sownOn) return setError("Pick the sowing date.");
    if (sownOn > todayIso()) return setError("The sowing date can't be in the future.");
    setSaving(true);
    setError("");
    try {
      const id = await addJourney({
        crop: crop as JourneyCrop,
        sownOn,
        location: shortPlace(place.label),
        coordinates: { lat: place.lat, lon: place.lon },
      });
      router.push(`/journeys/${id}`);
    } catch (failure) {
      setError(errorText(failure, "The journey could not be saved. Please try again."));
      setSaving(false);
    }
  }

  return (
    <Panel tone="readout" className="animate-rise p-5 sm:p-6" aria-labelledby="new-journey-heading">
      <PanelHead
        id="new-journey-heading"
        icon={Plus}
        title="Start a journey"
        description="Pick the crop and when it was sown. It is saved to your account."
      />
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] md:items-start">
        <Field label="Crop" htmlFor="journey-crop">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-mute"
              aria-hidden="true"
            />
            <input
              id="journey-crop"
              type="search"
              value={cropQuery}
              onChange={(e) => setCropQuery(e.target.value)}
              onFocus={() => setBrowsing(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) {
                  e.preventDefault();
                  chooseCrop(matches[0].name);
                }
                if (e.key === "Escape") setBrowsing(false);
              }}
              placeholder={`Search ${crops.length} crops: maize, cotton, tomato…`}
              autoComplete="off"
              className={`${inputClass} pl-9`}
            />
          </div>
          {showList &&
            (matches.length > 0 ? (
              <ResultList label="Matching crops">
                {matches.map((item) => (
                  <ResultItem
                    key={item.name}
                    onSelect={() => chooseCrop(item.name)}
                    primary={item.name}
                    secondary={item.category}
                    meta={`About ${item.seasonDays} days from sowing to harvest`}
                  />
                ))}
              </ResultList>
            ) : (
              <HelpText>No crop matches “{cropQuery.trim()}”. Try another name.</HelpText>
            ))}
          {selected && !showList && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCrop(null)}
                aria-label={`Remove ${selected.name}`}
                className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-forest pr-2.5 pl-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-forest-deep"
              >
                {selected.name}
                <X size={14} className="opacity-70 group-hover:opacity-100" aria-hidden="true" />
              </button>
              <span className="text-[12.5px] text-ink-mute">About {selected.seasonDays} days to harvest</span>
            </div>
          )}
        </Field>
        <Field label="Sowing date" htmlFor="journey-sown">
          <input
            id="journey-sown"
            type="date"
            value={sownOn}
            max={todayIso()}
            onChange={(e) => setSownOn(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Field location" htmlFor="journey-location">
          <SearchField
            id="journey-location"
            value={placeQuery}
            onChange={(value) => {
              setPlaceQuery(value);
              setPlace(null);
              setPlaceResults([]);
              setPlaceState("idle");
            }}
            onSubmit={() => void searchPlaces()}
            loading={placeState === "loading"}
            placeholder="City, parish or address"
          />
          {placeResults.length > 0 ? (
            <ResultList label="Matching locations">
              {placeResults.map((item) => (
                <ResultItem
                  key={`${item.lat}-${item.lon}-${item.label}`}
                  onSelect={() => {
                    setPlace(item);
                    setPlaceQuery(item.label);
                    setPlaceResults([]);
                  }}
                  primary={item.label}
                />
              ))}
            </ResultList>
          ) : place ? (
            <HelpText tone="good">
              Using {shortPlace(place.label)}{" "}
              <span className="tabular text-ink-mute">
                ({place.lat.toFixed(3)}, {place.lon.toFixed(3)})
              </span>
            </HelpText>
          ) : (
            <HelpText tone={placeState === "error" ? "error" : "mute"}>
              {placeState === "empty"
                ? "No matches. Try a nearby town or add the state."
                : placeState === "short"
                  ? "Enter at least 3 characters."
                  : placeState === "error"
                    ? "Location search failed. Check that the backend is running."
                    : "Press Search, then pick a result. The expert uses this spot's weather."}
            </HelpText>
          )}
        </Field>
        <div className="flex gap-3 md:col-span-3">
          <button type="submit" disabled={saving} className={buttonClass()}>
            {saving ? "Saving…" : "Start journey"}
          </button>
          <button type="button" onClick={onClose} className={buttonClass({ variant: "ghost" })}>
            Cancel
          </button>
        </div>
      </form>
      {error && <HelpText tone="error">{error}</HelpText>}
    </Panel>
  );
}
