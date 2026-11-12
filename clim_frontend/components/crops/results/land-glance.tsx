import Link from "next/link";
import { CloudRain, Layers, Sprout, Thermometer } from "lucide-react";

import type { CropAnalysisResult } from "@/lib/crop-analysis";
import { capitalize, extremes, MONTHS, toFahrenheit, toInches } from "@/lib/crop-insights";

import { CARD, CardLabel, Chip, MonthBars } from "./parts";

const MM_PER_INCH = 25.4;

const warmColor = (share: number) =>
  share < 0.25 ? "bg-[#b9d3f3]" : share < 0.5 ? "bg-[#f3dc8a]" : share < 0.75 ? "bg-[#f2b36b]" : "bg-[#e46f3a]";
const rainColor = (share: number) =>
  share < 0.33 ? "bg-[#c4dcf3]" : share < 0.66 ? "bg-[#86b5e4]" : "bg-[#3f7fc4]";
const monthInches = (mm: number) => (mm / MM_PER_INCH).toFixed(1);

function Fact({ label, value, note, noteClass }: { label: string; value: string; note: string; noteClass: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[#6b776e]">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[20px] font-bold tracking-[-0.02em] text-[#172720]">{value}</span>
        <span className={`text-[13px] font-semibold ${noteClass}`}>{note}</span>
      </dd>
    </div>
  );
}

function TemperatureCard({ temps }: { temps: number[] }) {
  const { highIndex, lowIndex } = extremes(temps);
  return (
    <article className={`${CARD} flex flex-col p-5`}>
      <CardLabel
        icon={Thermometer}
        iconClass="bg-[#fdeee4] text-[#e0702a]"
        aside={<span className="text-[11px] whitespace-nowrap text-[#8a948c]">Monthly mean</span>}
      >
        Temperature
      </CardLabel>
      <dl className="mt-4 space-y-4">
        <Fact label="Warmest month" value={MONTHS[highIndex]} note={`about ${toFahrenheit(temps[highIndex])}°F`} noteClass="text-[#e0702a]" />
        <div className="border-t border-[#eef1ec] pt-4">
          <Fact label="Coldest month" value={MONTHS[lowIndex]} note={`about ${toFahrenheit(temps[lowIndex])}°F`} noteClass="text-[#2f6fb0]" />
        </div>
      </dl>
      <MonthBars values={temps} colorOf={warmColor} label={`Monthly temperature from ${toFahrenheit(temps[lowIndex])}°F in ${MONTHS[lowIndex]} to ${toFahrenheit(temps[highIndex])}°F in ${MONTHS[highIndex]}`} />
    </article>
  );
}

function PrecipitationCard({ rain, irrigated }: { rain: number[]; irrigated: boolean }) {
  const { highIndex, lowIndex } = extremes(rain);
  const yearly = rain.reduce((total, value) => total + value, 0);
  return (
    <article className={`${CARD} flex flex-col p-5`}>
      <CardLabel icon={CloudRain} iconClass="bg-[#e8f1fb] text-[#2f6fb0]">
        Precipitation
      </CardLabel>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-[12px] text-[#6b776e]">Rain in a year</dt>
          <dd className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[#172720]">
            {toInches(yearly)} inches
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-[#eef1ec] pt-4 text-[12px]">
          <div>
            <dt className="text-[#6b776e]">Wettest month</dt>
            <dd className="mt-0.5 font-semibold text-[#1f2d27]">{MONTHS[highIndex]} · {monthInches(rain[highIndex])} in</dd>
          </div>
          <div>
            <dt className="text-[#6b776e]">Driest month</dt>
            <dd className="mt-0.5 font-semibold text-[#1f2d27]">{MONTHS[lowIndex]} · {monthInches(rain[lowIndex])} in</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[#6b776e]">Watering</dt>
            <dd className="mt-0.5 font-semibold text-[#1f2d27]">{irrigated ? "Irrigated" : "Rain only"}</dd>
          </div>
        </div>
      </dl>
      <MonthBars values={rain} colorOf={rainColor} label={`Monthly rain from ${monthInches(rain[lowIndex])} inches in ${MONTHS[lowIndex]} to ${monthInches(rain[highIndex])} inches in ${MONTHS[highIndex]}`} />
    </article>
  );
}

function SoilCard({ soilType, missing }: { soilType: string | null; missing: string[] }) {
  const needsSampling = missing.length > 0;
  return (
    <article className={`${CARD} flex flex-col overflow-hidden`}>
      <div className="p-5">
        <CardLabel
          icon={Layers}
          iconClass="bg-[#eef3ec] text-[#4b6b55]"
          aside={needsSampling && <Chip className="border-[#f1ddb0] bg-[#fdf5e2] text-[#8a5a10]">Sampling needed</Chip>}
        >
          Soil
        </CardLabel>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-[12px] text-[#6b776e]">Soil pH</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {missing.includes("soil pH") ? (
                <>
                  <span className="text-[20px] font-bold text-[#a3aca5]">Not known</span>
                  <Chip className="border-[#e6ebe4] bg-[#f6f8f5] text-[#6b776e]">Not scored</Chip>
                </>
              ) : (
                <span className="text-[20px] font-bold text-[#172720]">Scored</span>
              )}
            </dd>
          </div>
          <div className="border-t border-[#eef1ec] pt-4">
            <dt className="text-[12px] text-[#6b776e]">Soil type</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {soilType ? (
                <span className="text-[20px] font-bold text-[#172720]">{capitalize(soilType)}</span>
              ) : (
                <>
                  <span className="text-[20px] font-bold text-[#a3aca5]">Not known</span>
                  <Chip className="border-[#e6ebe4] bg-[#f6f8f5] text-[#6b776e]">Not scored</Chip>
                </>
              )}
            </dd>
          </div>
        </dl>
      </div>
      {needsSampling && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[#eef1ec] bg-[#fafbf9] px-5 py-3 text-[12px]">
          <span className="text-[#4f5d53]">Want sharper results?</span>
          <Link href="/crop-finder" className="font-semibold text-[#237245] hover:underline">
            Add soil details →
          </Link>
        </div>
      )}
    </article>
  );
}

function CropFitCard({ result }: { result: CropAnalysisResult }) {
  const total = result.recommendations.length;
  const great = result.recommendations.filter((rec) => rec.level === "Great fit").length;
  const good = result.recommendations.filter((rec) => rec.level === "Good fit").length;
  const share = total === 0 ? 0 : ((great + good) / total) * 100;
  return (
    <article className={`${CARD} flex flex-col p-5`}>
      <CardLabel icon={Sprout} iconClass="bg-[#eaf6ee] text-[#2f7a4b]">
        Crop fit
      </CardLabel>
      <div className="relative mx-auto mt-3 w-[150px]">
        <svg viewBox="0 0 120 68" aria-hidden="true" className="w-full">
          <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#e8eee8" strokeWidth="10" strokeLinecap="round" />
          <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#3aa564" strokeWidth="10" strokeLinecap="round" pathLength={100} strokeDasharray={`${share} 100`} />
        </svg>
        <p className="absolute inset-x-0 bottom-0 text-center">
          <span className="block text-[28px] leading-none font-extrabold tracking-[-0.03em] text-[#172720]">
            {great + good}<span className="text-[15px] font-semibold text-[#8a948c]"> / {total}</span>
          </span>
        </p>
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold tracking-[0.1em] text-[#2f7a4b] uppercase">
        Crops fit well
      </p>
      <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-[#eef1ec] pt-4 text-[12px]">
        <div>
          <dt className="text-[#6b776e]">Great fit</dt>
          <dd className="mt-0.5 text-[16px] font-bold text-[#1f6b3c]">{great}</dd>
        </div>
        <div>
          <dt className="text-[#6b776e]">Good fit</dt>
          <dd className="mt-0.5 text-[16px] font-bold text-[#5d6417]">{good}</dd>
        </div>
      </dl>
    </article>
  );
}

export function LandAtAGlance({ result }: { result: CropAnalysisResult }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <TemperatureCard temps={result.monthlyTempC} />
      <PrecipitationCard rain={result.monthlyRainMm} irrigated={result.farm.irrigated} />
      <SoilCard soilType={result.farm.soilType} missing={result.recommendations[0]?.missing ?? []} />
      <CropFitCard result={result} />
    </div>
  );
}
