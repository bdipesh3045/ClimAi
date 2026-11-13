"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CloudRain,
  Eye,
  GraduationCap,
  ListTodo,
  MessageCircle,
  RefreshCw,
  Snowflake,
  Sun,
  Sunrise,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Panel, PanelHead, Pill, Skeleton, StateBlock, buttonClass } from "@/components/shared/ui-kit";
import { useJourneys } from "@/components/journeys/journey-store";
import { useExpert, type ExpertAlert, type ExpertData } from "@/components/journeys/use-expert";
import { JourneyAssistant } from "@/components/journeys/journey-assistant";
import type { JourneyContext } from "@/lib/assistant";
import { ACTION_LABELS, HARVEST_STAGE, formatDate, sortedEntries, todayIso, type ActionType, type Journey } from "@/lib/journeys";
import { cn } from "@/lib/utils";

const SOURCE_PILL: Record<ExpertData["source"], { label: string; tone: "good" | "warn" }> = {
  ai: { label: "AI expert", tone: "good" },
  general: { label: "General guidance", tone: "warn" },
  sample: { label: "Demo data", tone: "warn" },
};

const ALERT_ICONS: Record<ExpertAlert["kind"], LucideIcon> = {
  frost: Snowflake,
  heat: Sun,
  rain: CloudRain,
  dry: Sunrise,
  overdue: ListTodo,
};

const ALERT_TONES: Record<ExpertAlert["level"], string> = {
  warning: "border-clay/30 bg-clay-tint text-clay-ink",
  watch: "border-marigold/40 bg-marigold-tint text-marigold-ink",
  info: "border-line bg-paper text-ink-soft",
};

/** The expert walking the farmer through each stage: alerts, what to do now and why, what to watch for. */
export function ExpertGuide({ journey }: { journey: Journey }) {
  const { state, refresh, refreshing, refreshError, retry } = useExpert(journey);

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="expert-heading" aria-busy={state.status === "loading" || refreshing}>
      <PanelHead
        id="expert-heading"
        icon={GraduationCap}
        title="Your crop expert"
        description={describe(state.status === "ready" ? state.data : null, journey)}
        action={state.status === "ready" ? <Pill tone={SOURCE_PILL[state.data.source].tone}>{SOURCE_PILL[state.data.source].label}</Pill> : undefined}
      />

      {state.status === "loading" && (
        <div role="status" className="mt-5 space-y-3">
          <span className="text-[13.5px] text-ink-mute">Your expert is reviewing your field: weather, climate and everything you’ve logged…</span>
          <Skeleton className="h-14" />
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      )}

      {state.status === "error" && (
        <StateBlock
          kind="error"
          title="The crop expert isn’t reachable"
          className="mt-5"
          action={
            <button type="button" onClick={retry} className={buttonClass({ variant: "danger", size: "sm" })}>
              Try again
            </button>
          }
        >
          {state.message}
        </StateBlock>
      )}

      {state.status === "ready" && (
        <ExpertBody
          key={state.data.stage}
          journey={journey}
          data={state.data}
          refresh={refresh}
          refreshing={refreshing}
          refreshError={refreshError}
        />
      )}
    </Panel>
  );
}

function describe(data: ExpertData | null, journey: Journey) {
  const crop = journey.crop.toLowerCase();
  if (!data) return `Guidance for each stage of your ${crop}, from sowing to harvest.`;
  if (data.source === "ai") return `Written for this field from what you’ve logged, your farm, the local climate and the forecast.`;
  if (data.source === "general") return `General guidance for each stage. The AI expert is unavailable right now, so this isn’t specific to your field yet.`;
  return `Guidance for each stage of your ${crop}, from sowing to harvest.`;
}

