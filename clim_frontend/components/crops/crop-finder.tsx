"use client";

import Image from "next/image";
import { CircleHelp, Leaf } from "lucide-react";
import { PageIntro } from "@/components/shared/page-intro";
import { LocationSearch } from "@/components/shared/location-search";
import { type CropRecommendation } from "@/lib/demo-data";
import { demoClimateService } from "@/lib/climate-service";

export function CropFinder() {
  const results = demoClimateService.getCropRecommendations({
    soilType: "Unknown",
    drainage: "Unknown",
    season: "Warm season",
  });

  return (
    <div>
      <PageIntro
        eyebrow="Explore crop options"
        title="Find crops suited to your conditions."
        description="Search any location to set your workspace context. The crop examples below remain illustrative and are not location-based recommendations."
      />

      <div className="flex flex-col gap-6 sm:gap-8">
        <LocationSearch />

        <section aria-labelledby="crop-results-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-[#8a9389] uppercase">
                Starting point · demonstration
              </p>
              <h2
                id="crop-results-heading"
                className="mt-1 font-heading text-xl font-bold tracking-[-0.03em]"
              >
                Crop recommendations
              </h2>
            </div>
            <span className="rounded-full bg-[#e9f2e7] px-3 py-1.5 text-[10px] font-semibold text-[#286540]">
              Illustrative only
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {results.map((crop) => (
              <CropResult key={crop.id} crop={crop} />
            ))}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#e7ebe5] bg-[#f6f8f3] p-4">
            <CircleHelp size={17} className="mt-0.5 shrink-0 text-[#6f8f74]" />
            <p className="text-xs leading-5 text-[#69736a]">
              A suitability score here is a product-design demonstration, not a
              scientifically validated prediction. Add a soil test, field
              history, and local extension guidance before making planting
              decisions.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function CropResult({ crop }: { crop: CropRecommendation }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#e7ebe5] bg-white sm:flex">
      <div className="relative h-44 shrink-0 sm:h-auto sm:min-h-[210px] sm:w-[190px] lg:w-[220px]">
        <Image
          src={crop.image}
          alt={`${crop.name} field`}
          fill
          sizes="(max-width: 640px) 100vw, 220px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1 p-5 sm:p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg font-bold">{crop.name}</h3>
            <p className="mt-1 text-xs leading-5 text-[#777f77]">
              {crop.summary}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#eef4ea] px-2.5 py-1 text-[10px] font-semibold text-[#286540]">
            {crop.label}
          </span>
        </div>
        <div className="mt-4 flex items-end gap-3">
          <span className="font-heading text-3xl font-bold tracking-[-0.05em] text-[#17452d]">
            {crop.score}
          </span>
          <span className="pb-1 text-[10px] text-[#8a9389]">
            / 100 · simulated score
          </span>
          <div
            className="mb-1 ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-[#e9eee7] sm:w-32"
            role="img"
            aria-label={`Illustrative suitability score ${crop.score} out of 100`}
          >
            <div
              className="h-full rounded-full bg-[#398253]"
              style={{ width: `${crop.score}%` }}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-3 border-t border-[#edf0eb] pt-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-[#8a9389] uppercase">
              Climate compatibility
            </p>
            <p className="mt-1 text-xs leading-5 text-[#414d43]">
              {crop.climate}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-[#8a9389] uppercase">
              Soil compatibility
            </p>
            <p className="mt-1 text-xs leading-5 text-[#414d43]">{crop.soil}</p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-[#798279]">
          <Leaf size={13} className="mt-0.5 shrink-0 text-[#729477]" />
          <p>
            <span className="font-semibold text-[#59665b]">
              What to check:{" "}
            </span>
            {crop.uncertainty}
          </p>
        </div>
      </div>
    </article>
  );
}
