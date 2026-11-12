import { CalendarRange, CircleAlert, CircleCheck, CircleX, Info, Scale as ScaleIcon, Timer, type LucideIcon } from "lucide-react";

import type { CropRecommendation, FarmInputs } from "@/lib/crop-analysis";
import {
  allChecksPass,
  buildChecks,
  capitalize,
  formatWeight,
  rainCoverage,
  shortMonth,
  summaryLine,
  TOTAL_CHECKS,
  type Check,
  type Scale,
  type Tone as CheckTone,
} from "@/lib/crop-insights";
import { HelpText, Panel, Pill, SowChart, Spec, SpecGrid } from "@/components/shared/ui-kit";
import { cn } from "@/lib/utils";

import { CropIcon, LEVEL_TONE, seasonMonths } from "./parts";

const CHECK_TONE: Record<CheckTone, { icon: LucideIcon; iconClass: string; pill: "good" | "warn" | "bad" }> = {
  good: { icon: CircleCheck, iconClass: "text-forest-mid", pill: "good" },
  fair: { icon: CircleAlert, iconClass: "text-marigold-ink", pill: "warn" },
  poor: { icon: CircleX, iconClass: "text-clay", pill: "bad" },
};

const SCALE_INK: Record<Check["kind"], { band: string; marker: string; value: string }> = {
  warmth: { band: "bg-clay/20", marker: "bg-clay", value: "text-clay" },
  water: { band: "bg-sow/20", marker: "bg-sow", value: "text-sow" },
  soil: { band: "bg-forest/15", marker: "bg-forest", value: "text-forest" },
};

/** Where this land sits against the crop's best and tolerable range. */
function RangeBar({ scale, kind }: { scale: Scale; kind: Check["kind"] }) {
  const ink = SCALE_INK[kind];
  return (
    <div className="mt-3 max-w-[560px]" aria-hidden="true">
      <div className="relative h-2.5 rounded-full bg-line-soft">
        <span
          className={cn("absolute inset-y-0 rounded-full", ink.band)}
          style={{ left: `${scale.bestStart}%`, width: `${scale.bestEnd - scale.bestStart}%` }}
        />
        <span
          className={cn("absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_3px_rgb(18_48_31/0.35)]", ink.marker)}
          style={{ left: `${scale.marker}%` }}
        />
      </div>
      <div className="tabular mt-1.5 flex justify-between gap-2 text-[12.5px] text-ink-mute">
        <span>{scale.lowLabel}</span>
        <span className={cn("font-semibold", ink.value)}>{scale.valueLabel}</span>
        <span>{scale.highLabel}</span>
      </div>
    </div>
  );
}

function CheckRow({ check, rec }: { check: Check; rec: CropRecommendation }) {
  const tone = CHECK_TONE[check.tone];
  const Icon = tone.icon;
  return (
    <li className="grid gap-x-4 gap-y-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[170px_minmax(0,1fr)]">
      <div className="flex items-center gap-2 sm:block">
        <p className="flex items-center gap-2 font-heading text-[15px] font-bold text-ink">
          <Icon aria-hidden="true" className={cn("size-[18px] shrink-0", tone.iconClass)} />
          {check.name.replace(/ check$/, "")}
        </p>
        <Pill tone={tone.pill} className="sm:mt-2">
          {check.status}
        </Pill>
      </div>
      <div className="min-w-0">
        <p className="text-[14.5px] leading-[1.6] text-ink-soft">{check.text}</p>
        {check.scale && <RangeBar scale={check.scale} kind={check.kind} />}
        {check.kind === "water" && (
          <p className="mt-2 text-[13px] text-ink-mute">
            Rain alone covers <span className="tabular font-semibold text-sow">{rainCoverage(rec)}%</span> of the
            minimum it needs.
          </p>
        )}
      </div>
    </li>
  );
}

