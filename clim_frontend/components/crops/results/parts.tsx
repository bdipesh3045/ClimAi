import type { LucideIcon } from "lucide-react";

import type { CropFitLevel } from "@/lib/crop-analysis";
import { shortMonth, MONTHS } from "@/lib/crop-insights";

export const CARD =
  "rounded-[20px] border border-[#e6ebe4] bg-white shadow-[0_1px_2px_rgba(16,40,24,0.04)]";
export const EYEBROW =
  "text-[11px] font-semibold tracking-[0.12em] text-[#5f6d63] uppercase";

const LEVEL_STYLES: Record<CropFitLevel, { badge: string; dot: string; bar: string }> = {
  "Great fit": { badge: "border-[#cfe8d6] bg-[#eaf6ee] text-[#1f6b3c]", dot: "bg-[#2f9a5a]", bar: "bg-[#3aa564]" },
  "Good fit": { badge: "border-[#e6e3b8] bg-[#f6f5e3] text-[#5d6417]", dot: "bg-[#9aa52b]", bar: "bg-[#a9b43a]" },
  "Possible with care": { badge: "border-[#f1ddb0] bg-[#fdf5e2] text-[#8a5a10]", dot: "bg-[#e09a2a]", bar: "bg-[#eaa23a]" },
  "Not recommended": { badge: "border-[#f1cdc7] bg-[#fbecea] text-[#a33c32]", dot: "bg-[#d0584a]", bar: "bg-[#d86a5c]" },
};

export const levelBarColor = (level: CropFitLevel) => LEVEL_STYLES[level].bar;

export function LevelBadge({ level }: { level: CropFitLevel }) {
  const style = LEVEL_STYLES[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap ${style.badge}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
      {level}
    </span>
  );
}

export function CardLabel({
  icon: Icon,
  iconClass,
  children,
  aside,
}: {
  icon: LucideIcon;
  iconClass: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className={`flex size-8 items-center justify-center rounded-[10px] ${iconClass}`}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <h3 className="text-[12px] font-semibold tracking-[0.1em] text-[#3e4b42] uppercase">
          {children}
        </h3>
      </div>
      {aside}
    </div>
  );
}

export function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

/** Twelve monthly bars, January first. Heights are relative to the year's range. */
export function MonthBars({
  values,
  colorOf,
  label,
}: {
  values: number[];
  colorOf: (share: number) => string;
  label: string;
}) {
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  return (
    <figure className="mt-auto pt-5">
      <div role="img" aria-label={label} className="flex h-12 items-end gap-1.5">
        {values.map((value, index) => {
          const share = (value - low) / span;
          return (
            <span
              key={MONTHS[index]}
              title={`${MONTHS[index]}`}
              className={`flex-1 rounded-[3px] ${colorOf(share)}`}
              style={{ height: `${20 + share * 80}%` }}
            />
          );
        })}
      </div>
      <figcaption aria-hidden="true" className="mt-1.5 flex justify-between text-[10px] text-[#9aa39c]">
        <span>{shortMonth(MONTHS[0])}</span>
        <span>{shortMonth(MONTHS[6])}</span>
        <span>{shortMonth(MONTHS[11])}</span>
      </figcaption>
    </figure>
  );
}
