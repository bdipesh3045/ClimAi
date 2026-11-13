"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Camera, ClipboardList, Plus, Route, Sprout, Trash2 } from "lucide-react";
import { Panel, PanelHead, Pill, Skeleton, Spec, SpecGrid, StateBlock, buttonClass } from "@/components/shared/ui-kit";
import { X } from "lucide-react";
import { useJourneys } from "@/components/journeys/journey-store";
import { ProgressBar } from "@/components/journeys/parts";
import { JourneyTimeline } from "@/components/journeys/journey-timeline";
import { AddEntryForm } from "@/components/journeys/add-entry-form";
import { HarvestEstimate } from "@/components/journeys/harvest-estimate";
import { HealthPanel } from "@/components/journeys/health-panel";
import { ExpertGuide } from "@/components/journeys/expert-guide";
import {
  daysSinceSowing,
  expectedHarvest,
  formatDate,
  lastPhoto,
  progress,
  stageFor,
  type Journey,
} from "@/lib/journeys";
// PLUG-IN: next expected action comes from mock rules until the AI provides it.
import { mockNextAction } from "@/lib/journeys-mock";

export function JourneyDetail({ id }: { id: string }) {
  const { journeys } = useJourneys();
  // Set while a deleted journey's page navigates away, so it never flashes "not found".
  const [leaving, setLeaving] = useState(false);

  if (journeys === null) {
    return (
      <div className="space-y-6" aria-hidden="true">
        <Skeleton className="h-[170px]" />
        <Skeleton className="h-[96px]" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const journey = journeys.find((item) => item.id === id);
  if (!journey && leaving) return <Skeleton className="h-[170px]" aria-hidden="true" />;
  if (!journey) {
    return (
      <StateBlock
        kind="empty"
        icon={Route}
        title="Journey not found"
        action={
          <Link href="/journeys" className={buttonClass({ variant: "secondary", size: "sm" })}>
            Back to my journeys
          </Link>
        }
      >
        This journey doesn’t exist or belongs to another account.
      </StateBlock>
    );
  }

  return <JourneyView journey={journey} onLeaving={setLeaving} />;
}

function JourneyView({ journey, onLeaving }: { journey: Journey; onLeaving: (leaving: boolean) => void }) {
  const [adding, setAdding] = useState(false);
  const { syncError, clearSyncError } = useJourneys();
  const day = daysSinceSowing(journey);
  const stage = stageFor(journey);
  const photo = lastPhoto(journey);
  const next = mockNextAction(journey.crop, day, journey.seasonDays);
  const share = progress(journey);

  return (
    <div className="flex flex-col gap-6">
      <DeleteJourney journey={journey} onLeaving={onLeaving} />

      {syncError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-[12px] border border-clay/30 bg-clay-tint px-4 py-3 text-[14px] text-clay-ink">
          <span>{syncError}</span>
          <button type="button" onClick={clearSyncError} aria-label="Dismiss" className="shrink-0 text-clay-ink/70 hover:text-clay-ink">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* 1. Header */}
      <Panel tone="readout" className="animate-rise p-5 sm:p-6" aria-labelledby="journey-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="journey-heading" className="font-display text-[clamp(1.75rem,2.6vw,2.4rem)] leading-[1.08] text-ink">
              {journey.crop}
            </h1>
            <p className="mt-1.5 text-[14.5px] text-ink-mute">
              {journey.location} · sown {formatDate(journey.sownOn)} · harvest expected {formatDate(expectedHarvest(journey))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="neutral">{journey.sample ? "Sample journey" : "Saved"}</Pill>
            <Pill tone="good" className="py-1.5 text-[13px]">
              {stage} — Day {day}
            </Pill>
          </div>
        </div>
        <div className="mt-6">
          <ProgressBar value={share} label="Season progress from sowing to expected harvest" />
          <div className="mt-2 flex justify-between text-[12.5px] text-ink-mute">
            <span>Sowing · {formatDate(journey.sownOn)}</span>
            <span className="tabular font-semibold text-ink">{Math.round(share * 100)}%</span>
            <span>Harvest · {formatDate(expectedHarvest(journey))}</span>
          </div>
        </div>
        <div className="mt-5">
          <HarvestEstimate journey={journey} />
        </div>
      </Panel>

      {/* 5. Journey overview strip */}
      <SpecGrid>
        <Spec label="Days since sowing" icon={Sprout} tone="forest" value={`${day}`} note={`of about ${journey.seasonDays}`} />
        <Spec
          label="Actions logged"
          icon={ClipboardList}
          value={`${journey.entries.length}`}
          note="sowing, water, sprays, notes"
        />
        <Spec
          label="Last photo"
          icon={Camera}
          tone="sow"
          value={photo ? formatDate(photo.date) : "None yet"}
          note={photo ? photo.details : "Add one from the timeline"}
        />
        <Spec
          label="Next expected action"
          icon={CalendarClock}
          tone="marigold"
          value={next ? `Day ${next.day}` : "Season complete"}
          note={next ? `${next.action}${next.day > day ? ` · in ${next.day - day} days` : " · now"}` : "Record the harvest"}
        />
      </SpecGrid>

      {/* Expert guide: walks the farmer through each stage */}
      <ExpertGuide key={journey.id} journey={journey} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* 2. Timeline */}
        <Panel className="p-5 sm:p-6" aria-labelledby="timeline-heading">
          <PanelHead
            id="timeline-heading"
            icon={Route}
            title="Journey timeline"
            description="Everything done to this crop, newest first."
            action={
              !adding && (
                <button type="button" onClick={() => setAdding(true)} className={buttonClass({ size: "sm" })}>
                  <Plus size={15} aria-hidden="true" />
                  Add entry
                </button>
              )
            }
          />
          {adding && <AddEntryForm journey={journey} onClose={() => setAdding(false)} />}
          <JourneyTimeline journey={journey} />
        </Panel>

        {/* 3 and 4. Model panels */}
        <div className="flex min-w-0 flex-col gap-6">
          <HealthPanel journey={journey} />
        </div>
      </div>
    </div>
  );
}

/** The "My journeys" link, plus Delete with an inline confirmation that says what will be lost. */
function DeleteJourney({ journey, onLeaving }: { journey: Journey; onLeaving: (leaving: boolean) => void }) {
  const { deleteJourney } = useJourneys();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const photos = journey.entries.filter((e) => e.photoUrl).length;

  async function confirm() {
    setDeleting(true);
    setError("");
    onLeaving(true);
    try {
      await deleteJourney(journey.id);
      router.replace("/journeys");
    } catch (failure) {
      onLeaving(false);
      setDeleting(false);
      setError(failure instanceof Error && failure.message ? failure.message : "The journey could not be deleted.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Link href="/journeys" className="inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-forest hover:underline">
          <ArrowLeft size={15} aria-hidden="true" />
          My journeys
        </Link>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={buttonClass({ variant: "ghost", size: "sm", className: "text-clay hover:bg-clay-tint hover:text-clay-ink" })}
          >
            <Trash2 size={15} aria-hidden="true" />
            {journey.sample ? "Remove sample" : "Delete journey"}
          </button>
        )}
      </div>
      {confirming && (
        <div
          role="alertdialog"
          aria-labelledby="delete-title"
          aria-describedby="delete-detail"
          className="flex flex-col gap-3 rounded-[12px] border border-clay/30 bg-clay-tint px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p id="delete-title" className="text-[14.5px] font-semibold text-clay-ink">
              {journey.sample ? "Remove this sample journey?" : `Delete your ${journey.crop.toLowerCase()} journey?`}
            </p>
            <p id="delete-detail" className="mt-0.5 text-[13.5px] leading-[1.5] text-clay-ink/90">
              {journey.sample
                ? "It comes back when you refresh the page."
                : `Its ${journey.entries.length} timeline entr${journey.entries.length === 1 ? "y" : "ies"}${photos ? `, ${photos} photo${photos === 1 ? "" : "s"}` : ""}, ticked steps and expert advice are removed for good.`}
            </p>
            {error && <p className="mt-1 text-[13px] font-semibold text-clay">{error}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={deleting}
              autoFocus
              className={buttonClass({ variant: "danger", size: "sm" })}
            >
              {deleting ? "Deleting…" : journey.sample ? "Remove" : "Delete journey"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError("");
              }}
              disabled={deleting}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
