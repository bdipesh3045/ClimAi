"use client";

import { Camera, Droplets, FlaskConical, NotebookPen, Sprout, SprayCan, type LucideIcon } from "lucide-react";
import type { ActionType } from "@/lib/journeys";
import { cn } from "@/lib/utils";

export const ACTION_ICONS: Record<ActionType, LucideIcon> = {
  sowing: Sprout,
  watering: Droplets,
  pesticide: SprayCan,
  fertilizer: FlaskConical,
  photo: Camera,
  note: NotebookPen,
};

export const ACTION_TONES: Record<ActionType, string> = {
  sowing: "bg-forest text-white",
  watering: "bg-sow-tint text-sow",
  pesticide: "bg-clay-tint text-clay",
  fertilizer: "bg-marigold-tint text-marigold-ink",
  photo: "bg-forest-tint text-forest",
  note: "bg-line-soft text-ink-soft",
};

export function ActionIcon({ type, className }: { type: ActionType; className?: string }) {
  const Icon = ACTION_ICONS[type];
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", ACTION_TONES[type], className)}>
      <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
    </span>
  );
}

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const percent = Math.round(value * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-2.5 overflow-hidden rounded-full bg-line-soft", className)}
    >
      <div className="h-full rounded-full bg-forest transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}
