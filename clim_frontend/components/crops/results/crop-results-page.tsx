"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw, Sprout } from "lucide-react";

import { loadCropAnalysis, type CropAnalysisResult } from "@/lib/crop-analysis";
import { capitalize, shortPlace } from "@/lib/crop-insights";
import { PageIntro } from "@/components/shared/page-intro";
import { Skeleton, SourceNote, StateBlock, buttonClass } from "@/components/shared/ui-kit";

import { RankedCrops } from "./alternatives";
import { LandAtAGlance } from "./land-glance";
import { TopCropCard } from "./top-crop-card";

type ViewState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; result: CropAnalysisResult };

function NoResults({ isError }: { isError: boolean }) {
  return (
    <StateBlock
      kind={isError ? "error" : "empty"}
      icon={Sprout}
      title={isError ? "We couldn't read your last results" : "No crop analysis yet"}
      className="mx-auto max-w-[720px]"
      action={
        <Link href="/crop-finder" className={buttonClass({ variant: isError ? "danger" : "primary", size: "sm" })}>
          Go to Crop Finder
        </Link>
      }
    >
      Fill in your farm details and we will rank the crops that suit your land.
    </StateBlock>
  );
}

function farmLine(result: CropAnalysisResult) {
  const parts = [
    result.farm.acres !== null ? `${result.farm.acres.toLocaleString("en-US")} acres` : null,
    result.farm.soilType ? `${capitalize(result.farm.soilType)} soil` : null,
    result.farm.irrigated ? "irrigated" : "rain only",
  ].filter(Boolean);
  return parts.join(" · ");
}

function Results({ result }: { result: CropAnalysisResult }) {
  const [top] = result.recommendations;
  const place = result.location ? shortPlace(result.location) : "your farm";

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageIntro
        title={`Best crops for ${place}`}
        description={
          <>
            {farmLine(result)}. Every crop is scored against the 30-year climate for your exact coordinates.
          </>
        }
        action={
          <Link href="/crop-finder" className={buttonClass({ variant: "secondary" })}>
            <RotateCcw aria-hidden="true" className="size-4" />
            New analysis
          </Link>
        }
      />

      {top ? (
        <div className="space-y-6">
          <TopCropCard rec={top} farm={result.farm} />
          {result.recommendations.length > 1 && <RankedCrops recs={result.recommendations} farm={result.farm} />}
          <LandAtAGlance result={result} />
        </div>
      ) : (
        <StateBlock kind="empty" icon={Sprout} title="No crops came back for this location">
          Try a nearby location, or check the farm details you entered.
        </StateBlock>
      )}

      <SourceNote className="mt-8 border-t border-line pt-5">
        Climate: {result.climateSource}. Crop ranges are approximate. Check with your local extension office before
        you plant.
      </SourceNote>
    </div>
  );
}

export function CropResultsPage() {
  const [view, setView] = useState<ViewState>({ status: "loading" });

  // sessionStorage only exists in the browser, so read it after the first render.
  useEffect(() => {
    try {
      const result = loadCropAnalysis();
      setView(result ? { status: "ready", result } : { status: "empty" });
    } catch {
      setView({ status: "error" });
    }
  }, []);

  if (view.status === "loading") {
    return (
      <div role="status" aria-live="polite" className="mx-auto w-full max-w-[1200px] space-y-6">
        <span className="sr-only">Loading your results…</span>
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }
  if (view.status !== "ready") return <NoResults isError={view.status === "error"} />;
  return <Results result={view.result} />;
}
