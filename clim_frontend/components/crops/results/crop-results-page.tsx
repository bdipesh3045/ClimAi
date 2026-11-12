"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, RotateCcw, Sprout } from "lucide-react";

import { loadCropAnalysis, type CropAnalysisResult } from "@/lib/crop-analysis";
import { shortPlace } from "@/lib/crop-insights";

import { AlternativeCard, WaterDemandCard } from "./alternatives";
import { HarvestBanner } from "./harvest-banner";
import { LandAtAGlance } from "./land-glance";
import { EYEBROW } from "./parts";
import { TopCropCard } from "./top-crop-card";

const ALTERNATIVE_COUNT = 3;
const BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-[#2f7a4b] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#256540] focus-visible:ring-2 focus-visible:ring-[#2f7a4b] focus-visible:ring-offset-2";

type ViewState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; result: CropAnalysisResult };

function NoResults({ isError }: { isError: boolean }) {
  return (
    <div className="mx-auto max-w-[520px] rounded-[20px] border border-[#e6ebe4] bg-white p-8 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eaf6ee] text-[#2f7a4b]">
        <Sprout aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 font-heading text-[22px] font-bold text-[#172720]">
        {isError ? "We couldn't read your last results" : "No crop analysis yet"}
      </h1>
      <p className="mt-2 text-[14px] text-[#6b776e]">
        Fill in your farm details and we will rank the crops that suit your land.
      </p>
      <Link href="/crop-finder" className={`${BUTTON} mt-5`}>
        Go to Crop Finder
      </Link>
    </div>
  );
}

function Results({ result }: { result: CropAnalysisResult }) {
  const [top, ...rest] = result.recommendations;
  const alternatives = rest.slice(0, ALTERNATIVE_COUNT);
  const place = result.location ? shortPlace(result.location) : "Your farm";
  const acres = result.farm.acres;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-12 text-[#1d2a22]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          title={result.location ?? undefined}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#e6ebe4] bg-white px-3 py-1.5 text-[13px] font-medium text-[#3e4b42]"
        >
          <MapPin aria-hidden="true" className="size-4 shrink-0 text-[#2f7a4b]" />
          <span className="truncate">
            {place}
            {acres !== null && ` (${acres.toLocaleString("en-US")} acres)`}
          </span>
        </span>
        <Link href="/crop-finder" className={BUTTON}>
          <RotateCcw aria-hidden="true" className="size-4" />
          New analysis
        </Link>
      </div>

      <section aria-labelledby="glance-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h1 id="glance-heading" className="font-heading text-[30px] font-extrabold tracking-[-0.04em] text-[#172720]">
            Your land at a glance
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe8d6] bg-[#eaf6ee] px-2.5 py-0.5 text-[12px] font-medium text-[#1f6b3c]">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[#2f9a5a]" />
            30-year climate average
          </span>
        </div>
        <p className="mt-1 text-[14px] text-[#6b776e]">
          Climate for your exact coordinates, plus the soil and water details you entered.
        </p>
        <div className="mt-5">
          <LandAtAGlance result={result} />
        </div>
      </section>

      {top && <HarvestBanner rec={top} acres={acres} />}

      {top ? (
        <section aria-labelledby="crops-heading">
          <h2 id="crops-heading" className="font-heading text-[26px] font-extrabold tracking-[-0.03em] text-[#172720]">
            Crops to consider
          </h2>
          <p className="mt-1 text-[14px] text-[#6b776e]">
            Best matches first. Each one shows why it fits and what to watch out for.
          </p>
          <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <TopCropCard rec={top} farm={result.farm} />
            <aside aria-labelledby="alternatives-heading" className="space-y-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 id="alternatives-heading" className={EYEBROW}>Alternative options</h3>
                <span className="text-[12px] text-[#8a948c]">Sorted by match score</span>
              </div>
              {alternatives.map((rec) => (
                <AlternativeCard key={rec.crop} rec={rec} farm={result.farm} />
              ))}
              <WaterDemandCard rec={top} farm={result.farm} />
            </aside>
          </div>
        </section>
      ) : (
        <p className="text-[14px] text-[#6b776e]">No crops came back for this location. Try a nearby location.</p>
      )}

      <footer className="flex flex-col gap-2 border-t border-[#e6ebe4] pt-5 text-[12px] text-[#7a857d] sm:flex-row sm:justify-between">
        <span>
          <b className="font-semibold text-[#1f2d27]">Climate:</b> {result.climateSource}
        </span>
        <span>Crop ranges are approximate. Check with your local extension office before you plant.</span>
      </footer>
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
      <p role="status" className="text-center text-[14px] text-[#6b776e]">
        Loading your results...
      </p>
    );
  }
  if (view.status !== "ready") return <NoResults isError={view.status === "error"} />;
  return <Results result={view.result} />;
}
