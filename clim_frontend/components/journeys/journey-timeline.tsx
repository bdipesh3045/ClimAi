"use client";

import { ACTION_LABELS, formatDate, sortedEntries, type Journey } from "@/lib/journeys";
import { ActionIcon } from "@/components/journeys/parts";

/** Everything done to the crop, newest first. */
export function JourneyTimeline({ journey }: { journey: Journey }) {
  const entries = sortedEntries(journey);
  return (
    <ol className="relative mt-5" aria-label={`${journey.crop} journey timeline`}>
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
          {index < entries.length - 1 && (
            <span className="absolute top-10 bottom-0 left-[17px] w-px bg-line" aria-hidden="true" />
          )}
          <ActionIcon type={entry.type} />
          <div className="min-w-0 flex-1 pt-1">
            <p className="flex flex-wrap items-baseline gap-x-2 text-[14.5px]">
              <span className="font-semibold text-ink">{ACTION_LABELS[entry.type]}</span>
              <time dateTime={entry.date} className="text-[13px] text-ink-mute">
                {formatDate(entry.date)}
              </time>
            </p>
            <p className="mt-0.5 text-[14px] leading-[1.55] text-ink-soft">{entry.details}</p>
            {entry.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- user photos are object URLs
              <img
                src={entry.photoUrl}
                alt={`Photo from ${formatDate(entry.date)}: ${entry.details}`}
                className="mt-2.5 h-32 w-full max-w-[260px] rounded-[10px] border border-line object-cover"
              />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
