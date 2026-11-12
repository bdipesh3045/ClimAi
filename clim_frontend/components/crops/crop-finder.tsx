"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin, Search, Sprout } from "lucide-react";

import { parseCropAnalysis, saveCropAnalysis } from "@/lib/crop-analysis";

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

const fieldClass =
  "w-full rounded-[14px] border border-[#dfe8df] bg-[#f9fbf9] px-3 py-3 text-[14px] text-[#1f2d27] outline-none focus:border-[#4b805d] focus:ring-2 focus:ring-[#4b805d]/20";

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
    ? "flex min-h-[112px] cursor-pointer flex-col rounded-[18px] border border-[#dfe8df] bg-white p-3 text-left transition has-[:checked]:border-[#1d4d31] has-[:checked]:bg-[#ebf4ec] has-[:checked]:shadow-[inset_0_0_0_1px_rgba(24,92,57,0.12)]"
    : variant === "chip"
      ? "flex cursor-pointer items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-[12px] font-medium text-[#4a594f] transition has-[:checked]:border-[#1d4d31] has-[:checked]:bg-[#e9f2eb] has-[:checked]:text-[#1e4d35]"
      : type === "radio"
        ? "flex cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[#dfe8df] bg-white px-3 py-2.5 text-[12px] font-semibold text-[#4d5d53] has-[:checked]:border-[#1d4d31] has-[:checked]:bg-[#eaf2eb] has-[:checked]:text-[#1d4d31]"
        : "flex cursor-pointer items-center gap-2 rounded-[16px] border border-[#dfe8df] bg-white px-3 py-2.5 text-left text-[12px] font-medium text-[#4c5d52] has-[:checked]:border-[#739a7e] has-[:checked]:bg-[#eaf2eb] has-[:checked]:text-[#1e4d35]";
  const controlledProps = checked === undefined ? {} : { checked, onChange };
  const input = (
    <input
      type={type}
      name={name}
      value={value}
      required={required}
      className="size-4 shrink-0 accent-[#1d4d31]"
      {...controlledProps}
    />
  );

  return (
    <label className={className}>
      {description ? (
        <>
          <span className="flex items-center gap-2">
            {input}
            <span className="text-[13px] font-semibold text-[#1f2e29]">
              {label}
            </span>
          </span>
          <p className="mt-2 text-[12px] leading-5 text-[#5b6d62]">
            {description}
          </p>
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
  required = false,
  rightLabel,
  children,
}: {
  step: number;
  title: string;
  required?: boolean;
  rightLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#dfe8df] bg-[#f8faf6] shadow-[0_1px_0_rgba(14,36,22,0.02)]">
      <div className="flex items-center justify-between gap-4 border-b border-[#e3e9e0] bg-[#f4f8f1] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e7f1e7] text-[12px] font-bold text-[#1d4d31]">
            {step}
          </span>
          <h3 className="text-[12px] font-bold tracking-[0.12em] text-[#1f3624] uppercase">
            {title}
          </h3>
        </div>
        {required ? (
          <span className="text-[12px] font-semibold tracking-[0.14em] text-[#1d4d31] uppercase">
            Required
          </span>
        ) : (
          <span className="text-[12px] text-[#7c857e]">
            {rightLabel ?? "Optional"}
          </span>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function CropFinder() {
  const router = useRouter();
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
    setSelectedLocation({
      label: location.display_name,
      lat: Number.parseFloat(location.lat),
      lon: Number.parseFloat(location.lon),
    });
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
      parseCropAnalysis(responseData); // throws a readable error before we leave the form
      saveCropAnalysis(responseData);
      setSubmission({ status: "success", message: "Opening your crop results..." });
      router.push("/crop-finder/results");
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

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-6 text-[#1d2a22]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-full border border-[#dfe7df] bg-[#eef4ee] px-2.5 py-1 text-[12px] font-bold tracking-[0.12em] text-[#3d5c4d] uppercase">
          Farm details · crop planning
        </span>
        <div className="inline-flex items-center rounded-full border border-[#dfe7df] bg-[#eff5ee] px-2.5 py-1 text-[12px] font-medium text-[#425349]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#246741]" />
          <span className="ml-2">Farm assessment form</span>
        </div>
      </div>

      <h1 className="font-heading text-[34px] leading-[1.05] font-extrabold tracking-[-0.06em] text-[#172720] sm:text-[48px]">
        Find crops suited to your conditions.
      </h1>
      <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-[#5d6a60]">
        Enter your farm details. We match your local 30-year climate and
        soil against 30 crops and rank the best fits.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <SectionShell step={1} title="Farm Location" required>
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
                  setSelectedLocation(null);
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

            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[16px] border border-[#dfe8df] bg-[#eef3ee] p-3">
                {selectedLocation ? (
                  <iframe
                    title={`Map of ${selectedLocation.label}`}
                    loading="lazy"
                    className="h-[190px] w-full rounded-[12px] border border-[#d6e1d5]"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedLocation.lon - 0.02},${selectedLocation.lat - 0.02},${selectedLocation.lon + 0.02},${selectedLocation.lat + 0.02}&layer=mapnik&marker=${selectedLocation.lat},${selectedLocation.lon}`}
                  />
                ) : (
                  <div
                    role="img"
                    aria-label="Map preview coming soon"
                    className="relative h-[190px] overflow-hidden rounded-[12px] border border-[#d6e1d5] bg-[radial-gradient(circle_at_20%_25%,rgba(133,180,128,0.35),transparent_18%),linear-gradient(160deg,#edf5ed_0%,#ddeade_30%,#d5e2d5_100%)]"
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
                {selectedLocation ? (
                  <div className="mt-3 flex min-h-24 items-start gap-2 rounded-[14px] border border-[#dfe8df] bg-white px-3 py-3 text-[12px] leading-5 text-[#52645a]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="break-words">{selectedLocation.label}</p>
                      <p className="mt-2 text-[#7c857e]">
                        {selectedLocation.lat.toFixed(4)},{" "}
                        {selectedLocation.lon.toFixed(4)}
                      </p>
                    </div>
                  </div>
                ) : geoResults.length > 0 ? (
                  <div className="mt-3 flex max-h-[190px] flex-col gap-1 overflow-y-auto rounded-[14px] border border-[#dfe8df] bg-white p-2 text-[12px] leading-5 text-[#52645a]">
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
        </SectionShell>

        <SectionShell step={2} title="Farm Details" required>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-[12px] font-bold tracking-[0.12em] text-[#5d7267] uppercase">
                Farm Size
              </span>
              <div className="flex gap-2">
                <input
                  name="farmSize"
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  placeholder="e.g. 24.5"
                  className={fieldClass}
                />
                <select
                  name="farmSizeUnit"
                  aria-label="Farm size unit"
                  className={`${fieldClass} max-w-36`}
                  defaultValue="acres"
                >
                  <option value="acres">Acres</option>
                  <option value="hectares">Hectares</option>
                </select>
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-[12px] font-bold tracking-[0.12em] text-[#5d7267] uppercase">
                Number of Fields
              </span>
              <div className="flex items-center gap-3 rounded-[14px] border border-[#dfe8df] bg-[#f9fbf9] px-3 py-3">
                <input
                  name="fieldCount"
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 3"
                  className="w-full border-0 bg-transparent text-[15px] font-medium text-[#1f2d27] focus:outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-[12px] font-bold tracking-[0.12em] text-[#5d7267] uppercase">
                Soil type (Optional)
              </span>
              <select name="soilType" className={fieldClass} defaultValue="">
                <option value="">Select soil type</option>
                <option value="Clay">Clay</option>
                <option value="Silt">Silt</option>
                <option value="Loam">Loam</option>
                <option value="Sandy">Sandy</option>
                <option value="Not sure">Not sure</option>
              </select>
            </label>
          </div>
        </SectionShell>

        <SectionShell
          step={3}
          title="Current Farming Activities"
          rightLabel="Multi-select crops & water supply"
        >
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 block text-[12px] font-bold tracking-[0.12em] text-[#5d7267] uppercase">
                Currently Planted or Cultivated Crops
              </legend>
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
                <legend className="mb-2 block text-[12px] font-bold tracking-[0.12em] text-[#5d7267] uppercase">
                  Irrigation Availability
                </legend>
                <div className="flex gap-4 rounded-[12px] border border-[#dfe8df] bg-[#f9fbf9] px-3 py-3">
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

              <label className="block">
                <span className="mb-2 block text-[12px] font-bold tracking-[0.12em] text-[#5d7267] uppercase">
                  Irrigation Delivery Method
                </span>
                <select
                  name="irrigationMethod"
                  className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  defaultValue=""
                  disabled={irrigationAvailable !== "yes"}
                  required={irrigationAvailable === "yes"}
                >
                  <option value="">Select a method</option>
                  <option value="Drip">Drip</option>
                  <option value="Sprinkler">Sprinkler</option>
                  <option value="Flood">Flood</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-[12px] font-bold tracking-[0.12em] text-[#5d7267] uppercase">
                Anything else we should know? (crops, challenges, irrigation)
              </span>
              <textarea
                name="otherNotes"
                rows={3}
                placeholder="Add any other details about your farm"
                className={fieldClass}
              />
            </label>
          </div>
        </SectionShell>

        <SectionShell
          step={4}
          title="Farming Goals"
          rightLabel="Choose multiple options"
        >
          <fieldset>
            <legend className="sr-only">Farming goals</legend>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

        <SectionShell
          step={5}
          title="Farming Challenges"
          rightLabel="Select multiple options"
        >
          <fieldset>
            <legend className="sr-only">Farming challenges</legend>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {challengeCards.map((value) => (
                <ChoiceCard
                  key={value}
                  name="challenges"
                  value={value}
                  label={value}
                  type="checkbox"
                />
              ))}
            </div>
          </fieldset>
        </SectionShell>

        <SectionShell
          step={6}
          title="Growing Season & Historical Harvest"
          required
        >
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 block text-[12px] font-bold tracking-[0.12em] text-[#5f7163] uppercase">
                Intended Planting Season
              </legend>
              <div className="grid gap-2 sm:grid-cols-4">
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

            <details className="rounded-[14px] border border-[#dfe8df] bg-[#f9fbf9] px-3 py-3 text-[12px] text-[#4a5c53]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                Previous Crop & Harvest Information (Optional)
                <ChevronDown className="h-4 w-4 text-[#567064]" />
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold">
                    Previous crop
                  </span>
                  <input
                    name="previousCrop"
                    type="text"
                    placeholder="e.g. Rice"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold">
                    Harvest notes
                  </span>
                  <textarea
                    name="harvestNotes"
                    rows={3}
                    placeholder="Add previous yield, dates, or other relevant notes"
                    className={fieldClass}
                  />
                </label>
              </div>
            </details>
          </div>
        </SectionShell>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[#56645e]">
            <span className="font-semibold text-[#20392c]">
              Your farm details stay in this form until you submit.
            </span>{" "}
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1b4d35] px-5 py-3 text-[12px] font-semibold text-white shadow-[0_10px_22px_rgba(27,77,53,0.2)] transition hover:bg-[#123d2b] disabled:cursor-wait disabled:opacity-70"
          >
            <Sprout className="h-4 w-4" />
            {isSubmitting ? "Submitting..." : "Analyze My Farm"}
          </button>
        </div>
        {submission.message && (
          <p
            role="status"
            aria-live="polite"
            className={`px-5 pb-4 text-[12px] ${submission.status === "error" ? "text-[#a33c32]" : "text-[#1d4d31]"}`}
          >
            {submission.message}
          </p>
        )}
      </form>

      <footer className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-[#dfe8df] pt-3 text-[12px] text-[#7a857f] sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#dfe8df] bg-white text-[#1d4d31]">
            i
          </span>
          <span>
            Your answers are sent to the configured Crop Finder endpoint when
            you submit.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>© {new Date().getFullYear()} ClimateAI</span>
          <span>·</span>
          <span>Agricultural Intelligence Studio </span>
        </div>
      </footer>
    </div>
  );
}
