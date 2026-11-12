import Link from "next/link";
import { CalendarDays, CircleAlert, CircleCheck, CircleX, Info, type LucideIcon } from "lucide-react";

import type { CropRecommendation, FarmInputs } from "@/lib/crop-analysis";
import {
  allChecksPass,
  buildChecks,
  capitalize,
  summaryLine,
  TOTAL_CHECKS,
  type Check,
  type Scale,
  type Tone,
} from "@/lib/crop-insights";

import { CARD, EYEBROW, LevelBadge } from "./parts";

const TONES: Record<Tone, { icon: LucideIcon; iconClass: string; chip: string }> = {
  good: { icon: CircleCheck, iconClass: "text-[#2f9a5a]", chip: "border-[#cfe8d6] bg-[#eaf6ee] text-[#1f6b3c]" },
  fair: { icon: CircleAlert, iconClass: "text-[#d39424]", chip: "border-[#f1ddb0] bg-[#fdf5e2] text-[#8a5a10]" },
  poor: { icon: CircleX, iconClass: "text-[#d0584a]", chip: "border-[#f1cdc7] bg-[#fbecea] text-[#a33c32]" },
};
const SCALE_COLORS: Record<Check["kind"], { band: string; marker: string; value: string }> = {
  warmth: { band: "bg-[#bfe6cc]", marker: "bg-[#2f7a4b]", value: "text-[#1f2d27]" },
  water: { band: "bg-[#c9def4]", marker: "bg-[#2f6fb0]", value: "text-[#2f6fb0]" },
  soil: { band: "bg-[#e6ebe4]", marker: "bg-[#4b6b55]", value: "text-[#1f2d27]" },
};

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="relative size-[68px] shrink-0" aria-hidden="true">
      <svg viewBox="0 0 68 68" className="size-full -rotate-90">
        <circle cx="34" cy="34" r="28" fill="none" stroke="#e3ece5" strokeWidth="6" />
        <circle cx="34" cy="34" r="28" fill="none" stroke="#2f7a4b" strokeWidth="6" strokeLinecap="round" pathLength={100} strokeDasharray={`${score} 100`} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] leading-none font-extrabold text-[#172720]">{score}</span>
        <span className="text-[8px] font-semibold tracking-[0.1em] text-[#8a948c] uppercase">Score</span>
      </span>
    </div>
  );
}

function SeasonTimeline({ rec }: { rec: CropRecommendation }) {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-[16px] border border-[#f1e3b5] bg-[#fdf9ec] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f8ecc6] text-[#a8740f]">
          <CalendarDays aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="text-[11px] font-bold tracking-[0.12em] text-[#a8740f] uppercase">Season timeline</p>
          <p className="mt-0.5 text-[14px] font-medium text-[#2b2a1f]">
            {rec.plantMonth && rec.harvestMonth
              ? `Best time to plant: around ${rec.plantMonth}. Ready to harvest: around ${rec.harvestMonth}.`
              : "Grows year-round once planted, with no single best planting month."}
          </p>
        </div>
      </div>
      <span className="self-start rounded-full border border-[#ecdcae] bg-white px-3 py-1 text-[12px] whitespace-nowrap text-[#6b6340] sm:self-center">
        <b className="text-[#a8740f]">~{rec.seasonDays} days</b> to harvest
      </span>
    </div>
  );
}