function ExpertBody({
  journey,
  data,
  refresh,
  refreshing,
  refreshError,
}: {
  journey: Journey;
  data: ExpertData;
  refresh: () => Promise<void>;
  refreshing: boolean;
  refreshError: string | null;
}) {
  const { doneSteps, setStepDone, addEntry } = useJourneys();
  const stages = data.stages;
  const currentIndex = Math.max(0, stages.findIndex((s) => s.stage === data.stage));
  const [viewing, setViewing] = useState(currentIndex);
  useEffect(() => setViewing(currentIndex), [currentIndex]);

  const guide = stages[viewing];
  const done = new Set(doneSteps[journey.id] ?? []);
  const doneCount = guide.steps.filter((step) => done.has(step.id)).length;
  const latest = sortedEntries(journey)[0];
  const when = viewing === currentIndex ? "now" : viewing < currentIndex ? "past" : "next";
  const [chatOpen, setChatOpen] = useState(false);
  const closeChat = useCallback(() => setChatOpen(false), []);

  // What the assistant knows about this journey: stage, timeline, the expert's steps and the real alerts.
  const current = stages[currentIndex];
  const chatContext: JourneyContext = {
    crop: journey.crop,
    location: journey.location,
    sownOn: journey.sownOn,
    day: data.day,
    seasonDays: journey.seasonDays,
    stage: data.stage,
    entries: [...journey.entries]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((e) => ({ date: e.date, type: e.type, details: e.details.slice(0, 200) })),
    alerts: data.alerts.map((a) => ({ title: a.title, detail: a.detail })),
    currentSteps: current ? current.steps.filter((s) => !done.has(s.id)).map((s) => s.title) : [],
  };
  const crop = journey.crop.toLowerCase();
  const chatSuggestions = [
    `What should I do this week for my ${crop}?`,
    "Is this a good week to spray or fertilize?",
    `What pests or diseases should I watch for at the ${data.stage.toLowerCase()} stage?`,
    `How will the coming weather affect my ${crop}?`,
    "When should I plan the harvest?",
  ];

  function markDone(stepId: string, title: string, logsAs: ActionType) {
    setStepDone(journey.id, stepId, true);
    addEntry(journey.id, { date: todayIso(), type: logsAs, details: `${title}. Done, following the expert guide.` });
  }

  return (
    <>
      {/* Right now on your field: deterministic alerts from the forecast */}
      {(data.alerts.length > 0 || data.warnings.length > 0) && (
        <div className="mt-5">
          <h3 className="text-[13px] font-semibold text-ink-soft">Right now on your field</h3>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {data.alerts.map((alert) => {
              const Icon = ALERT_ICONS[alert.kind];
              return (
                <li key={alert.kind} className={cn("flex gap-3 rounded-[12px] border px-3.5 py-3", ALERT_TONES[alert.level])}>
                  <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">{alert.title}</p>
                    <p className="mt-0.5 text-[13px] leading-[1.5]">{alert.detail}</p>
                    <p className="mt-1 text-[11.5px] opacity-80">{alert.source}</p>
                  </div>
                </li>
              );
            })}
            {data.warnings.map((warning) => (
              <li key={warning} className="rounded-[12px] border border-line bg-paper px-3.5 py-3 text-[13px] text-ink-mute">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stage stepper */}
      <ol className="-mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1 pt-1 pb-2" aria-label="Season stages">
        {stages.map((stage, index) => {
          const state = index < currentIndex ? "past" : index === currentIndex ? "current" : "future";
          return (
            <li key={stage.stage} className="min-w-[112px] flex-1">
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
                  <span>{stage.stage === HARVEST_STAGE ? "Harvest" : stage.stage}</span>
                </span>
                <span className={cn("text-[11.5px] whitespace-nowrap", state === "current" ? "text-white/75" : "text-ink-mute")}>
                  {stage.stage === HARVEST_STAGE ? `Day ${stage.fromDay}` : `Day ${stage.fromDay}–${stage.toDay}`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

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
                  ? `${guide.stage}, day ${data.day}`
                  : when === "past"
                    ? `${guide.stage} (done)`
                    : `Coming up: ${guide.stage}, from day ${guide.fromDay}`}
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
          {latest && data.reaction && (
            <div className="rounded-[12px] border border-line p-4">
              <p className="text-[13px] font-semibold text-ink-soft">
                On your last entry · {ACTION_LABELS[latest.type]}, {formatDate(latest.date)}
              </p>
              <p className="mt-1.5 text-[14px] leading-[1.55] text-ink">{data.reaction.text}</p>
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
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-haspopup="dialog"
            className={buttonClass({ variant: "secondary", className: "w-full" })}
          >
            <MessageCircle size={16} aria-hidden="true" />
            Ask the AI Assistant about this crop
          </button>
          <JourneyAssistant open={chatOpen} onClose={closeChat} journey={chatContext} suggestions={chatSuggestions} />
          {data.source !== "sample" && (
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className={buttonClass({ variant: "ghost", className: "w-full" })}
            >
              <RefreshCw size={15} className={cn(refreshing && "animate-spin")} aria-hidden="true" />
              {refreshing ? "Rewriting the advice…" : "Refresh advice"}
            </button>
          )}
          {refreshError && <p className="text-[13px] text-clay">{refreshError}</p>}
        </div>
      </div>

      <p className="mt-5 border-t border-line-soft pt-3 text-[12.5px] leading-[1.55] text-ink-mute">
        {data.source === "sample"
          ? "Sample journey with demo guidance."
          : `Based on: ${data.basedOn.join(", ")}.`}{" "}
        {data.source === "ai" && data.generatedAt && `Written ${formatDate(data.generatedAt.slice(0, 10))}. `}
        Advice, not a guarantee. Check treatments with your local extension office.
      </p>
    </>
  );
}
