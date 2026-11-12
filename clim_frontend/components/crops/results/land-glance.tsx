"use client";

import Link from "next/link";
import { CloudRain, Droplets, Layers, Sun, Snowflake, ThermometerSun } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CropAnalysisResult } from "@/lib/crop-analysis";
import { capitalize, extremes, MONTHS, shortMonth, toFahrenheit, toInches } from "@/lib/crop-insights";
import { Panel, PanelHead, Pill, SourceNote, Spec, SpecGrid } from "@/components/shared/ui-kit";
import { ChartLegend, axisTick, chartInk, tooltipLabelStyle, tooltipStyle } from "@/components/charts/chart-kit";

const MM_PER_INCH = 25.4;
const inchesOne = (mm: number) => Number((mm / MM_PER_INCH).toFixed(1));

/** The climate and field details every crop above was scored against. */
export function LandAtAGlance({ result }: { result: CropAnalysisResult }) {
  const temps = result.monthlyTempC;
  const rain = result.monthlyRainMm;
  const heat = extremes(temps);
  const wet = extremes(rain);
  const yearly = rain.reduce((total, value) => total + value, 0);
  const pHMissing = result.recommendations[0]?.missing.includes("soil pH") ?? true;
  const data = MONTHS.map((month, index) => ({
    month: shortMonth(month),
    temp: toFahrenheit(temps[index]),
    rain: inchesOne(rain[index]),
  }));

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="land-heading">
      <PanelHead
        id="land-heading"
        icon={ThermometerSun}
        title="Your land"
        description="The 30-year monthly climate for your coordinates, plus the soil and water details you entered."
        action={<Pill tone="info">30-year average</Pill>}
      />

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <ChartLegend
            items={[
              { label: "Mean temperature (°F)", color: chartInk.heat },
              { label: "Rain (in)", color: chartInk.rain, kind: "bar" },
            ]}
          />
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={chartInk.grid} />
                <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis yAxisId="temp" tick={axisTick} tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} tickFormatter={(v: number) => `${v}°`} />
                <YAxis yAxisId="rain" orientation="right" tick={axisTick} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  cursor={{ fill: "rgb(30 74 48 / 0.06)" }}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value, name) => (name === "rain" ? [`${value} in`, "Rain"] : [`${value}°F`, "Mean temperature"])}
                />
                <Bar yAxisId="rain" dataKey="rain" fill={chartInk.rain} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Line yAxisId="temp" type="monotone" dataKey="temp" stroke={chartInk.heat} strokeWidth={2.5} dot={{ r: 3, fill: chartInk.heat }} activeDot={{ r: 4.5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <SourceNote className="mt-2">{result.climateSource}</SourceNote>
        </div>

        <div className="space-y-4">
          <SpecGrid columns={2}>
            <Spec label="Warmest month" icon={Sun} tone="clay" value={MONTHS[heat.highIndex]} note={`about ${toFahrenheit(temps[heat.highIndex])}°F`} />
            <Spec label="Coldest month" icon={Snowflake} tone="sow" value={MONTHS[heat.lowIndex]} note={`about ${toFahrenheit(temps[heat.lowIndex])}°F`} />
            <Spec
              label="Rain in a year"
              icon={CloudRain}
              tone="sow"
              value={`${toInches(yearly)} in`}
              note={`Wettest ${shortMonth(MONTHS[wet.highIndex])} ${inchesOne(rain[wet.highIndex])} in · driest ${shortMonth(MONTHS[wet.lowIndex])} ${inchesOne(rain[wet.lowIndex])} in`}
            />
            <Spec label="Watering" icon={Droplets} value={result.farm.irrigated ? "Irrigated" : "Rain only"} />
          </SpecGrid>
          <SpecGrid columns={2}>
            <Spec
              label="Soil type"
              icon={Layers}
              value={result.farm.soilType ? capitalize(result.farm.soilType) : "Not known"}
              note={result.farm.soilType ? "From your form" : "Not scored"}
            />
            <Spec
              label="Soil pH"
              value={pHMissing ? "Not tested" : "Scored"}
              note={
                pHMissing ? (
                  <Link href="/crop-finder" className="font-semibold text-forest hover:underline">
                    Add soil details
                  </Link>
                ) : undefined
              }
            />
          </SpecGrid>
        </div>
      </div>
    </Panel>
  );
}