function harvestFigure(rec: CropRecommendation, acres: number | null) {
  if (rec.harvestLbTotal !== null && acres !== null) {
    return { value: formatWeight(rec.harvestLbTotal), note: `of ${rec.harvestWhat} on ${acres.toLocaleString("en-US")} acres` };
  }
  if (rec.harvestLbPerAcre !== null) {
    return { value: formatWeight(rec.harvestLbPerAcre), note: `of ${rec.harvestWhat} per acre` };
  }
  return { value: "Not estimated", note: "Fit too weak to project a yield" };
}

/** The answer: the best-matching crop, laid out like the back of a seed packet. */
export function TopCropCard({ rec, farm }: { rec: CropRecommendation; farm: FarmInputs }) {
  const checks = buildChecks(rec, farm);
  const checkedCount = Object.keys(rec.factors).length;
  const harvest = harvestFigure(rec, farm.acres);
  const season =
    rec.plantMonth && rec.harvestMonth ? `${shortMonth(rec.plantMonth)} → ${shortMonth(rec.harvestMonth)}` : "Year-round";

  return (
    <Panel tone="readout" as="article" className="animate-rise p-5 sm:p-7" aria-labelledby="top-crop-heading">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <CropIcon category={rec.category} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 id="top-crop-heading" className="font-display text-[clamp(1.9rem,3.2vw,2.6rem)] leading-[1.05] text-ink">
                {rec.crop}
              </h2>
              <Pill tone={LEVEL_TONE[rec.level]}>{rec.level}</Pill>
            </div>
            <p className="mt-1.5 text-[14.5px] text-ink-mute">
              {capitalize(rec.category)} · grown for {rec.harvestWhat}
            </p>
            <p className="mt-3 flex items-start gap-2 text-[14.5px] font-semibold text-forest">
              {allChecksPass(rec) ? (
                <CircleCheck aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-marigold-ink" />
              )}
              {summaryLine(rec)}
            </p>
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="tabular font-display text-[52px] leading-none text-forest">
            {rec.score}
            <span className="text-[20px] text-ink-mute">/100</span>
          </p>
          <p className="mt-1.5 text-[13px] text-ink-mute">
            Match score · {checkedCount} of {TOTAL_CHECKS} checks
          </p>
        </div>
      </header>

      <SpecGrid className="mt-6">
        <Spec label="Plant → harvest" icon={CalendarRange} tone="forest" value={season} />
        <Spec label="Days to harvest" icon={Timer} value={`~${rec.seasonDays}`} />
        <Spec
          label="Expected harvest"
          icon={ScaleIcon}
          tone="marigold"
          value={harvest.value}
          note={harvest.note}
        />
        <Spec
          label="Yield rate"
          value={rec.harvestLbPerAcre === null ? "—" : formatWeight(rec.harvestLbPerAcre)}
          note={rec.harvestLbPerAcre === null ? "Not estimated" : "per acre, good-year yield × match"}
        />
      </SpecGrid>

      <SowChart
        className="mt-6"
        title="Growing season"
        legend={
          rec.plantMonth && rec.harvestMonth
            ? { window: `Plant in ${rec.plantMonth}, harvest by ${rec.harvestMonth}`, off: "Off season" }
            : { window: "Grows year-round once planted" }
        }
        months={seasonMonths(rec).map((state) => ({ state }))}
      />

      <section aria-labelledby="checks-heading" className="mt-7 border-t border-line pt-6">
        <h3 id="checks-heading" className="font-heading text-[17px] font-bold text-ink">
          How it fits your land
        </h3>
        <ul className="mt-4 divide-y divide-line-soft">
          {checks.map((check) => (
            <CheckRow key={check.kind} check={check} rec={rec} />
          ))}
        </ul>
        {rec.missing.length > 0 && (
          <HelpText className="mt-4 flex items-start gap-2">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              {capitalize(rec.missing.join(" and "))} {rec.missing.length > 1 ? "are" : "is"} not checked yet. Add
              soil details on the Crop Finder form for a sharper score.
            </span>
          </HelpText>
        )}
      </section>
    </Panel>
  );
}
