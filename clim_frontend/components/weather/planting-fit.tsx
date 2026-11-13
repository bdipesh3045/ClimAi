"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Gauge } from "lucide-react";
import { Panel, PanelHead } from "@/components/shared/ui-kit";
import {
  ChartLegend,
  axisTick,
  chartInk,
  tooltipLabelStyle,
  tooltipStyle,
} from "@/components/charts/chart-kit";

// ---------------------------------------------------------------------------
// Planting fit: a second look at the same backend payload the page already
// rendered. Every number below is arithmetic on the plan's own monthly normals
// and ECOCROP optimum; nothing is generated or sampled.
// ---------------------------------------------------------------------------

type TempPoint = { month: string; value: number | null; optimalLow: number; optimalHigh: number };
type RainPoint = { month: string; value: number | null };

export type PlantingFitInput = {
  window: { months: number[]; label: string };
  charts: { temperature: TempPoint[]; rainfall: RainPoint[]; tempUnit: string; rainUnit: string };
};

type GapRow = { month: string; gap: number | null; inside: boolean; inWindow: boolean };

function gapFor(point: TempPoint): number | null {
  if (point.value === null) return null;
  if (point.value < point.optimalLow) return round1(point.value - point.optimalLow);
  if (point.value > point.optimalHigh) return round1(point.value - point.optimalHigh);
  return 0;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function format(value: number, unit: string) {
  const number = Number.isInteger(value) ? value : value.toFixed(1);
  return unit.startsWith("°") ? `${number}${unit}` : `${number} ${unit}`;
}

function gapColor(row: GapRow) {
  if (row.gap === null) return chartInk.grid;
  if (row.gap === 0) return chartInk.band;
  return row.gap < 0 ? chartInk.rain : chartInk.heat;
}

export function PlantingFit({ plan }: { plan: PlantingFitInput }) {
  const { tempUnit, rainUnit } = plan.charts;
  const windowSet = new Set(plan.window.months);

  const rows: GapRow[] = plan.charts.temperature.map((point, index) => {
    const gap = gapFor(point);
    return { month: point.month, gap, inside: gap === 0, inWindow: windowSet.has(index) };
  });
  // Months that are inside the optimum draw a short stub so they read as "on target", not as missing.
  const stub = Math.max(0.4, Math.max(...rows.map((row) => Math.abs(row.gap ?? 0))) * 0.04);
  const chartRows = rows.map((row) => ({ ...row, bar: row.gap === 0 ? stub : row.gap }));

  const facts = buildFacts(plan, rows);

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="fit-heading">
      <PanelHead
        id="fit-heading"
        icon={Gauge}
        title="How close each month comes"
        description="Degrees outside the crop’s optimum each month. Bars below the line are too cool, above are too warm; green months sit inside the range."
      />

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div>
          <ChartLegend
            items={[
              { label: "Inside optimum", color: chartInk.band, kind: "bar" },
              { label: "Too cool", color: chartInk.rain, kind: "bar" },
              { label: "Too warm", color: chartInk.heat, kind: "bar" },
            ]}
          />
          <div className="mt-3 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartInk.grid} vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} tickMargin={10} interval={0} />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(value: number) => (value > 0 ? `+${value}` : `${value}`)}
                />
                <ReferenceLine y={0} stroke={chartInk.axis} strokeWidth={1} />
                <Tooltip
                  cursor={{ fill: "rgb(30 74 48 / 0.06)" }}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(_value, _name, item) => {
                    const row = (item as { payload?: GapRow }).payload;
                    if (!row || row.gap === null) return ["No data", "Fit"];
                    if (row.gap === 0) return ["Inside the optimum", "Fit"];
                    const direction = row.gap < 0 ? "too cool" : "too warm";
                    return [`${format(Math.abs(row.gap), tempUnit)} ${direction}`, "Fit"];
                  }}
                />
                <Bar dataKey="bar" radius={[3, 3, 3, 3]} maxBarSize={22}>
                  {chartRows.map((row) => (
                    <Cell
                      key={row.month}
                      fill={gapColor(row)}
                      fillOpacity={row.inWindow || row.gap !== 0 ? 1 : 0.55}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <dl className="grid content-start gap-px overflow-hidden rounded-[12px] border border-line bg-line-soft">
          {facts.map((fact) => (
            <div key={fact.label} className="bg-panel px-4 py-3">
              <dt className="text-[12.5px] font-semibold text-ink-mute">{fact.label}</dt>
              <dd className="mt-1 text-[15px] font-semibold text-ink tabular">{fact.value}</dd>
              {fact.note && <dd className="mt-0.5 text-[13px] leading-[1.5] text-ink-soft">{fact.note}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}

type Fact = { label: string; value: string; note?: string };

function buildFacts(plan: PlantingFitInput, rows: GapRow[]): Fact[] {
  const { tempUnit, rainUnit, temperature, rainfall } = plan.charts;
  const facts: Fact[] = [];

  // Rain that falls while the crop is in the window.
  const rainValues = rainfall.map((point) => point.value);
  const annual = rainValues.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  if (plan.window.months.length > 0 && annual > 0) {
    const inWindow = plan.window.months.reduce((sum, index) => sum + (rainValues[index] ?? 0), 0);
    facts.push({
      label: "Rain during the window",
      value: format(round1(inWindow), rainUnit),
      note: `${Math.round((inWindow / annual) * 100)}% of the year’s rain falls in ${plan.window.label}.`,
    });
  }

  // The closest month that misses the optimum: the first place to look for an earlier or later start.
  const misses = rows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => row.gap !== null && row.gap !== 0)
    .sort((a, b) => Math.abs(a.gap as number) - Math.abs(b.gap as number));
  if (misses[0]) {
    const miss = misses[0];
    const gap = miss.gap as number;
    facts.push({
      label: "Closest miss",
      value: `${miss.month}, ${format(Math.abs(gap), tempUnit)} ${gap < 0 ? "too cool" : "too warm"}`,
      note: "The month nearest the optimum that still falls outside it.",
    });
  } else if (rows.every((row) => row.inside)) {
    facts.push({ label: "Closest miss", value: "None", note: "Every month sits inside the optimum." });
  }

  // Temperature extremes.
  const temps = temperature.filter((point): point is TempPoint & { value: number } => point.value !== null);
  if (temps.length > 0) {
    const warmest = temps.reduce((a, b) => (b.value > a.value ? b : a));
    const coolest = temps.reduce((a, b) => (b.value < a.value ? b : a));
    facts.push({
      label: "Warmest and coolest month",
      value: `${warmest.month} ${format(warmest.value, tempUnit)} · ${coolest.month} ${format(coolest.value, tempUnit)}`,
      note: `A ${format(round1(warmest.value - coolest.value), tempUnit)} swing across the year.`,
    });
  }

  // Wettest and driest months.
  const rains = rainfall.filter((point): point is RainPoint & { value: number } => point.value !== null);
  if (rains.length > 0) {
    const wettest = rains.reduce((a, b) => (b.value > a.value ? b : a));
    const driest = rains.reduce((a, b) => (b.value < a.value ? b : a));
    facts.push({
      label: "Wettest and driest month",
      value: `${wettest.month} ${format(wettest.value, rainUnit)} · ${driest.month} ${format(driest.value, rainUnit)}`,
    });
  }

  return facts;
}
