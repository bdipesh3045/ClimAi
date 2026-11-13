"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Leaf, RotateCcw, ScanLine, TriangleAlert } from "lucide-react";
import { Panel, PanelHead, Pill, buttonClass } from "@/components/shared/ui-kit";
import { useJourneys } from "@/components/journeys/journey-store";
import { todayIso, type Journey } from "@/lib/journeys";
// PLUG-IN: swap mockHealthCheck for the real image model call (same input and output types).
import { mockHealthCheck, type HealthResult } from "@/lib/journeys-mock";

type State =
  | { status: "idle" }
  | { status: "analyzing"; photo: string }
  | { status: "done"; photo: string; result: HealthResult; saved: boolean }
  | { status: "error"; message: string };

export function HealthPanel({ journey }: { journey: Journey }) {
  const { addEntry } = useJourneys();
  const [state, setState] = useState<State>({ status: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);
  const run = useRef(0);

  useEffect(() => () => {
    run.current += 1; // ignore a check that finishes after the panel unmounts
  }, []);

  async function check(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setState({ status: "error", message: "Choose an image file." });
    const photo = URL.createObjectURL(file);
    const id = (run.current += 1);
    setState({ status: "analyzing", photo });
    // ---- PLUG-IN POINT: the real image model response replaces this mock ----
    const result = await mockHealthCheck(file, journey.crop);
    if (id === run.current) setState({ status: "done", photo, result, saved: false });
  }

  function saveToTimeline() {
    if (state.status !== "done") return;
    const { result } = state;
    const percent = Math.round(result.confidence * 100);
    addEntry(journey.id, {
      date: todayIso(),
      type: "photo",
      details:
        result.status === "healthy"
          ? `Health check: no defect detected (${percent}% confidence).`
          : `Health check: possible ${result.name} (${percent}% confidence).`,
      photoUrl: state.photo,
    });
    setState({ ...state, saved: true });
  }

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="health-heading">
      <PanelHead
        id="health-heading"
        icon={ScanLine}
        title="Plant health check"
        description={`Upload a close photo of a ${journey.crop.toLowerCase()} leaf to check it for disease.`}
        action={<Pill tone="warn">Demo data</Pill>}
      />
      <input ref={fileRef} id="health-photo" type="file" accept="image/*" onChange={check} className="sr-only" />

      {state.status === "idle" || state.status === "error" ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-[12px] border border-dashed border-[#c8cfc0] bg-paper px-4 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-forest-tint text-forest">
            <Leaf size={20} aria-hidden="true" />
          </span>
          <label htmlFor="health-photo" className={buttonClass({ className: "cursor-pointer" })}>
            Upload leaf photo
          </label>
          <p className={state.status === "error" ? "text-[13px] text-clay" : "text-[12.5px] text-ink-mute"}>
            {state.status === "error" ? state.message : "JPG or PNG, one leaf filling most of the photo."}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={state.photo} alt="Leaf photo being checked" className="h-36 w-full rounded-[10px] border border-line object-cover sm:w-[140px]" />
          <div aria-live="polite" className="min-w-0">
            {state.status === "analyzing" ? (
              <div className="flex h-full flex-col justify-center gap-2">
                <p className="text-[14.5px] font-semibold text-ink">Analyzing the leaf…</p>
                <div className="skeleton h-2 w-full rounded-full" />
              </div>
            ) : (
              <HealthResultView result={state.result} />
            )}
          </div>
        </div>
      )}

      {state.status === "done" && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveToTimeline}
            disabled={state.saved}
            className={buttonClass({ variant: state.saved ? "secondary" : "primary", size: "sm" })}
          >
            {state.saved ? "Added to timeline" : "Add to timeline"}
          </button>
          <label htmlFor="health-photo" className={buttonClass({ variant: "ghost", size: "sm", className: "cursor-pointer" })}>
            <RotateCcw size={14} aria-hidden="true" />
            Check another photo
          </label>
        </div>
      )}
    </Panel>
  );
}

function HealthResultView({ result }: { result: HealthResult }) {
  const percent = Math.round(result.confidence * 100);
  if (result.status === "healthy") {
    return (
      <div>
        <p className="flex items-center gap-2 text-[16px] font-semibold text-forest">
          <CheckCircle2 size={18} aria-hidden="true" />
          No defect detected
        </p>
        <Confidence percent={percent} tone="bg-forest" />
      </div>
    );
  }
  return (
    <div>
      <p className="flex items-center gap-2 text-[16px] font-semibold text-clay">
        <TriangleAlert size={18} aria-hidden="true" />
        {result.name}
      </p>
      <Confidence percent={percent} tone="bg-clay" />
      <p className="mt-2 text-[13px] leading-[1.5] text-ink-soft">Check nearby plants and confirm with your extension office before treating.</p>
    </div>
  );
}

function Confidence({ percent, tone }: { percent: number; tone: string }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[12.5px] text-ink-mute">
        <span>Confidence</span>
        <span className="tabular font-semibold text-ink">{percent}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line-soft">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
