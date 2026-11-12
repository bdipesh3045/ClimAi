"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { CropFitLevel, CropRecommendation, FarmInputs } from "@/lib/crop-analysis";
import { capitalize, formatWeight, shortMonth, watchOut } from "@/lib/crop-insights";
import { Panel, PanelHead, Pill, buttonClass } from "@/components/shared/ui-kit";
import { cn } from "@/lib/utils";

import { CropIcon, LEVEL_FILL, LEVEL_TONE } from "./parts";

const INITIAL_ROWS = 5;
const LEVEL_ORDER: CropFitLevel[] = ["Great fit", "Good fit", "Possible with care", "Not recommended"];

const season = (rec: CropRecommendation) =>
  rec.plantMonth && rec.harvestMonth ? `${shortMonth(rec.plantMonth)} → ${shortMonth(rec.harvestMonth)}` : "Year-round";

/** How all ranked crops split across fit levels, as one proportional bar. */
function FitDistribution({ recs }: { recs: CropRecommendation[] }) {
  const counts = LEVEL_ORDER.map((level) => ({ level, count: recs.filter((rec) => rec.level === level).length })).filter(
    (item) => item.count > 0,
  );
  const fitWell = recs.filter((rec) => rec.level === "Great fit" || rec.level === "Good fit").length;
  return (
    <div className="mt-5">
      <p className="text-[14.5px] text-ink-soft">
        <span className="tabular font-display text-[22px] text-forest">{fitWell}</span>
        <span className="text-ink-mute"> of {recs.length}</span> crops fit this land well.
      </p>
      <div
        className="mt-3 flex h-3 overflow-hidden rounded-full bg-line-soft"
        role="img"
        aria-label={counts.map((item) => `${item.count} ${item.level}`).join(", ")}
      >
        {counts.map((item) => (
          <span
            key={item.level}
            className={cn("h-full border-r-2 border-panel last:border-r-0", LEVEL_FILL[item.level])}
            style={{ width: `${(item.count / recs.length) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-mute">
        {counts.map((item) => (
          <li key={item.level} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", LEVEL_FILL[item.level])} />
            <span className="tabular font-semibold text-ink">{item.count}</span> {item.level.toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every other ranked crop, best first, as a table that can expand to the full list. */
export function RankedCrops({ recs, farm }: { recs: CropRecommendation[]; farm: FarmInputs }) {
  const [showAll, setShowAll] = useState(false);
  const others = recs.slice(1);
  const visible = showAll ? others : others.slice(0, INITIAL_ROWS);

  return (
    <Panel className="overflow-hidden" aria-labelledby="ranked-heading">
      <div className="p-5 pb-5 sm:p-6 sm:pb-5">
        <PanelHead
          id="ranked-heading"
          title="Other crops to consider"
          description="Ranked by match score against your land's climate, soil and water."
        />
        <FitDistribution recs={recs} />
      </div>

      <table className="w-full border-t border-line text-left">
        <thead className="hidden bg-paper text-[12.5px] text-ink-mute md:table-header-group">
          <tr>
            <th scope="col" className="w-12 py-2.5 pl-6 font-semibold">#</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Crop</th>
            <th scope="col" className="w-[170px] px-3 py-2.5 font-semibold">Match</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Season</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Yield / acre</th>
            <th scope="col" className="py-2.5 pr-6 pl-3 font-semibold">Watch for</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {visible.map((rec, index) => {
            const note = watchOut(rec, farm);
            return (
              <tr key={rec.crop} className="block px-5 py-4 transition-colors hover:bg-paper md:table-row md:p-0">
                <td className="tabular hidden py-4 pl-6 align-top text-[14px] font-semibold text-ink-mute md:table-cell">
                  {index + 2}
                </td>
                <th scope="row" className="block text-left font-normal md:table-cell md:px-3 md:py-4 md:align-top">
                  <span className="flex items-center gap-3">
                    <CropIcon category={rec.category} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-heading text-[15.5px] font-bold text-ink">{rec.crop}</span>
                      <span className="block text-[13px] text-ink-mute">{capitalize(rec.category)}</span>
                    </span>
                  </span>
                </th>
                <td className="mt-3 block md:mt-0 md:table-cell md:px-3 md:py-4 md:align-top">
                  <span className="flex items-center gap-2.5">
                    <span className="tabular w-8 text-[15px] font-bold text-ink">{rec.score}</span>
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line-soft" aria-hidden="true">
                      <span className={cn("block h-full rounded-full", LEVEL_FILL[rec.level])} style={{ width: `${rec.score}%` }} />
                    </span>
                  </span>
                  <Pill tone={LEVEL_TONE[rec.level]} className="mt-2">
                    {rec.level}
                  </Pill>
                </td>
                <td className="tabular mt-2 block text-[14px] text-ink-soft md:mt-0 md:table-cell md:px-3 md:py-4 md:align-top">
                  <span className="text-ink-mute md:hidden">Season: </span>
                  {season(rec)}
                </td>
                <td className="tabular mt-1 block text-[14px] text-ink-soft md:mt-0 md:table-cell md:px-3 md:py-4 md:align-top">
                  <span className="text-ink-mute md:hidden">Yield: </span>
                  {rec.harvestLbPerAcre === null ? "Not estimated" : formatWeight(rec.harvestLbPerAcre)}
                </td>
                <td className="mt-2 block max-w-[300px] text-[13.5px] leading-[1.5] text-ink-mute md:mt-0 md:table-cell md:py-4 md:pr-6 md:pl-3 md:align-top">
                  {note.label === "Key factor" ? (
                    <span className="text-forest">No concerns found</span>
                  ) : (
                    capitalize(note.text)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {others.length > INITIAL_ROWS && (
        <div className="border-t border-line px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            aria-expanded={showAll}
            className={buttonClass({ variant: "ghost", size: "sm", className: "-ml-2" })}
          >
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", showAll && "rotate-180")} />
            {showAll ? "Show fewer" : `Show all ${others.length} crops`}
          </button>
        </div>
      )}
    </Panel>
  );
}
