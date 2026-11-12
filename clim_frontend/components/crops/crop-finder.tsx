"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, Info, MapPin, Sprout } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { AssessmentSummary } from "@/components/crops/assessment-summary";
import { LocationMap } from "@/components/shared/location-map";
import { PageIntro } from "@/components/shared/page-intro";
import { SearchField } from "@/components/shared/search-field";
import {
  HelpText,
  ResultItem,
  ResultList,
  StateBlock,
  buttonClass,
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/shared/ui-kit";
import { cn } from "@/lib/utils";


type GeoResult = {
  display_name: string;
  lat: string;
  lon: string;
};

type SelectedLocation = {
  label: string;
  lat: number;
  lon: number;
};

type CropAnalysisPayload = {
  location: string;
  coordinates: { lat: number; lon: number } | null;
  farm: {
    size: number;
    sizeUnit: string;
    fieldCount: number;
  };
  soilType: string | null;
  currentCrops: string[];
  irrigation: {
    available: boolean;
    method: string | null;
  };
  goals: string[];
  challenges: string[];
  plantingSeason: string;
  harvestHistory: {
    previousCrop: string;
    notes: string;
  };
  otherNotes: string;
};

type SubmissionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const goalCards = [
  {
    title: "Increase crop yield",
    description: "Choose varieties and practices that produce more per acre.",
  },
  {
    title: "Increase profitability",
    description: "Match crops to local markets and prices.",
  },
  {
    title: "Reduce water usage",
    description: "Favor drought-tolerant crops and efficient irrigation.",
  },
  {
    title: "Reduce farming costs",
    description:
      "Cut fertilizer and input spending, for example with legumes or cover crops.",
  },
  {
    title: "Explore new crops",
    description: "Try alternative crops suited to your climate.",
  },
  {
    title: "Improve long-term sustainability",
    description: "Build soil health and reduce erosion.",
  },
];

const challengeCards = [
  "Drought",
  "Flooding",
  "Excessive rainfall",
  "Extreme heat",
  "Pests",
  "Crop diseases",
  "Poor harvest",
  "Other",
];

const plantingSeasons = ["Spring", "Summer", "Fall", "Winter"];

const cropOptions = [
  "Rice",
  "Corn",
  "Soybeans",
  "Wheat",
  "Cotton",
  "Sugarcane",
  "Sweet potatoes",
  "Pecans",
  "Other",
];

const irrigationOptions = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
] as const;

const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink-soft";

function ChoiceCard({
  name,
  value,
  label,
  description,
  type,
  required = false,
  variant = "card",
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  description?: string;
  type: "checkbox" | "radio";
  required?: boolean;
  variant?: "chip" | "card";
  checked?: boolean;
  onChange?: () => void;
}) {
  const className = description
    ? "flex min-h-[108px] cursor-pointer flex-col rounded-[12px] border border-line bg-panel p-3.5 text-left transition-colors hover:border-forest-mid/40 has-[:checked]:border-forest has-[:checked]:bg-forest-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-mid"
    : variant === "chip"
      ? "flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-panel px-3.5 text-[14px] font-medium text-ink-soft transition-colors hover:border-forest-mid/40 has-[:checked]:border-forest has-[:checked]:bg-forest-tint has-[:checked]:text-forest has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-mid"
      : "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-panel px-3.5 text-left text-[14px] font-semibold text-ink-soft transition-colors hover:border-forest-mid/40 has-[:checked]:border-forest has-[:checked]:bg-forest-tint has-[:checked]:text-forest has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-mid";
  const controlledProps = checked === undefined ? {} : { checked, onChange };
  const input = (
    <input
      type={type}
      name={name}
      value={value}
      required={required}
      className="size-4 shrink-0 accent-forest"
      {...controlledProps}
    />
  );

  return (
    <label className={className}>
      {description ? (
        <>
          <span className="flex items-center gap-2.5">
            {input}
            <span className="text-[14.5px] font-semibold text-ink">{label}</span>
          </span>
          <span className="mt-2 block pl-[26px] text-[13.5px] leading-[1.5] text-ink-mute">{description}</span>
        </>
      ) : (
        <>
          {input}
          <span>{label}</span>
        </>
      )}
    </label>
  );
}

