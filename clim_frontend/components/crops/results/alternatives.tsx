import type { CropRecommendation, FarmInputs } from "@/lib/crop-analysis";
import {
  capitalize,
  formatWeight,
  rainCoverage,
  shortMonth,
  toInches,
  watchOut,
} from "@/lib/crop-insights";

import { CARD, levelBarColor } from "./parts";

const SCORE_SEGMENTS = 10;

const plantingWindow = (rec: CropRecommendation) =>
  rec.plantMonth && rec.harvestMonth
    ? `${shortMonth(rec.plantMonth)} → ${shortMonth(rec.harvestMonth)}`
    : "Year-round";

const yieldPerAcre = (rec: CropRecommendation) =>
  rec.harvestLbPerAcre === null ? "Not estimated" : `${formatWeight(rec.harvestLbPerAcre)} / acre`;

export function AlternativeCard({ rec, farm }: { rec: CropRecommendation; farm: FarmInputs }) {
  const note = watchOut(rec, farm);
  const filled = Math.round(rec.score / SCORE_SEGMENTS);
  return (
    <article className={`${CARD} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="text-[28px] leading-none">{rec.emoji}</span>
          <div className="min-w-0">
            <h4 className="text-[16px] font-bold text-[#1f2d27]">{rec.crop}</h4>
            <p className="text-[12px] text-[#7a857d]">{capitalize(rec.category)}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="rounded-lg border border-[#e6ebe4] bg-[#f6f8f5] px-2 py-0.5 text-[12px] font-bold text-[#1f2d27] tabular-nums">
            <span className="sr-only">Score </span>{rec.score} / 100
          </p>
          <p className="mt-1 text-[11px] text-[#8a948c]">{rec.level}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-1" aria-hidden="true">
        {Array.from({ length: SCORE_SEGMENTS }, (_, index) => (
          <span
            key={index}
            className={`h-4 w-1.5 rounded-sm ${index < filled ? levelBarColor(rec.level) : "bg-[#e6ebe4]"}`}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#eef1ec] pt-3 text-[12px]">
        <div>
          <dt className="text-[#8a948c]">Projected yield</dt>
          <dd className="mt-0.5 font-semibold text-[#1f2d27]">{yieldPerAcre(rec)}</dd>
        </div>
        <div>
          <dt className="text-[#8a948c]">Plant → harvest</dt>
          <dd className="mt-0.5 font-semibold text-[#1f2d27]">{plantingWindow(rec)}</dd>
        </div>
      </dl>
      <p className="mt-3 rounded-[12px] bg-[#f6f8f5] px-3 py-2.5 text-[12px] leading-5 text-[#4f5d53]">
        <b className="text-[#1f2d27]">{note.label}:</b> {note.text}
      </p>
    </article>
  );
}

export function WaterDemandCard({ rec, farm }: { rec: CropRecommendation; farm: FarmInputs }) {
  const coverage = rainCoverage(rec);
  return (
    <article className={`${CARD} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-[13px] font-bold text-[#1f2d27]">
          <span aria-hidden="true" className="size-2 rounded-full bg-[#2f6fb0]" />
          Water demand for {rec.crop}
        </h4>
        <span className="text-[12px] font-semibold text-[#2f7a4b]">{farm.irrigated ? "Irrigated" : "Rain only"}</span>
      </div>
      <p className="mt-2 text-[13px] leading-6 text-[#4f5d53]">
        {toInches(rec.yearlyRainMm)} inches of yearly rain covers {coverage}% of the{" "}
        {toInches(rec.needs.rainMm[0])} inches it needs at minimum.
      </p>
      <div className="relative mt-3 h-2 rounded-full bg-[#eef1ec]" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full bg-[#86b5e4]" style={{ width: `${coverage}%` }} />
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#2f6fb0] bg-white"
          style={{ left: `${coverage}%` }}
        />
      </div>
      <div aria-hidden="true" className="mt-1.5 flex justify-between text-[10px] text-[#9aa39c]">
        <span>Needs watering</span>
        <span>Fully rainfed</span>
      </div>
    </article>
  );
}
