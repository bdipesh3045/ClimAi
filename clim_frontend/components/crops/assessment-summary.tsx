"use client";

import { CheckCircle2, Code2, Droplets, Flag, Leaf, MapPin, Ruler, Sprout, TriangleAlert } from "lucide-react";
import { LocationMap } from "@/components/shared/location-map";
import { Panel, PanelHead, Pill, SourceNote, Spec, SpecGrid } from "@/components/shared/ui-kit";

/**
 * Presents the Crop Finder endpoint's response. Today that endpoint echoes the
 * submission back as `received`; this lays that echo out as a readable
 * receipt. Nothing is inferred or scored here, and any response shape it does
 * not recognise is still shown in full under "Raw response".
 */

type Received = {
  location?: string;
  coordinates?: { lat: number; lon: number } | null;
  farm?: { size?: number; sizeUnit?: string; fieldCount?: number };
  soilType?: string | null;
  currentCrops?: string[];
  irrigation?: { available?: boolean; method?: string | null };
  goals?: string[];
  challenges?: string[];
  plantingSeason?: string;
  harvestHistory?: { previousCrop?: string; notes?: string };
  otherNotes?: string;
};

function readResponse(value: unknown): { message: string | null; received: Received | null } {
  if (typeof value !== "object" || value === null) return { message: null, received: null };
  const record = value as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : null;
  const received =
    typeof record.received === "object" && record.received !== null ? (record.received as Received) : null;
  return { message, received };
}

function List({ items, empty }: { items?: string[]; empty: string }) {
  if (!items || items.length === 0) return <p className="text-[14px] text-ink-mute">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item}>
          <Pill tone="neutral" className="text-[13px]">
            {item}
          </Pill>
        </li>
      ))}
    </ul>
  );
}

export function AssessmentSummary({ response }: { response: unknown }) {
  const { message, received } = readResponse(response);
  const coordinates =
    received?.coordinates &&
    typeof received.coordinates.lat === "number" &&
    typeof received.coordinates.lon === "number"
      ? received.coordinates
      : null;

  return (
    <Panel tone="readout" className="animate-rise overflow-hidden" aria-labelledby="crop-analysis-result-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-forest-tint/60 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-forest" aria-hidden="true" />
          <div>
            <h2 id="crop-analysis-result-heading" className="font-heading text-[18px] font-bold text-ink">
              Assessment received
            </h2>
            <p className="mt-0.5 text-[14px] text-ink-soft">
              {message ?? "The Crop Finder endpoint responded."} Below is what it received.
            </p>
          </div>
        </div>
        <Pill tone="warn">Recommendations not computed yet</Pill>
      </div>

      {received ? (
        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <div className="space-y-4">
              <div className="flex items-start gap-2.5">
                <MapPin size={18} className="mt-0.5 shrink-0 text-forest-mid" aria-hidden="true" />
                <p className="text-[15px] leading-[1.5] font-semibold text-ink">
                  {received.location || "No location label"}
                </p>
              </div>
              <SpecGrid columns={2}>
                <Spec
                  label="Farm size"
                  icon={Ruler}
                  value={
                    typeof received.farm?.size === "number"
                      ? `${received.farm.size} ${received.farm.sizeUnit ?? ""}`.trim()
                      : "—"
                  }
                />
                <Spec label="Fields" value={received.farm?.fieldCount ?? "—"} />
                <Spec label="Soil type" icon={Leaf} value={received.soilType || "Not given"} />
                <Spec
                  label="Irrigation"
                  icon={Droplets}
                  tone="sow"
                  value={received.irrigation?.available ? received.irrigation.method || "Yes" : "None"}
                />
              </SpecGrid>
            </div>
            {coordinates ? (
              <LocationMap
                lat={coordinates.lat}
                lon={coordinates.lon}
                label={received.location || "the farm"}
                className="min-h-[240px]"
              />
            ) : (
              <div className="flex min-h-[200px] items-center justify-center rounded-[12px] border border-dashed border-line bg-paper text-[14px] text-ink-mute">
                No coordinates were submitted.
              </div>
            )}
          </div>

          <dl className="grid gap-x-8 gap-y-5 border-t border-line-soft pt-5 md:grid-cols-2">
            <div>
              <dt className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute">
                <Sprout size={15} aria-hidden="true" /> Crops grown now
              </dt>
              <dd>
                <List items={received.currentCrops} empty="None selected" />
              </dd>
            </div>
            <div>
              <dt className="mb-2 text-[13px] font-semibold text-ink-mute">Planting season</dt>
              <dd className="font-display text-[19px] text-ink">{received.plantingSeason || "—"}</dd>
            </div>
            <div>
              <dt className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute">
                <Flag size={15} aria-hidden="true" /> Goals
              </dt>
              <dd>
                <List items={received.goals} empty="No goals selected" />
              </dd>
            </div>
            <div>
              <dt className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute">
                <TriangleAlert size={15} aria-hidden="true" /> Challenges
              </dt>
              <dd>
                <List items={received.challenges} empty="No challenges selected" />
              </dd>
            </div>
            {(received.harvestHistory?.previousCrop || received.harvestHistory?.notes) && (
              <div>
                <dt className="mb-2 text-[13px] font-semibold text-ink-mute">Previous crop and harvest</dt>
                <dd className="text-[14.5px] leading-[1.6] text-ink-soft">
                  {received.harvestHistory?.previousCrop && (
                    <span className="font-semibold text-ink">{received.harvestHistory.previousCrop}. </span>
                  )}
                  {received.harvestHistory?.notes}
                </dd>
              </div>
            )}
            {received.otherNotes && (
              <div>
                <dt className="mb-2 text-[13px] font-semibold text-ink-mute">Other notes</dt>
                <dd className="text-[14.5px] leading-[1.6] text-ink-soft">{received.otherNotes}</dd>
              </div>
            )}
          </dl>

          <PanelHead
            as="h3"
            title="What happens next"
            description="This endpoint stores and acknowledges your farm details; it does not return crop recommendations yet. For data-backed answers today, compare seasons or find a planting window for this location."
          />
        </div>
      ) : (
        <p className="px-5 py-5 text-[14px] text-ink-soft sm:px-6">
          The response did not include the submitted details. See the raw response below.
        </p>
      )}

      <details className="group border-t border-line">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-[13.5px] font-semibold text-ink-soft hover:bg-paper sm:px-6">
          <Code2 size={16} aria-hidden="true" />
          Raw response
          <span className="ml-auto text-[12.5px] font-normal text-ink-mute group-open:hidden">Show JSON</span>
        </summary>
        <pre className="max-h-[420px] overflow-auto border-t border-line bg-paper px-5 py-4 font-mono text-[12.5px] leading-[1.6] text-ink-soft sm:px-6">
          {JSON.stringify(response, null, 2)}
        </pre>
      </details>
      <SourceNote className="border-t border-line px-5 py-3 sm:px-6">
        Shown exactly as returned by the configured Crop Finder endpoint.
      </SourceNote>
    </Panel>
  );
}