function SectionShell({
  step,
  title,
  description,
  required = false,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`crop-step-${step}`}
      className="grid gap-4 border-t border-line py-7 first:border-t-0 first:pt-0 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10"
    >
      <div className="flex items-start gap-3 lg:block">
        <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-forest text-[13px] font-bold text-white lg:mb-3">
          {step}
        </span>
        <div>
          <h2 id={`crop-step-${step}`} className="font-heading text-[17px] leading-snug font-bold text-ink">
            {title}
          </h2>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink-mute">
            {required ? <span className="font-semibold text-forest">Required. </span> : "Optional. "}
            {description}
          </p>
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function CropFinder() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "loading" | "empty" | "error"
  >("idle");
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null);
  const [irrigationAvailable, setIrrigationAvailable] = useState<
    "yes" | "no" | ""
  >("");
  const [submission, setSubmission] = useState<SubmissionState>({
    status: "idle",
    message: "",
  });
  const [result, setResult] = useState<unknown>();

  async function searchLocation() {
    const q = locationQuery.trim();
    if (q.length < 3) return;

    setGeoStatus("loading");
    setSelectedLocation(null);
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
    const lat = Number.parseFloat(location.lat);
    const lon = Number.parseFloat(location.lon);
    setSelectedLocation({ label: location.display_name, lat, lon });
    setSavedLocation(location.display_name, { lat, lon });
    setPrefilled(true);
    setLocationQuery(location.display_name);
    setGeoResults([]);
    setGeoStatus("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedLocation === null) {
      setSubmission({
        status: "error",
        message:
          "Please search for your location and pick a result from the list.",
      });
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const hasIrrigation = formData.get("irrigationAvailable") === "yes";
    const payload: CropAnalysisPayload = {
      location: String(formData.get("location") ?? "").trim(),
      coordinates: {
        lat: selectedLocation.lat,
        lon: selectedLocation.lon,
      },
      farm: {
        size: Number(formData.get("farmSize")),
        sizeUnit: String(formData.get("farmSizeUnit")),
        fieldCount: Number(formData.get("fieldCount")),
      },
      soilType: String(formData.get("soilType") ?? "") || null,
      currentCrops: formData.getAll("currentCrops").map(String),
      irrigation: {
        available: hasIrrigation,
        method: hasIrrigation
          ? String(formData.get("irrigationMethod") ?? "") || null
          : null,
      },
      goals: formData.getAll("goals").map(String),
      challenges: formData.getAll("challenges").map(String),
      plantingSeason: String(formData.get("plantingSeason") ?? ""),
      harvestHistory: {
        previousCrop: String(formData.get("previousCrop") ?? "").trim(),
        notes: String(formData.get("harvestNotes") ?? "").trim(),
      },
      otherNotes: String(formData.get("otherNotes") ?? "").trim(),
    };

    setIsSubmitting(true);
    setSubmission({ status: "idle", message: "" });
    setResult(undefined);

    const endpoint = process.env.NEXT_PUBLIC_CROP_ANALYSIS_API_URL;
    if (!endpoint) {
      setSubmission({
        status: "error",
        message:
          "Set NEXT_PUBLIC_CROP_ANALYSIS_API_URL to your backend endpoint before submitting.",
      });
      setIsSubmitting(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = `Backend request failed (${response.status}).`;
        try {
          const errorBody: unknown = await response.json();
          if (
            typeof errorBody === "object" &&
            errorBody !== null &&
            "error" in errorBody &&
            typeof errorBody.error === "string"
          ) {
            message = errorBody.error;
          }
        } catch {
          // Keep the HTTP status message when the backend does not return JSON.
        }
        throw new Error(message);
      }

      const responseData: unknown = await response.json();
      setResult(responseData);
      setSubmission({
        status: "success",
        message: "Farm assessment submitted successfully.",
      });
      form.reset();
      setLocationQuery("");
      setSelectedLocation(null);
      setGeoResults([]);
      setGeoStatus("idle");
      setIrrigationAvailable("");
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "The request took too long. Please check your connection and try again."
          : error instanceof Error
            ? error.message
            : "Could not submit the farm assessment. Please try again.";
      setSubmission({ status: "error", message });
    } finally {
      window.clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  }


  // --- Shared workspace location: start from it when nothing is typed yet ---
  const { location: savedLocation, coordinates: savedCoordinates, setLocation: setSavedLocation } =
    useAppData();
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (prefilled || selectedLocation || locationQuery || !savedLocation || !savedCoordinates) return;
    setPrefilled(true);
    setSelectedLocation({ label: savedLocation, lat: savedCoordinates.lat, lon: savedCoordinates.lon });
    setLocationQuery(savedLocation);
  }, [prefilled, selectedLocation, locationQuery, savedLocation, savedCoordinates]);

  // Bring the receipt into view once the endpoint answers.
  useEffect(() => {
    if (result === undefined) return;
    document
      .getElementById("crop-analysis-result-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <PageIntro
        title="Tell us about your farm."
        description="Describe your location, fields and goals. Your answers are sent to the configured Crop Finder endpoint when you submit."
      />

      <form onSubmit={handleSubmit} className="animate-rise rounded-[14px] border border-line bg-panel p-5 sm:p-7">
        <SectionShell step={1} title="Farm location" description="Search and pick your farm or nearest town." required>
          <label htmlFor="farm-location" className={labelClass}>
            Farm location
          </label>
          <SearchField
            id="farm-location"
            name="location"
            required
            value={locationQuery}
            onChange={(value) => {
              setLocationQuery(value);
              setSelectedLocation(null);
              setGeoResults([]);
              setGeoStatus("idle");
            }}
            onSubmit={() => void searchLocation()}
            loading={geoStatus === "loading"}
            placeholder="City, region or address"
          />
          {selectedLocation ? (
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <LocationMap
                lat={selectedLocation.lat}
                lon={selectedLocation.lon}
                label={selectedLocation.label}
                zoom={11}
                className="min-h-[200px]"
              />
              <div className="flex items-start gap-2.5 rounded-[12px] bg-forest-tint/60 p-4 text-[14px] leading-[1.55] text-ink-soft">
                <MapPin size={17} className="mt-0.5 shrink-0 text-forest" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold break-words text-ink">{selectedLocation.label}</p>
                  <p className="tabular mt-1.5 text-ink-mute">
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lon.toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
          ) : geoResults.length > 0 ? (
            <ResultList label="Matching locations">
              {geoResults.map((geoResult) => (
                <ResultItem
                  key={`${geoResult.lat}-${geoResult.lon}-${geoResult.display_name}`}
                  onSelect={() => chooseLocation(geoResult)}
                  primary={geoResult.display_name}
                />
              ))}
            </ResultList>
          ) : (
            <HelpText tone={geoStatus === "error" ? "error" : "mute"}>
              {geoStatus === "empty"
                ? "No matches. Try a nearby city or add the state."
                : geoStatus === "error"
                  ? "Location search failed. Try again."
                  : "Type a location and press Search, then pick a result."}
            </HelpText>
          )}
        </SectionShell>

        <SectionShell step={2} title="Farm details" description="Size, number of fields and soil." required>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="farm-size" className={labelClass}>
                Farm size
              </label>
              <div className="flex gap-2">
                <input
                  id="farm-size"
                  name="farmSize"
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  placeholder="e.g. 24.5"
                  className={inputClass}
                />
                <select
                  name="farmSizeUnit"
                  aria-label="Farm size unit"
                  className={cn(selectClass, "max-w-36")}
                  defaultValue="acres"
                >
                  <option value="acres">Acres</option>
                  <option value="hectares">Hectares</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="field-count" className={labelClass}>
                Number of fields
              </label>
              <input
                id="field-count"
                name="fieldCount"
                type="number"
                min="1"
                step="1"
                required
                placeholder="e.g. 3"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="soil-type" className={labelClass}>
                Soil type <span className="font-normal text-ink-mute">(optional)</span>
              </label>
              <select id="soil-type" name="soilType" className={selectClass} defaultValue="">
                <option value="">Select soil type</option>
                <option value="Clay">Clay</option>
                <option value="Silt">Silt</option>
                <option value="Loam">Loam</option>
                <option value="Sandy">Sandy</option>
                <option value="Not sure">Not sure</option>
              </select>
            </div>
          </div>
        </SectionShell>

        <SectionShell step={3} title="What you grow now" description="Crops on your land and how they are watered.">
          <div className="space-y-5">
            <fieldset>
              <legend className={labelClass}>Crops currently planted or cultivated</legend>
              <div className="flex flex-wrap gap-2">
                {cropOptions.map((crop) => (
                  <ChoiceCard
                    key={crop}
                    name="currentCrops"
                    value={crop}
                    label={crop}
                    type="checkbox"
                    variant="chip"
                  />
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 md:grid-cols-2">
              <fieldset>
                <legend className={labelClass}>Irrigation available?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {irrigationOptions.map(({ label, value }) => (
                    <ChoiceCard
                      key={value}
                      name="irrigationAvailable"
                      value={value}
                      label={label}
                      type="radio"
                      variant="chip"
                      required
                      checked={irrigationAvailable === value}
                      onChange={() => setIrrigationAvailable(value)}
                    />
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="irrigation-method" className={labelClass}>
                  Irrigation method
                </label>
                <select
                  id="irrigation-method"
                  name="irrigationMethod"
                  className={selectClass}
                  defaultValue=""
                  disabled={irrigationAvailable !== "yes"}
                  required={irrigationAvailable === "yes"}
                >
                  <option value="">{irrigationAvailable === "yes" ? "Select a method" : "Choose “Yes” first"}</option>
                  <option value="Drip">Drip</option>
                  <option value="Sprinkler">Sprinkler</option>
                  <option value="Flood">Flood</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="other-notes" className={labelClass}>
                Anything else we should know?
              </label>
              <textarea
                id="other-notes"
                name="otherNotes"
                rows={3}
                placeholder="Crops, challenges, irrigation or anything else about your farm"
                className={textareaClass}
              />
            </div>
          </div>
        </SectionShell>

        <SectionShell step={4} title="Farming goals" description="Choose as many as apply.">
          <fieldset>
            <legend className="sr-only">Farming goals</legend>
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {goalCards.map(({ title, description }) => (
                <ChoiceCard
                  key={title}
                  name="goals"
                  value={title}
                  label={title}
                  description={description}
                  type="checkbox"
                />
              ))}
            </div>
          </fieldset>
        </SectionShell>

        <SectionShell step={5} title="Farming challenges" description="Choose as many as apply.">
          <fieldset>
            <legend className="sr-only">Farming challenges</legend>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {challengeCards.map((value) => (
                <ChoiceCard key={value} name="challenges" value={value} label={value} type="checkbox" />
              ))}
            </div>
          </fieldset>
        </SectionShell>

        <SectionShell step={6} title="Season and harvest history" description="When you plan to plant, and what came before." required>
          <div className="space-y-4">
            <fieldset>
              <legend className={labelClass}>Intended planting season</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {plantingSeasons.map((season) => (
                  <ChoiceCard
                    key={season}
                    name="plantingSeason"
                    value={season}
                    label={season}
                    type="radio"
                    required
                  />
                ))}
              </div>
            </fieldset>

            <details className="group rounded-[12px] border border-line bg-paper px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold text-ink-soft">
                Previous crop and harvest <span className="font-normal text-ink-mute">(optional)</span>
                <ChevronDown size={17} className="ml-auto text-ink-mute transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="previous-crop" className={labelClass}>
                    Previous crop
                  </label>
                  <input id="previous-crop" name="previousCrop" type="text" placeholder="e.g. Rice" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="harvest-notes" className={labelClass}>
                    Harvest notes
                  </label>
                  <textarea
                    id="harvest-notes"
                    name="harvestNotes"
                    rows={3}
                    placeholder="Previous yield, dates or other notes"
                    className={textareaClass}
                  />
                </div>
              </div>
            </details>
          </div>
        </SectionShell>

        <div className="mt-2 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-[13.5px] leading-[1.5] text-ink-mute">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Your details stay in this form until you submit.
          </p>
          <button type="submit" disabled={isSubmitting} className={buttonClass({ size: "lg" })}>
            <Sprout size={18} aria-hidden="true" />
            {isSubmitting ? "Submitting…" : "Analyze my farm"}
          </button>
        </div>
        {submission.status === "error" && submission.message && (
          <StateBlock kind="error" title="Could not submit the assessment" className="mt-4">
            {submission.message}
          </StateBlock>
        )}
        {submission.status === "success" && submission.message && (
          <p role="status" aria-live="polite" className="mt-4 text-[14px] font-semibold text-forest">
            {submission.message}
          </p>
        )}
      </form>

      {result !== undefined && (
        <div className="mt-6">
          <AssessmentSummary response={result} />
        </div>
      )}
    </div>
  );
}
