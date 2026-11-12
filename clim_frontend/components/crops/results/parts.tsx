import {
  Apple,
  Bean,
  Carrot,
  Leaf,
  Nut,
  Salad,
  Shirt,
  Sprout,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import type { CropFitLevel, CropRecommendation } from "@/lib/crop-analysis";
import { MONTHS } from "@/lib/crop-insights";
import type { SowState, Tone } from "@/components/shared/ui-kit";
import { cn } from "@/lib/utils";

/** Pill tone per fit level: solid green is reserved for the best fit. */
export const LEVEL_TONE: Record<CropFitLevel, Tone> = {
  "Great fit": "solid",
  "Good fit": "good",
  "Possible with care": "warn",
  "Not recommended": "bad",
};

/** Bar colour per fit level, for the ranked table and the distribution bar. */
export const LEVEL_FILL: Record<CropFitLevel, string> = {
  "Great fit": "bg-forest",
  "Good fit": "bg-forest-mid/55",
  "Possible with care": "bg-marigold",
  "Not recommended": "bg-clay",
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  cereal: Wheat,
  legume: Bean,
  vegetable: Salad,
  "root and tuber": Carrot,
  oilseed: Nut,
  fruit: Apple,
  forage: Leaf,
  fiber: Shirt,
  "cash crop": Sprout,
};

/** A drawn icon for the crop's category, in place of an emoji. */
export function CropIcon({
  category,
  size = "md",
  className,
}: {
  category: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category] ?? Sprout;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px]",
        size === "lg" && "size-14 rounded-[14px] bg-forest text-marigold",
        size === "md" && "size-10 bg-forest-tint text-forest",
        size === "sm" && "size-8 bg-forest-tint text-forest",
        className,
      )}
    >
      <Icon size={size === "lg" ? 28 : size === "md" ? 19 : 16} strokeWidth={1.9} />
    </span>
  );
}

/**
 * The twelve months between planting and harvest, from the backend's month
 * names. A crop with no planting month grows year-round.
 */
export function seasonMonths(rec: CropRecommendation): SowState[] {
  if (!rec.plantMonth || !rec.harvestMonth) return MONTHS.map(() => "window");
  const start = MONTHS.indexOf(rec.plantMonth);
  const end = MONTHS.indexOf(rec.harvestMonth);
  if (start < 0 || end < 0) return MONTHS.map(() => "unknown");
  return MONTHS.map((_, index) => {
    const inside = start <= end ? index >= start && index <= end : index >= start || index <= end;
    return inside ? "window" : "off";
  });
}
