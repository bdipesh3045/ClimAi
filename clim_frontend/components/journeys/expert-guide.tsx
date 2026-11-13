"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Eye, GraduationCap, MessageCircle, Undo2 } from "lucide-react";
import { Panel, PanelHead, Pill, buttonClass } from "@/components/shared/ui-kit";
import { useJourneys } from "@/components/journeys/journey-store";
import {
  ACTION_LABELS,
  daysSinceSowing,
  formatDate,
  sortedEntries,
  stageFor,
  stageRanges,
  todayIso,
  type Journey,
} from "@/lib/journeys";
// PLUG-IN: the AI crop expert replaces MOCK_EXPERT_GUIDE and mockExpertReaction (same shapes).
import { expertGuideFor, mockExpertReaction } from "@/lib/journeys-mock";
import { cn } from "@/lib/utils";

/** The expert walking the farmer through each stage: what to do now, why, and what to watch for. */
export function ExpertGuide({ journey }: { journey: Journey }) {
  const { doneSteps, setStepDone, addEntry } = useJourneys();
  const stages = stageRanges(journey);
  const current = stageFor(journey);
  const currentIndex = stages.findIndex((s) => s.name === current);
  const [viewing, setViewing] = useState(currentIndex);

  const stageName = stages[viewing].name;
  // ---- PLUG-IN POINT: guidance for this stage comes from the AI expert ----
  const playbook = expertGuideFor(journey.crop);
  const guide = playbook.stages.find((g) => g.stage === stageName);
  const done = new Set(doneSteps[journey.id] ?? []);
  const doneCount = guide ? guide.steps.filter((step) => done.has(step.id)).length : 0;
  const latest = sortedEntries(journey)[0];
  const day = daysSinceSowing(journey);
  const when = viewing === currentIndex ? "now" : viewing < currentIndex ? "past" : "next";

  function markDone(stepId: string, title: string, logsAs: Parameters<typeof mockExpertReaction>[0]) {
    setStepDone(journey.id, stepId, true);
    addEntry(journey.id, { date: todayIso(), type: logsAs, details: `${title}. Done, following the expert guide.` });
  }

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="expert-heading">
      <PanelHead
        id="expert-heading"
        icon={GraduationCap}
        title="Your crop expert"
        description={
          playbook.general
            ? `General guidance for each stage, from sowing to harvest. A ${journey.crop.toLowerCase()}-specific playbook comes with the AI expert.`
            : `Guidance for each stage of your ${journey.crop.toLowerCase()}, from sowing to harvest.`
        }
        action={<Pill tone="warn">Demo data</Pill>}
      />

      {/* Stage stepper */}
      <ol className="-mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1 pt-1 pb-2" aria-label="Season stages">
        {stages.map((stage, index) => {
          const state = index < currentIndex ? "past" : index === currentIndex ? "current" : "future";
          return (
            <li key={stage.name} className="min-w-[112px] flex-1">
              <button
                type="button"
                onClick={() => setViewing(index)}
                aria-current={state === "current" ? "step" : undefined}
                aria-pressed={viewing === index}
                className={cn(
                  "flex w-full flex-col items-start gap-1 rounded-[10px] border px-2.5 py-2 text-left transition-colors sm:px-3",
                  state === "current" && "border-forest bg-forest text-white",
                  state === "past" && "border-line bg-forest-tint text-forest hover:border-forest-mid/40",
                  state === "future" && "border-line bg-panel text-ink-mute hover:border-forest-mid/40",
                  viewing === index && "ring-2 ring-marigold ring-offset-1",
                )}
              >
                <span className="flex w-full items-center gap-1 text-[13px] font-semibold whitespace-nowrap">
                  {state === "past" && <Check size={13} className="shrink-0" aria-hidden="true" />}
                  <span>{stage.name === "Ready to harvest" ? "Harvest" : stage.name}</span>
                </span>
                <span className={cn("text-[11.5px] whitespace-nowrap", state === "current" ? "text-white/75" : "text-ink-mute")}>
                  {stage.name === "Ready to harvest" ? `Day ${stage.fromDay}` : `Day ${stage.fromDay}–${stage.toDay}`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {guide && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* What to do */}
          <div className="min-w-0">
            <div className="flex gap-3 rounded-[12px] bg-forest-tint/60 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest text-white">
                <GraduationCap size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-forest">
                  {when === "now"
                    ? `${stageName}, day ${day}`
                    : when === "past"
                      ? `${stageName} (done)`
                      : `Coming up: ${stageName}, from day ${stages[viewing].fromDay}`}
                </p>
                <p className="mt-1 text-[14.5px] leading-[1.55] text-ink">{guide.summary}</p>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-bold text-ink">
                {when === "now" ? "What to do now" : when === "past" ? "Steps from this stage" : "What you'll need to do"}
              </h3>
              <span className="tabular text-[12.5px] text-ink-mute">
                {doneCount} of {guide.steps.length} done
              </span>
            </div>
            <ul className="mt-2 divide-y divide-line-soft">
              {guide.steps.map((step) => {
                const isDone = done.has(step.id);
                return (
                  <li key={step.id} className="flex items-start gap-3 py-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
                        isDone ? "border-forest bg-forest text-white" : "border-line bg-panel",
                      )}
                      aria-hidden="true"
                    >
                      {isDone && <Check size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[14.5px] font-semibold", isDone ? "text-ink-mute line-through" : "text-ink")}>
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[13.5px] leading-[1.5] text-ink-soft">{step.why}</p>
                    </div>
                    {isDone ? (
                      <button
                        type="button"
                        onClick={() => setStepDone(journey.id, step.id, false)}
                        className={buttonClass({ variant: "ghost", size: "sm", className: "shrink-0" })}
                        aria-label={`Mark "${step.title}" as not done`}
                      >
                        <Undo2 size={14} aria-hidden="true" />
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markDone(step.id, step.title, step.logsAs)}
                        className={buttonClass({ variant: "secondary", size: "sm", className: "shrink-0" })}
                      >
                        Mark done
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {when !== "now" && (
              <button
                type="button"
                onClick={() => setViewing(currentIndex)}
                className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-forest hover:underline"
              >
                Back to the current stage <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Expert notes */}
          <div className="flex min-w-0 flex-col gap-4">
            {latest && (
              <div className="rounded-[12px] border border-line p-4">
                <p className="text-[13px] font-semibold text-ink-soft">
                  On your last entry · {ACTION_LABELS[latest.type]}, {formatDate(latest.date)}
                </p>
                {/* ---- PLUG-IN POINT: the AI expert's reaction to the latest entry ---- */}
                <p className="mt-1.5 text-[14px] leading-[1.55] text-ink">{mockExpertReaction(latest.type, journey.crop)}</p>
              </div>
            )}
            <div className="rounded-[12px] border border-line p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
                <Eye size={14} aria-hidden="true" />
                Watch for
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-[1.5] text-ink marker:text-marigold">
                {guide.watchFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <Link href="/assistant" className={buttonClass({ variant: "secondary", className: "w-full" })}>
              <MessageCircle size={16} aria-hidden="true" />
              Ask the AI Assistant a question
            </Link>
          </div>
        </div>
      )}
    </Panel>
  );
}
