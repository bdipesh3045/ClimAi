"use client";

import Link from "next/link";
import {
  ArrowRight,
  CloudRain,
  CloudSun,
  ListChecks,
  MapPin,
  Sprout,
  ThermometerSun,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { PageIntro } from "@/components/shared/page-intro";
import { seasonalSummary } from "@/lib/demo-data";
import { useSeasonPlan } from "@/components/plans/use-season-plan";
import { demoClimateService } from "@/lib/climate-service";
import { useAppData } from "@/components/providers/app-data-provider";
import { LocationSearch } from "@/components/shared/location-search";
import { Panel, PanelHead, Pill, Spec, SpecGrid } from "@/components/shared/ui-kit";
import { cn } from "@/lib/utils";

const tools: Array<{ title: string; href: string; icon: LucideIcon; body: string; source: string }> = [
  {
    title: "Season Comparison",
    href: "/season-comparison",
    icon: Wheat,
    body: "How a past season’s weather compares with the coming outlook, and whether your crops still fit.",
    source: "NASA POWER · Open-Meteo · ECOCROP",
  },
  {
    title: "Planting & Weather",
    href: "/planting-weather",
    icon: CloudSun,
    body: "A month-by-month planting window for any crop, from local climate normals.",
    source: "NASA POWER · ECOCROP",
  },
  {
    title: "Crop Finder",
    href: "/crop-finder",
    icon: Sprout,
    body: "Describe your farm, fields and goals for a crop assessment.",
    source: "Your farm details",
  },
];

export function OverviewDashboard() {
  const { location } = useAppData();
  const snapshot = demoClimateService.getDashboardSnapshot(location);
  const locationLabel = location ? location.split(",")[0] : "Not set";

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title={location ? `Your season in ${locationLabel}` : "Start with your location"}
        description="Pick where you grow, then compare seasons, find a planting window or work through your season checklist."
      />

      <div className="grid animate-rise gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <LocationSearch />

        <Panel className="p-5 sm:p-6" aria-labelledby="tools-heading">
          <PanelHead
            id="tools-heading"
            title="Answers from real climate data"
            description="These tools call live public records for your location."
          />
          <ul className="mt-4 divide-y divide-line-soft">
            {tools.map(({ title, href, icon: Icon, body, source }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group -mx-2 flex items-start gap-3.5 rounded-[12px] px-2 py-4 transition-colors hover:bg-paper"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-forest text-white">
                    <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-heading text-[16px] font-bold text-ink">
                      {title}
                      <ArrowRight
                        size={16}
                        className="text-forest-mid transition-transform duration-200 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="mt-1 block text-[14px] leading-[1.55] text-ink-soft">{body}</span>
                    <span className="mt-1.5 block text-[12.5px] text-ink-mute">{source}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="p-5 sm:p-6" aria-labelledby="conditions-heading">
        <PanelHead
          id="conditions-heading"
          icon={ThermometerSun}
          title="Sample conditions"
          description="Illustrative values that show how this panel will read once a live weather feed is connected. They are not observations for your location."
          action={<Pill tone="warn">Demo data</Pill>}
        />
        <SpecGrid className="mt-5">
          <Spec label="Temperature" icon={ThermometerSun} tone="clay" value={`${snapshot.temperatureF}°F`} note="Sample" />
          <Spec
            label="Recent rainfall"
            icon={CloudRain}
            tone="sow"
            value={`${snapshot.recentRainfallInches.toFixed(2)} in`}
            note="Past 24 hours · sample"
          />
          <Spec label="Conditions" icon={CloudSun} value={snapshot.conditions} note="Sample" />
          <Spec
            label="Location"
            icon={MapPin}
            tone="forest"
            value={locationLabel}
            note={location ? "Workspace location" : "Search above to set it"}
          />
        </SpecGrid>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5 sm:p-6" aria-labelledby="season-summary-heading">
          <PanelHead
            id="season-summary-heading"
            title="A season to plan for"
            description="Demonstration seasonal patterns, a starting point and not a forecast for your farm."
            action={<Pill tone="warn">Demo data</Pill>}
          />
          <dl className="mt-4 divide-y divide-line-soft">
            <SummaryRow
              label="Rainfall pattern"
              value="Near seasonal range"
              detail={`Illustrative ${seasonalSummary.currentYear} total: ${snapshot.seasonalRainfallInches.toFixed(1)} in`}
            />
            <SummaryRow
              label="Average temperature"
              value={`${Math.round(snapshot.seasonalAverageTemperatureF)}°F`}
              detail="Demonstration seasonal average"
            />
            <SummaryRow
              label="Notable periods"
              value={`${snapshot.wetPeriods} wet · ${snapshot.dryPeriods} dry`}
              detail="Sample comparison periods"
            />
          </dl>
          <Link
            href="/season-comparison"
            className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-forest hover:underline"
          >
            Compare real seasons for your location <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </Panel>

        <NextTasks />
      </div>

      <section
        aria-label="Weather alerts"
        className="flex flex-col gap-3 rounded-[14px] border border-dashed border-[#c8cfc0] bg-paper p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sow-tint text-sow">
            <CloudSun size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-heading text-[15.5px] font-bold text-ink">Weather alerts</h2>
            <p className="mt-1 text-[14px] leading-[1.55] text-ink-mute">
              No alerts are shown because a live weather alert source is not connected.
            </p>
          </div>
        </div>
        <Link
          href="/planting-weather"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-forest hover:underline",
          )}
        >
          Planting & weather <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

function SummaryRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div>
        <dt className="text-[14px] font-semibold text-ink">{label}</dt>
        <dd className="mt-0.5 text-[13px] text-ink-mute">{detail}</dd>
      </div>
      <dd className="tabular shrink-0 text-[14.5px] font-semibold text-forest">{value}</dd>
    </div>
  );
}

/** The first open tasks from the server-built season plan. */
function NextTasks() {
  const { state } = useSeasonPlan();
  const next = state.status === "ready" ? state.plan.tasks.filter((task) => !task.done).slice(0, 3) : [];

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="next-steps-heading">
      <PanelHead
        id="next-steps-heading"
        icon={ListChecks}
        title="Next in your season plan"
        description={
          state.status === "ready"
            ? `${state.plan.progress.done} of ${state.plan.progress.total} tasks done for ${state.plan.focus.crop.toLowerCase()}.`
            : "Built from your farm profile and saved to your account."
        }
      />
      {state.status === "loading" && (
        <div className="mt-4 space-y-3" aria-hidden="true">
          <div className="skeleton h-12 rounded-[10px]" />
          <div className="skeleton h-12 rounded-[10px]" />
        </div>
      )}
      {state.status === "missing" && (
        <p className="mt-4 text-[14px] text-ink-mute">
          <Link href="/profile" className="font-semibold text-forest hover:underline">
            Complete your farm profile
          </Link>{" "}
          to get a season plan for your land.
        </p>
      )}
      {state.status === "error" && <p className="mt-4 text-[14px] text-clay">{state.message}</p>}
      {state.status === "ready" &&
        (next.length > 0 ? (
          <ul className="mt-3 divide-y divide-line-soft">
            {next.map((task) => (
              <li key={task.id} className="py-3.5 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-semibold text-ink">{task.title}</p>
                  <Pill tone={task.priority === "High" ? "bad" : task.priority === "Medium" ? "warn" : "neutral"}>
                    {task.priority} priority
                  </Pill>
                </div>
                <p className="mt-1 text-[13.5px] text-forest-mid">{task.dueLabel}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-[12px] bg-forest-tint px-4 py-3 text-[14px] font-semibold text-forest">
            Every task in your plan is done.
          </p>
        ))}
      <Link
        href="/improvement-plan"
        className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-forest hover:underline"
      >
        Open season plan <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </Panel>
  );
}
