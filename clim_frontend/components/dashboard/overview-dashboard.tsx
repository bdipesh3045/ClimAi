"use client";

import type { ReactNode } from "react";
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
import { useSeasonPlan } from "@/components/plans/use-season-plan";
import { useAppData } from "@/components/providers/app-data-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { LocationSearch } from "@/components/shared/location-search";
import { Panel, PanelHead, Pill, Skeleton, Spec, SpecGrid, SourceNote } from "@/components/shared/ui-kit";
import {
  useWeatherOverview,
  type Part,
  type WeatherAlert,
  type WeatherOverview,
} from "@/components/dashboard/use-weather-overview";
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
    body: "Describe your farm and see which crops fit its climate, soil and water.",
    source: "NASA POWER · ECOCROP",
  },
];

export function OverviewDashboard() {
  const { location, coordinates } = useAppData();
  const { state: auth } = useAuth();
  const profile = auth.status === "signed-in" ? auth.account.profile : null;
  // The location picked here wins; otherwise fall back to the farm on the profile.
  const point = coordinates ?? profile?.coordinates ?? null;
  const placeName = coordinates ? location : profile?.location ?? location;
  const weather = useWeatherOverview(point);
  const locationLabel = placeName ? placeName.split(",")[0] : "Not set";

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

      <CurrentPanel weather={weather} locationLabel={locationLabel} hasPoint={point !== null} />

      <div className="grid gap-6 xl:grid-cols-2">
        <NormalPanel weather={weather} />

        <NextTasks />
      </div>

      <AlertsSection weather={weather} />
    </div>
  );
}

function CurrentPanel({
  weather,
  locationLabel,
  hasPoint,
}: {
  weather: WeatherOverview | null;
  locationLabel: string;
  hasPoint: boolean;
}) {
  const part = weather?.current;
  const data = part?.status === "ready" ? part.data : null;
  const pending = part?.status === "loading";
  const empty = pending ? "…" : "—";

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="conditions-heading">
      <PanelHead
        id="conditions-heading"
        icon={ThermometerSun}
        title="Conditions right now"
        description={
          !hasPoint
            ? "Search for your location above to see live conditions."
            : part?.status === "error"
              ? part.message
              : "Live readings for your location, refreshed every 10 minutes."
        }
        action={data ? <Pill tone="good">Live</Pill> : undefined}
      />
      <SpecGrid className="mt-5">
        <Spec
          label="Temperature"
          icon={ThermometerSun}
          tone="clay"
          value={data ? `${data.temperatureF}°F` : empty}
          note={data ? `${data.temperatureC}°C` : "Open-Meteo"}
        />
        <Spec
          label="Recent rainfall"
          icon={CloudRain}
          tone="sow"
          value={data ? `${data.rainPast24hIn.toFixed(2)} in` : empty}
          note="Past 24 hours"
        />
        <Spec
          label="Conditions"
          icon={CloudSun}
          value={data ? data.conditions : empty}
          note={data?.observedAt ? `As of ${formatLocalTime(data.observedAt)}${data.timezone ? ` ${data.timezone}` : ""}` : "Open-Meteo"}
        />
        <Spec
          label="Location"
          icon={MapPin}
          tone="forest"
          value={locationLabel}
          note={hasPoint ? "Workspace location" : "Search above to set it"}
        />
      </SpecGrid>
      {data && <SourceNote className="mt-4">Source: {data.source}.</SourceNote>}
    </Panel>
  );
}

