"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * One chart grammar for every page: hairline horizontals only, muted axis
 * text, the packet's spot inks for series (sow-blue = rain, clay = heat,
 * marigold = outlook), and a white tooltip with tabular figures.
 */
export const chartInk = {
  heat: "#ad4129",
  rain: "#2c5d8b",
  outlook: "#d6951c",
  forest: "#1e4a30",
  band: "#2b6843",
  grid: "#e4e7df",
  axis: "#626c65",
} as const;

export const axisTick = { fontSize: 12, fill: chartInk.axis };

export const tooltipStyle: CSSProperties = {
  borderRadius: 10,
  border: "1px solid #dbe0d5",
  boxShadow: "0 10px 24px -12px rgb(18 48 31 / 0.3)",
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
  padding: "8px 12px",
};

export const tooltipLabelStyle: CSSProperties = { fontWeight: 700, color: "#17201a", marginBottom: 2 };

export function ChartLegend({
  items,
  className,
}: {
  items: Array<{ label: string; color: string; kind?: "line" | "dashed" | "bar" | "band" }>;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-mute", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-flex w-4 items-center justify-center">
            {item.kind === "bar" ? (
              <span className="h-3 w-2.5 rounded-[2px]" style={{ background: item.color }} />
            ) : item.kind === "band" ? (
              <span className="h-3 w-4 rounded-[2px]" style={{ background: item.color, opacity: 0.16 }} />
            ) : (
              <span
                className="w-4"
                style={{
                  borderTop: `2.5px ${item.kind === "dashed" ? "dashed" : "solid"} ${item.color}`,
                }}
              />
            )}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
