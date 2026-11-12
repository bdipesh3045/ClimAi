import type { CropRecommendation } from "@/lib/crop-analysis";
import { formatWeight } from "@/lib/crop-insights";

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-[#dbe9df] bg-white/90 px-3 py-3 sm:px-4">
      <dt className="text-[10px] font-semibold tracking-[0.1em] text-[#5f6d63] uppercase">{label}</dt>
      <dd className="mt-1 text-[16px] font-bold tracking-[-0.02em] text-[#172720] sm:text-[18px]">{value}</dd>
      <dd className="text-[11px] text-[#7a857d]">{note}</dd>
    </div>
  );
}

function Headline({ rec, acres }: { rec: CropRecommendation; acres: number | null }) {
  if (rec.harvestLbTotal !== null && acres !== null) {
    return (
      <>
        Expected harvest on your {acres.toLocaleString("en-US")} acres:{" "}
        <span className="text-[#2f7a4b]">about {formatWeight(rec.harvestLbTotal)}</span> of {rec.harvestWhat}
      </>
    );
  }
  if (rec.harvestLbPerAcre !== null) {
    return (
      <>
        Expected harvest: <span className="text-[#2f7a4b]">about {formatWeight(rec.harvestLbPerAcre)}</span> of{" "}
        {rec.harvestWhat} per acre
      </>
    );
  }
  return <>No harvest estimate yet. Your top crop fits this land too poorly to project a yield.</>;
}

/** Harvest projection for the top crop, shown between the land summary and the crop cards. */
export function HarvestBanner({ rec, acres }: { rec: CropRecommendation; acres: number | null }) {
  return (
    <section
      aria-labelledby="harvest-heading"
      className="rounded-[20px] border border-[#cfe5d6] bg-gradient-to-r from-[#e6f4ea] via-[#f0f7ef] to-[#fafcf7] p-5 sm:p-7"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#dbe9df] bg-white text-[30px]"
          >
            {rec.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#2f7a4b] uppercase">
              Production projection
            </p>
            <h2
              id="harvest-heading"
              className="mt-1 font-heading text-[20px] leading-snug font-extrabold tracking-[-0.03em] text-[#172720] sm:text-[24px]"
            >
              <Headline rec={rec} acres={acres} />
            </h2>
            <p className="mt-1 text-[13px] text-[#5b6d62]">
              Based on {rec.crop}, your top match. Typical good-year yield, scaled by its match score.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[420px] lg:shrink-0">
          <Stat
            label="Yield rate"
            value={rec.harvestLbPerAcre === null ? "None" : formatWeight(rec.harvestLbPerAcre)}
            note="per acre"
          />
          <Stat
            label="Your field"
            value={acres === null ? "Not given" : `${acres.toLocaleString("en-US")}`}
            note="acres"
          />
          <Stat label="Score" value={`${rec.score}`} note="out of 100" />
        </dl>
      </div>
    </section>
  );
}
