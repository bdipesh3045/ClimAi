"use client";

import { useEffect, useState } from "react";
import { Wheat } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/shared/ui-kit";
import type { Journey } from "@/lib/journeys";

// Expected harvest for this journey: POST /api/harvest-estimate, the Crop Finder scorer for one
// crop on this field (typical good-year yield × how well the crop fits the field's climate and soil).
// The farm's soil, size and irrigation come from the profile when there is one.

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5001";

type Estimate = {
  score: number;
  level: string;
  mainLimit: string;
  lbPerAcre: number | null;
  lbTotal: number | null;
  what: string;
  acres: number | null;
  source: string;
};

const LB_PER_TON = 2000;

function weight(lb: number) {
  if (lb < LB_PER_TON) return `${Math.round(lb).toLocaleString("en-US")} lb`;
  const tons = lb / LB_PER_TON;
  return `${tons < 10 ? tons.toFixed(1) : Math.round(tons).toLocaleString("en-US")} tons`;
}

const LIMIT_LABELS: Record<string, string> = {
  warmth: "warmth",
  water: "water",
  "soil type": "soil type",
  "soil acidity": "soil pH",
};

export function HarvestEstimate({ journey }: { journey: Journey }) {
  const { state: auth } = useAuth();
  const profile = auth.status === "signed-in" ? auth.account.profile : null;
  const coordinates = journey.coordinates ?? profile?.coordinates ?? null;
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Estimate }
  >({ status: "loading" });

  const lat = coordinates?.lat;
  const lon = coordinates?.lon;
  const soil = profile?.soilType ?? null;
  const size = profile?.farm.size ?? null;
  const unit = profile?.farm.sizeUnit ?? "acres";
  const irrigated = profile?.irrigation.available ?? false;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`${API_BASE}/api/harvest-estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        crop: journey.crop,
        coordinates: { lat, lon },
        ...(soil ? { soilType: soil } : {}),
        ...(size ? { farm: { size, sizeUnit: unit } } : {}),
        irrigation: { available: irrigated },
      }),
      signal: AbortSignal.timeout(35_000),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as (Estimate & { error?: string }) | null;
        if (cancelled) return;
        if (!response.ok || !body) {
          setState({ status: "error", message: body?.error ?? "The harvest estimate is unavailable right now." });
          return;
        }
        setState({ status: "ready", data: body });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "The harvest estimate is unavailable right now." });
      });
    return () => {
      cancelled = true;
    };
  }, [journey.crop, lat, lon, soil, size, unit, irrigated]);

  if (lat === undefined) {
    return (
      <Shell>
        <p className="text-[14px] text-ink-mute">Add a field location to estimate the harvest.</p>
      </Shell>
    );
  }
  if (state.status === "loading") {
    return (
      <Shell>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </Shell>
    );
  }
  if (state.status === "error") {
    return (
      <Shell>
        <p className="text-[14px] text-ink-mute">{state.message}</p>
      </Shell>
    );
  }

  const e = state.data;
  const limit = LIMIT_LABELS[e.mainLimit] ?? e.mainLimit;
  return (
    <Shell>
      {e.lbPerAcre === null ? (
        <>
          <p className="font-display text-[22px] leading-tight text-clay">Not expected to yield well here</p>
          <p className="mt-1 text-[13.5px] leading-[1.5] text-ink-soft">
            {journey.crop} fits this field at {e.score}/100. Its weakest point is {limit}.
          </p>
        </>
      ) : (
        <>
          <p className="font-display text-[24px] leading-tight text-forest">
            About {weight(e.lbTotal ?? e.lbPerAcre)} of {e.what}
            {e.lbTotal === null && " per acre"}
          </p>
          <p className="mt-1 text-[13.5px] leading-[1.5] text-ink-soft">
            {e.lbTotal !== null && e.acres !== null
              ? `On ${e.acres.toLocaleString("en-US")} acres from your profile, about ${e.lbPerAcre.toLocaleString("en-US")} lb per acre.`
              : "Add your farm size to the profile for a field total."}{" "}
            {e.level} ({e.score}/100); weakest point: {limit}.
          </p>
        </>
      )}
      <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-mute">
        An estimate for a good year from the crop’s typical yield and how well it fits this field, not a promise.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 rounded-[12px] border border-line bg-paper p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-forest-tint text-forest">
        <Wheat size={19} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink-soft">Expected harvest</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
