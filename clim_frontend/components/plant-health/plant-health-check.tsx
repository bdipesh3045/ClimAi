"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, LocateFixed, ScanLine, Sprout } from "lucide-react";
import { PageIntro } from "@/components/shared/page-intro";
import { Field, HelpText, Panel, PanelHead, StateBlock, buttonClass, selectClass } from "@/components/shared/ui-kit";
import { HealthResult } from "@/components/plant-health/health-result";
import { useAppData } from "@/components/providers/app-data-provider";
import { useAccount } from "@/components/providers/auth-provider";
import { CROPS, cropFromName, cropLabel, type Coordinates, type Crop, type PlantCheckResult } from "@/lib/plant-check";
import { currentPosition, requestPlantCheck, shrinkPhoto } from "@/lib/plant-check-client";

/** The photo as it will be sent: already re-encoded, so the preview is exactly what is analyzed. */
type Photo = { blob: Blob; previewUrl: string };
type Place = { coords: Coordinates; label: string };
type State =
  | { status: "empty" }
  | { status: "preparing" }
  | { status: "ready" }
  | { status: "analyzing" }
  | { status: "done"; result: PlantCheckResult }
  | { status: "error"; message: string };

export function PlantHealthCheck() {
  const profile = useAccount()?.profile ?? null;
  const { location: savedLocation, coordinates: savedCoordinates } = useAppData();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [crop, setCrop] = useState<Crop>(() => cropFromName(profile?.currentCrops[0] ?? "other"));
  const [devicePlace, setDevicePlace] = useState<Place | null>(null);
  const [locationError, setLocationError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [state, setState] = useState<State>({ status: "empty" });
  const inFlight = useRef<AbortController | null>(null);
  const previewUrl = useRef<string | null>(null);

  // On leaving the page: stop a running check (it spends Pl@ntNet and Gemini credits) and free the preview.
  useEffect(
    () => () => {
      inFlight.current?.abort();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  // The device location wins once shared; then the workspace location; then the saved farm profile.
  const savedPlace: Place | null = savedCoordinates
    ? { coords: savedCoordinates, label: savedLocation || "your saved farm" }
    : profile
      ? { coords: profile.coordinates, label: profile.location || "your farm" }
      : null;
  const place = devicePlace ?? savedPlace;
  const isBusy = state.status === "preparing" || state.status === "analyzing";

  async function pickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    inFlight.current?.abort();
    setState({ status: "preparing" });
    try {
      // Re-encode now, not on Analyze: formats the browser cannot show (such as HEIC in Chrome)
      // fail here with a clear message instead of leaving a blank preview.
      const blob = await shrinkPhoto(file);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(blob);
      setPhoto({ blob, previewUrl: previewUrl.current });
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "This photo could not be read." });
    }
  }

  function changeCrop(value: Crop) {
    setCrop(value);
    // A result for the previous crop would now be mislabelled.
    if (state.status === "done") setState({ status: "ready" });
  }

  async function locateMe() {
    setIsLocating(true);
    setLocationError("");
    try {
      setDevicePlace({ coords: await currentPosition(), label: "your current location" });
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Your location could not be found.");
    } finally {
      setIsLocating(false);
    }
  }

  async function analyze() {
    if (!photo) return setState({ status: "error", message: "Choose a leaf photo first." });
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ status: "analyzing" });
    try {
      const result = await requestPlantCheck(photo.blob, crop, place?.coords ?? null, controller.signal);
      if (!controller.signal.aborted) setState({ status: "done", result });
    } catch (error) {
      if (controller.signal.aborted) return; // replaced by a newer check, or the page closed
      setState({ status: "error", message: error instanceof Error ? error.message : "The check failed. Please try again." });
    }
  }

  return (
    <div>
      <PageIntro
        title="Plant health check"
        description="Upload a close photo of one leaf. Pl@ntNet checks it for disease, then AI suggests what to do this week using your local weather."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Panel className="p-5 sm:p-6" aria-labelledby="photo-heading">
          <PanelHead id="photo-heading" icon={ScanLine} title="Your photo" />
          <input id="plant-photo" type="file" accept="image/*" onChange={pickPhoto} className="sr-only" disabled={isBusy} />

          <div className="mt-4">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={photo.previewUrl} alt="Leaf photo to check" className="h-56 w-full rounded-[10px] border border-line object-cover" />
            ) : (
              <label
                htmlFor="plant-photo"
                className="flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#c8cfc0] bg-paper px-3 text-center text-[13.5px] font-semibold text-forest"
              >
                {state.status === "preparing" ? (
                  <LoaderCircle size={22} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ImagePlus size={22} aria-hidden="true" />
                )}
                {state.status === "preparing" ? "Preparing photo…" : "Choose leaf photo"}
              </label>
            )}
            {photo && (
              <label htmlFor="plant-photo" className={buttonClass({ variant: "ghost", size: "sm", className: "mt-2 w-full cursor-pointer" })}>
                Change photo
              </label>
            )}
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Crop" htmlFor="plant-crop" hint="A picked crop is trusted over Pl@ntNet's plant ID. Choose Other to let Pl@ntNet name it.">
              <select id="plant-crop" value={crop} onChange={(event) => changeCrop(event.target.value as Crop)} className={selectClass} disabled={isBusy}>
                {CROPS.map((option) => (
                  <option key={option} value={option}>
                    {cropLabel(option)}
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <p className="text-[13px] font-semibold text-ink-soft">Weather location</p>
              <p className="mt-1 text-[13px] text-ink-mute">
                {place ? `Using ${place.label}.` : "No location yet, so the advice will not use weather."}
              </p>
              <button type="button" onClick={locateMe} disabled={isLocating || isBusy} className={buttonClass({ variant: "secondary", size: "sm", className: "mt-2" })}>
                <LocateFixed size={14} aria-hidden="true" />
                {isLocating ? "Finding your location…" : "Use my location"}
              </button>
              {locationError && <HelpText tone="error">{locationError}</HelpText>}
            </div>

            <div>
              <button type="button" onClick={analyze} disabled={!photo || isBusy} className={buttonClass({ className: "w-full" })}>
                {state.status === "analyzing" ? "Analyzing…" : "Analyze photo"}
              </button>
              <HelpText>JPG or PNG, one leaf filling most of the photo. It is sent to Pl@ntNet and Google Gemini for analysis.</HelpText>
            </div>
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6" aria-labelledby="result-heading">
          <PanelHead id="result-heading" icon={Sprout} title="Result" />
          <div aria-live="polite" className="mt-4">
            {(state.status === "empty" || state.status === "preparing") && (
              <StateBlock kind="empty" icon={ImagePlus} title="No photo yet">
                Choose a leaf photo on the left, then press Analyze photo.
              </StateBlock>
            )}
            {state.status === "ready" && (
              <StateBlock kind="empty" icon={ScanLine} title="Photo ready">
                Check the crop and location, then press Analyze photo.
              </StateBlock>
            )}
            {state.status === "analyzing" && (
              <StateBlock kind="loading" title="Checking the leaf…">
                This usually takes 5 to 20 seconds.
              </StateBlock>
            )}
            {state.status === "error" && (
              <StateBlock kind="error" title="The check did not finish">
                {state.message}
              </StateBlock>
            )}
            {state.status === "done" && <HealthResult result={state.result} />}
          </div>
        </Panel>
      </div>
    </div>
  );
}