/** "2026-11-12T22:00" (already local to the farm) → "10:00 PM". */
function formatLocalTime(iso: string) {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return iso;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

function NormalPanel({ weather }: { weather: WeatherOverview | null }) {
  const part = weather?.normal;
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="season-summary-heading">
      <PanelHead
        id="season-summary-heading"
        title="Your climate normal"
        description="What a typical year looks like here, averaged over 30 years."
      />
      <PartBody part={part} rows={3} idle="Set a location to see its 30-year normal.">
        {(normal) => (
          <>
            <dl className="mt-4 divide-y divide-line-soft">
              <SummaryRow
                label="Annual rainfall"
                value={`${normal.annualRainIn} in`}
                detail={`Wettest ${normal.wettestMonth.month} (${normal.wettestMonth.rainIn} in) · driest ${normal.driestMonth.month} (${normal.driestMonth.rainIn} in)`}
              />
              <SummaryRow
                label="Average temperature"
                value={`${normal.meanTempF}°F`}
                detail={`Warmest ${normal.warmestMonth.month} (${normal.warmestMonth.tempF}°F) · coolest ${normal.coolestMonth.month} (${normal.coolestMonth.tempF}°F)`}
              />
            </dl>
            <SourceNote className="mt-4">Source: {normal.source}.</SourceNote>
          </>
        )}
      </PartBody>
      <Link
        href="/season-comparison"
        className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-forest hover:underline"
      >
        Compare a real season against it <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </Panel>
  );
}

function PartBody<T>({
  part,
  rows,
  idle,
  children,
}: {
  part: Part<T> | undefined;
  rows: number;
  idle: string;
  children: (data: T) => ReactNode;
}) {
  if (!part) return <p className="mt-4 text-[14px] text-ink-mute">{idle}</p>;
  if (part.status === "loading")
    return (
      <div className="mt-4 space-y-3" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    );
  if (part.status === "error") return <p className="mt-4 text-[14px] text-clay">{part.message}</p>;
  return <>{children(part.data)}</>;
}

const SEVERITY_TONE: Record<string, "bad" | "warn" | "info" | "neutral"> = {
  Extreme: "bad",
  Severe: "bad",
  Moderate: "warn",
  Minor: "info",
};

function AlertsSection({ weather }: { weather: WeatherOverview | null }) {
  const part = weather?.alerts;
  const alerts: WeatherAlert[] | null = part?.status === "ready" ? part.data : null;
  const hasAlerts = alerts !== null && alerts.length > 0;

  let message = "Set a location to check for active weather alerts.";
  if (part?.status === "loading") message = "Checking the National Weather Service…";
  else if (part?.status === "error") message = part.message;
  else if (part?.status === "ready" && alerts === null)
    message = "Alerts come from the US National Weather Service, so they are only available for US locations.";
  else if (part?.status === "ready" && alerts?.length === 0)
    message = "No active alerts from the National Weather Service for this location.";

  return (
    <section
      aria-label="Weather alerts"
      className={cn(
        "flex flex-col gap-3 rounded-[14px] p-5 sm:p-6",
        hasAlerts ? "border border-line bg-panel" : "border border-dashed border-[#c8cfc0] bg-paper",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              hasAlerts ? "bg-clay-tint text-clay" : "bg-sow-tint text-sow",
            )}
          >
            <CloudSun size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-heading text-[15.5px] font-bold text-ink">
              {hasAlerts ? `${alerts.length} active weather alert${alerts.length === 1 ? "" : "s"}` : "Weather alerts"}
            </h2>
            <p className="mt-1 text-[14px] leading-[1.55] text-ink-mute">
              {hasAlerts ? "From the US National Weather Service." : message}
            </p>
          </div>
        </div>
        <Link
          href="/planting-weather"
          className="inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-forest hover:underline"
        >
          Planting & weather <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {hasAlerts && (
        <ul className="divide-y divide-line-soft border-t border-line-soft">
          {alerts.map((alert) => (
            <li key={alert.id} className="py-3 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14.5px] font-semibold text-ink">{alert.event}</p>
                <Pill tone={SEVERITY_TONE[alert.severity] ?? "neutral"}>{alert.severity}</Pill>
              </div>
              {alert.headline && <p className="mt-1 text-[13.5px] leading-[1.5] text-ink-soft">{alert.headline}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
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
