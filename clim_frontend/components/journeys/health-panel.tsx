"use client";

import { useEffect, useRef, useState } from "react";
import { Leaf, RotateCcw, ScanLine } from "lucide-react";
import { Panel, PanelHead, Pill, buttonClass } from "@/components/shared/ui-kit";
import { useAuth } from "@/components/providers/auth-provider";
import { useJourneys } from "@/components/journeys/journey-store";
import { HealthResult } from "@/components/plant-health/health-result";
import { todayIso, type Journey } from "@/lib/journeys";
import { cropFromName, cropLabel, type PlantCheckResult } from "@/lib/plant-check";
import { requestPlantCheck, shrinkPhoto } from "@/lib/plant-check-client";

// The real plant health check (POST /api/plant-check: Pl@ntNet, Gemini fallback, weather-aware
// advice), run for this journey's crop and field. A saved result becomes a timeline photo entry,
// so the crop expert reacts to the diagnosis too.

const MAX_ENTRY_CHARACTERS = 480; // the journey API keeps entry details under 500

type State =
  | { status: "idle" }
  | { status: "checking"; photo: string }
  | { status: "done"; photo: string; blob: Blob; result: PlantCheckResult; saved: boolean }
  | { status: "error"; message: string; photo: string | null };

/** The timeline note for a check: the diagnosis, its probability and the advice summary. */
function entryText(result: PlantCheckResult) {
  const top = result.disease.top;
  const by = result.source === "plantnet" ? "Pl@ntNet" : "AI estimate";
  const finding =
    result.disease.healthy || !top
      ? `Health check: no disease found${top ? ` (${Math.round(top.score * 100)}% probability, ${by})` : ""}.`
      : `Health check: possible ${top.name} (${Math.round(top.score * 100)}% probability, ${by}).`;
  const text = result.advice ? `${finding} ${result.advice.summary}` : finding;
  return text.length > MAX_ENTRY_CHARACTERS ? `${text.slice(0, MAX_ENTRY_CHARACTERS - 1).trimEnd()}…` : text;
}

export function HealthPanel({ journey }: { journey: Journey }) {
  const { addEntry } = useJourneys();
  const { state: auth } = useAuth();
  const profile = auth.status === "signed-in" ? auth.account.profile : null;
  const coords = journey.coordinates ?? profile?.coordinates ?? null;
  const crop = cropFromName(journey.crop);
  const [state, setState] = useState<State>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function check(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setState({ status: "error", message: "Choose a JPG or PNG photo.", photo: null });
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const photo = URL.createObjectURL(file);
    setState({ status: "checking", photo });
    try {
      const blob = await shrinkPhoto(file);
      const result = await requestPlantCheck(blob, crop, coords, abort.signal);
      if (!abort.signal.aborted) setState({ status: "done", photo, blob, result, saved: false });
    } catch (error) {
      if (abort.signal.aborted) return;
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "The plant health check is not available right now.",
        photo,
      });
    }
  }

  function saveToTimeline() {
    if (state.status !== "done") return;
    addEntry(journey.id, {
      date: todayIso(),
      type: "photo",
      details: entryText(state.result),
      photoUrl: state.photo,
      photo: state.blob, // the same shrunk photo that was checked
    });
    setState({ ...state, saved: true });
  }

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="health-heading" aria-busy={state.status === "checking"}>
      <PanelHead
        id="health-heading"
        icon={ScanLine}
        title="Plant health check"
        description={`Upload a close photo of a ${journey.crop.toLowerCase()} leaf. Pl@ntNet checks it for disease, and the advice uses this field’s weather.`}
        action={<Pill tone="good">Pl@ntNet + AI</Pill>}
      />
      <input id="health-photo" type="file" accept="image/jpeg,image/png,image/*" onChange={check} className="sr-only" />

      {state.status === "idle" && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-[12px] border border-dashed border-[#c8cfc0] bg-paper px-4 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-forest-tint text-forest">
            <Leaf size={20} aria-hidden="true" />
          </span>
          <label htmlFor="health-photo" className={buttonClass({ className: "cursor-pointer" })}>
            Upload leaf photo
          </label>
          <p className="text-[12.5px] text-ink-mute">
            Checked as {cropLabel(crop)}
            {coords ? " with this field’s weather" : ", without weather (no field location)"}. One leaf filling most of
            the photo works best.
          </p>
        </div>
      )}

      {state.status !== "idle" && state.photo && (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img
          src={state.photo}
          alt="Leaf photo being checked"
          className="mt-4 h-40 w-full rounded-[10px] border border-line object-cover"
        />
      )}

      <div aria-live="polite">
        {state.status === "checking" && (
          <div className="mt-4 space-y-2">
            <p className="text-[14.5px] font-semibold text-ink">Checking the leaf with Pl@ntNet…</p>
            <p className="text-[13px] text-ink-mute">This takes a few seconds, longer if the AI needs to look too.</p>
            <div className="skeleton h-2 w-full rounded-full" />
          </div>
        )}
        {state.status === "error" && (
          <p role="alert" className="mt-4 rounded-[10px] bg-clay-tint px-3.5 py-3 text-[13.5px] text-clay-ink">
            {state.message}
          </p>
        )}
        {state.status === "done" && (
          <div className="mt-4">
            <HealthResult result={state.result} />
          </div>
        )}
      </div>

      {(state.status === "done" || state.status === "error") && (
        <div className="mt-4 flex flex-wrap gap-3">
          {state.status === "done" && (
            <button
              type="button"
              onClick={saveToTimeline}
              disabled={state.saved}
              className={buttonClass({ variant: state.saved ? "secondary" : "primary", size: "sm" })}
            >
              {state.saved ? "Added to timeline" : "Add to timeline"}
            </button>
          )}
          <label htmlFor="health-photo" className={buttonClass({ variant: "ghost", size: "sm", className: "cursor-pointer" })}>
            <RotateCcw size={14} aria-hidden="true" />
            {state.status === "error" ? "Try another photo" : "Check another photo"}
          </label>
        </div>
      )}
    </Panel>
  );
}
