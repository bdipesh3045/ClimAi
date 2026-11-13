"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Route } from "lucide-react";
import { PageIntro } from "@/components/shared/page-intro";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  Field,
  HelpText,
  Panel,
  PanelHead,
  Pill,
  Segmented,
  Skeleton,
  StateBlock,
  buttonClass,
  inputClass,
} from "@/components/shared/ui-kit";
import { useJourneys } from "@/components/journeys/journey-store";
import { ProgressBar } from "@/components/journeys/parts";
import {
  ACTION_LABELS,
  JOURNEY_CROPS,
  daysSinceSowing,
  formatDate,
  progress,
  sortedEntries,
  stageFor,
  todayIso,
  type Journey,
  type JourneyCrop,
} from "@/lib/journeys";

export function JourneyList() {
  const { journeys } = useJourneys();
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
        <ul className="grid animate-rise gap-6 md:grid-cols-2">
          {journeys.map((journey) => (
            <li key={journey.id}>
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
          {journey.sample ? " · Sample journey" : ""}
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
  const { location: savedLocation } = useAppData();
  const router = useRouter();
  const [crop, setCrop] = useState<JourneyCrop>("Soybeans");
  const [sownOn, setSownOn] = useState(todayIso());
  const [location, setLocation] = useState(savedLocation);
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!location.trim()) return setError("Add where the crop is growing.");
    if (sownOn > todayIso()) return setError("The sowing date can't be in the future.");
    const id = addJourney({ crop, sownOn, location: location.trim() });
    router.push(`/journeys/${id}`);
  }

  return (
    <Panel tone="readout" className="animate-rise p-5 sm:p-6" aria-labelledby="new-journey-heading">
      <PanelHead id="new-journey-heading" icon={Plus} title="Start a journey" description="Pick the crop and when it was sown." />
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)] md:items-end">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">Crop</p>
          <Segmented<JourneyCrop>
            ariaLabel="Crop"
            value={crop}
            onChange={setCrop}
            options={JOURNEY_CROPS.map((value) => ({ value, label: value }))}
          />
        </div>
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
        <Field label="Location" htmlFor="journey-location">
          <input
            id="journey-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Baton Rouge, Louisiana"
            className={inputClass}
          />
        </Field>
        <div className="flex gap-3 md:col-span-3">
          <button type="submit" className={buttonClass()}>
            Start journey
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