function ScaleBar({ scale, kind }: { scale: Scale; kind: Check["kind"] }) {
  const colors = SCALE_COLORS[kind];
  return (
    <div className="mt-3 border-t border-[#eef1ec] pt-3" aria-hidden="true">
      <div className="flex justify-between gap-2 text-[11px] text-[#7a857d]">
        <span>{scale.lowLabel}</span>
        <span className={`font-semibold ${colors.value}`}>{scale.valueLabel}</span>
        <span>{scale.highLabel}</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-[#eef1ec]">
        <span
          className={`absolute inset-y-0 rounded-full ${colors.band}`}
          style={{ left: `${scale.bestStart}%`, width: `${scale.bestEnd - scale.bestStart}%` }}
        />
        <span
          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${colors.marker}`}
          style={{ left: `${scale.marker}%` }}
        />
      </div>
    </div>
  );
}

function CheckItem({ check }: { check: Check }) {
  const tone = TONES[check.tone];
  const Icon = tone.icon;
  return (
    <li className="rounded-[16px] border border-[#e6ebe4] p-4">
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${tone.iconClass}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-[14px] font-bold text-[#1f2d27]">{check.name}</h5>
            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${tone.chip}`}>{check.status}</span>
          </div>
          <p className="mt-1 text-[13px] leading-6 text-[#4f5d53]">{check.text}</p>
          {check.scale && <ScaleBar scale={check.scale} kind={check.kind} />}
        </div>
      </div>
    </li>
  );
}

export function TopCropCard({ rec, farm }: { rec: CropRecommendation; farm: FarmInputs }) {
  const checks = buildChecks(rec, farm);
  const checkedCount = Object.keys(rec.factors).length;
  const SummaryIcon = allChecksPass(rec) ? CircleCheck : CircleAlert;
  return (
    <article className={`${CARD} overflow-hidden`}>
      <div aria-hidden="true" className="h-1.5 bg-gradient-to-r from-[#8edcab] to-[#2f7a4b]" />
      <div className="p-5 sm:p-7">
        <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden="true" className="text-[40px] leading-none">{rec.emoji}</span>
              <h3 className="font-heading text-[30px] font-extrabold tracking-[-0.03em] text-[#172720]">{rec.crop}</h3>
              <LevelBadge level={rec.level} />
            </div>
            <p className="mt-1 text-[13px] text-[#6b776e]">
              {capitalize(rec.category)} · grown for {rec.harvestWhat}
            </p>
            <p className="mt-3 inline-flex items-start gap-2 rounded-full border border-[#cfe5d6] bg-[#f1f8f3] px-3 py-1.5 text-[12px] font-medium text-[#1d4d31]">
              <SummaryIcon aria-hidden="true" className="mt-px size-4 shrink-0" />
              {summaryLine(rec)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-[16px] border border-[#e6ebe4] bg-[#fafbf9] p-4">
            <ScoreRing score={rec.score} />
            <div className="text-[12px]">
              <p className="text-[13px] font-semibold text-[#1f2d27]">{rec.score} out of 100</p>
              <p className="text-[#6b776e]">based on {checkedCount} of {TOTAL_CHECKS} checks</p>
              <p className="mt-1 font-semibold text-[#2f7a4b]">Top recommendation</p>
            </div>
          </div>
        </header>

        <SeasonTimeline rec={rec} />

        <section aria-labelledby="checks-heading" className="mt-7">
          <h4 id="checks-heading" className={EYEBROW}>Checks against your land</h4>
          <ul className="mt-3 space-y-3">
            {checks.map((check) => (
              <CheckItem key={check.kind} check={check} />
            ))}
          </ul>
          {rec.missing.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-[12px] border border-[#e6ebe4] bg-[#fafbf9] px-3 py-2.5 text-[12px] text-[#6b776e]">
              <Info aria-hidden="true" className="mt-px size-4 shrink-0" />
              {capitalize(rec.missing.join(" and "))} {rec.missing.length > 1 ? "are" : "is"} not checked yet.
              Add soil details on the form for a sharper score.
            </p>
          )}
        </section>

        <footer className="mt-6 border-t border-[#eef1ec] pt-5">
          <Link
            href="/crop-finder"
            className="inline-flex items-center rounded-full bg-[#2f7a4b] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#256540] focus-visible:ring-2 focus-visible:ring-[#2f7a4b] focus-visible:ring-offset-2"
          >
            Start a new analysis
          </Link>
        </footer>
      </div>
    </article>
  );
}
