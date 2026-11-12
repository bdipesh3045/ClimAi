"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Sprout } from "lucide-react";

import { useAccount } from "@/components/providers/auth-provider";
import {
  FarmLocationSearch,
  type FarmLocation,
} from "@/components/shared/farm-location-search";
import {
  ChoiceCard,
  SectionShell,
  fieldClass,
} from "@/components/shared/form-parts";
import { parseCropAnalysis, saveCropAnalysis } from "@/lib/crop-analysis";
import {
  CROP_OPTIONS,
  IRRIGATION_CHOICES,
  IRRIGATION_METHODS,
  SOIL_OPTIONS,
  type IrrigationChoice,
} from "@/lib/farm-options";

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

export function CropFinder() {
  const router = useRouter();
  // Saved farm profile, used only as starting values. Every field stays editable here.
  const profile = useAccount()?.profile ?? null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLocation, setSelectedLocation] =
    useState<FarmLocation | null>(() =>
      profile ? { label: profile.location, ...profile.coordinates } : null,
    );
  const [irrigationAvailable, setIrrigationAvailable] =
    useState<IrrigationChoice>(() =>
      profile ? (profile.irrigation.available ? "yes" : "no") : "",
    );
  const [submission, setSubmission] = useState<SubmissionState>({
    status: "idle",
    message: "",
  });

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
      {profile && (
        <p className="mt-2 text-[13px] text-[#5d6a60]">
          Prefilled from your farm profile.{" "}
          <Link
            href="/profile"
            className="font-semibold text-[#1d4d31] underline-offset-2 hover:underline"
          >
            Edit profile
          </Link>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <SectionShell step={1} title="Farm Location" required>
          <FarmLocationSearch
            value={selectedLocation}
            onChange={setSelectedLocation}
          />
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
                  defaultValue={profile?.farm.size}
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
                  defaultValue={profile?.farm.sizeUnit ?? "acres"}
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
              <select
                name="soilType"
                className={fieldClass}
                defaultValue={profile?.soilType ?? ""}
              >
                <option value="">Select soil type</option>
                {SOIL_OPTIONS.map((soil) => (
                  <option key={soil} value={soil}>
                    {soil}
                  </option>
                ))}
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
                {CROP_OPTIONS.map((crop) => (
                  <ChoiceCard
                    key={crop}
                    name="currentCrops"
                    value={crop}
                    label={crop}
                    type="checkbox"
                    variant="chip"
                    defaultChecked={profile?.currentCrops.includes(crop)}
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
                  {IRRIGATION_CHOICES.map(({ label, value }) => (
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
                  defaultValue={profile?.irrigation.method ?? ""}
                  disabled={irrigationAvailable !== "yes"}
                  required={irrigationAvailable === "yes"}
                >
                  <option value="">Select a method</option>
                  {IRRIGATION_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
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
