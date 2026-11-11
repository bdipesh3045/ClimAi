"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CloudSun,
  Droplets,
  MapPin,
  ThermometerSun,
} from "lucide-react";
import { PageIntro } from "@/components/shared/page-intro";
import { improvementActions, seasonalSummary } from "@/lib/demo-data";
import { demoClimateService } from "@/lib/climate-service";
import { useAppData } from "@/components/providers/app-data-provider";
import { LocationSearch } from "@/components/shared/location-search";

export function OverviewDashboard() {
  const { location } = useAppData();
  const snapshot = demoClimateService.getDashboardSnapshot(location);
  const locationLabel = location ? location.split(",")[0] : "Not set";

  return (
    <div className="flex flex-col gap-9">
      <PageIntro
        eyebrow="Your growing season, in context"
        title="Good morning. Let's grow smarter."
        description="Your agricultural intelligence dashboard. Search a location, review climate context, and prepare for the season ahead."
      />

      <LocationSearch />

      <section
        className="relative isolate min-h-[350px] overflow-hidden rounded-[1.75rem] bg-[#234b34] sm:min-h-[410px]"
        aria-label="ClimateAI welcome"
      >
        <Image
          src="/images/louisiana-farm.png"
          alt="A farmer walking through green crop rows in the morning"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1400px"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-[#10291b]/45" />
        <div className="flex min-h-[350px] flex-col justify-between p-6 text-white sm:min-h-[410px] sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-[#10291b]/20 px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-[#b5d9a9]" /> Climate
              snapshot · demo data
            </span>
            <span className="rounded-full border border-white/25 bg-[#10291b]/20 px-3 py-1.5 text-[10px] backdrop-blur-sm">
              {location
                ? `${location} · illustrative`
                : "Search a location to get started"}
            </span>
          </div>
          <div className="max-w-[680px]">
            <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-white/75 uppercase">
              Smarter farming starts with understanding climate.
            </p>
            <h2 className="font-heading max-w-[640px] text-4xl leading-[1.06] font-bold tracking-[-0.05em] sm:text-6xl">
              Understand your land. Prepare for tomorrow.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/85 sm:text-base">
              Search for a place to begin, then explore climate context and
              season-ready next steps.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/crop-finder"
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[#fcfcf8] px-5 text-sm font-medium text-[#17452d] transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-[#398253] focus-visible:ring-offset-2"
              >
                Explore crop finder <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link
                href="/improvement-plan"
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/50 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17452d]"
              >
                View your plan
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="conditions-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] text-[#8a9389] uppercase">
              A quick look
            </p>
            <h2
              id="conditions-heading"
              className="mt-1 font-heading text-xl font-bold tracking-[-0.03em]"
            >
              Local conditions
            </h2>
          </div>
          <p className="text-[11px] text-[#858e85]">
            Illustrative values · not live observations
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-[#e7ebe5] bg-[#e7ebe5] sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={ThermometerSun}
            label="Temperature"
            value={`${snapshot.temperatureF}°`}
            unit="F · sample"
          />
          <Metric
            icon={Droplets}
            label="Recent rainfall"
            value={`${snapshot.recentRainfallInches.toFixed(2)}″`}
            unit="past 24 hours · sample"
          />
          <Metric
            icon={CloudSun}
            label="Conditions"
            value={snapshot.conditions}
            unit={
              location
                ? `${locationLabel} area · sample`
                : "sample area · location not set"
            }
          />
          <Metric
            icon={MapPin}
            label="Location"
            value={locationLabel}
            unit={location ? "workspace location" : "search to add a location"}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="contents">
          <section
            className="rounded-2xl border border-[#e7ebe5] bg-white p-5 sm:p-6"
            aria-labelledby="season-summary-heading"
          >
            <p className="text-[10px] font-semibold tracking-[0.15em] text-[#8a9389] uppercase">
              Seasonal overview · demo
            </p>
            <h2
              id="season-summary-heading"
              className="mt-2 font-heading text-xl font-bold tracking-[-0.03em]"
            >
              A season to plan for
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#777f77]">
              Demonstration climate patterns are a starting point, not a
              forecast for your farm.
            </p>
            <div className="mt-5 divide-y divide-[#edf0eb]">
              <SummaryRow
                label="Rainfall pattern"
                value="Near seasonal range"
                detail={`Illustrative ${seasonalSummary.currentYear} total: ${snapshot.seasonalRainfallInches.toFixed(1)} in`}
              />
              <SummaryRow
                label="Average temperature"
                value={`${Math.round(snapshot.seasonalAverageTemperatureF)}° F`}
                detail="Demonstration seasonal average"
              />
              <SummaryRow
                label="Notable periods"
                value={`${snapshot.wetPeriods} wet · ${snapshot.dryPeriods} dry`}
                detail="Sample comparison periods"
              />
            </div>
            <Link
              href="/season-comparison"
              className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#23603b] hover:underline"
            >
              Compare seasons <ArrowRight size={14} />
            </Link>
          </section>

          <section
            className="rounded-2xl bg-[#eef4eb] p-5 sm:p-6"
            aria-labelledby="next-steps-heading"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.15em] text-[#64816a] uppercase">
                  A good place to start
                </p>
                <h2
                  id="next-steps-heading"
                  className="mt-2 font-heading text-lg font-bold tracking-[-0.03em]"
                >
                  Recommended next steps
                </h2>
              </div>
              <SproutIcon />
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {improvementActions.slice(0, 2).map((item, index) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl bg-white/75 p-3.5"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e4eee1] text-[10px] font-bold text-[#286540]">
                    0{index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[#27362a]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-[#7b857b]">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/improvement-plan"
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#23603b] hover:underline"
            >
              Open improvement plan <ArrowRight size={14} />
            </Link>
          </section>
        </div>
      </section>

      <section
        className="flex flex-col gap-3 rounded-2xl border border-dashed border-[#d8e2d5] bg-[#fbfcf9] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        aria-label="Weather alerts"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e6f5fa] text-[#477d8a]">
            <CloudSun size={17} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Weather alerts</h2>
            <p className="mt-1 text-xs leading-5 text-[#777f77]">
              No active alerts are shown because a live weather and alert source
              is not connected.
            </p>
          </div>
        </div>
        <Link
          href="/planting-weather"
          className="shrink-0 text-xs font-semibold text-[#23603b] hover:underline"
        >
          View planting & weather{" "}
          <ArrowRight className="ml-1 inline" size={13} />
        </Link>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: typeof ThermometerSun;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex min-h-[104px] items-center gap-4 bg-white px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f1f6ed] text-[#398253]">
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-[#7d867d]">{label}</p>
        <p className="mt-1 truncate font-heading text-lg font-bold tracking-[-0.03em]">
          {value}
        </p>
        <p className="mt-0.5 text-[10px] text-[#a0a79f]">{unit}</p>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div>
        <p className="text-xs font-medium text-[#364238]">{label}</p>
        <p className="mt-1 text-[10px] text-[#949c94]">{detail}</p>
      </div>
      <p className="shrink-0 text-xs font-semibold text-[#286540]">{value}</p>
    </div>
  );
}

function SproutIcon() {
  return (
    <span className="flex size-9 items-center justify-center rounded-full bg-white text-[#398253]">
      <CloudSun size={17} />
    </span>
  );
}
