"use client";

import { useState } from "react";
import { CheckCircle2, CloudRain, Stethoscope, TriangleAlert } from "lucide-react";
import { Pill } from "@/components/shared/ui-kit";
import type { Diagnosis, PlantCheckResult, WeatherPeriod } from "@/lib/plant-check";

const percent = (score: number) => Math.round(score * 100);
const fahrenheit = (celsius: number) => Math.round((celsius * 9) / 5 + 32);

export function HealthResult({ result }: { result: PlantCheckResult }) {
  const { plant, disease, source, weather, advice, notices } = result;
  const top = disease.top;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={source === "plantnet" ? "good" : "warn"}>
          {source === "plantnet" ? "Pl@ntNet disease model" : "AI estimate from the photo"}
        </Pill>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-label="Plant">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute">Plant</p>
          <p className="mt-1 text-[16px] font-semibold text-ink">{plant.name}</p>
          <p className="text-[13px] text-ink-mute">
            {plant.from === "crop" && "From your crop choice"}
            {plant.from === "plantnet" && plant.confidence !== null && (
              <>
                <i>{plant.scientificName}</i> · {percent(plant.confidence)}% probability
              </>
            )}
            {plant.from === "unknown" && "Not recognized by Pl@ntNet"}
          </p>
        </section>

        {top && (
          <section aria-label="Most likely problem">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute">Most likely</p>
            <p className={`mt-1 flex items-center gap-2 text-[16px] font-semibold ${disease.healthy ? "text-forest" : "text-clay"}`}>
              {disease.healthy ? <CheckCircle2 size={18} aria-hidden="true" /> : <TriangleAlert size={18} aria-hidden="true" />}
              {disease.healthy ? "Looks healthy" : top.name}
            </p>
            <Probability score={top.score} tone={disease.healthy ? "bg-forest" : "bg-clay"} />
            {top.evidence && <p className="mt-1.5 text-[13px] text-ink-soft">Seen: {top.evidence}</p>}
          </section>
        )}
      </div>

      {disease.runnersUp.length > 0 && <RunnersUp items={disease.runnersUp} />}
      {weather && <WeatherLine past={weather.past7Days} next={weather.next3Days} />}
      {advice && (
        <section aria-label="Advice" className="rounded-[12px] border border-line bg-paper p-4">
          <p className="text-[14px] leading-[1.55] text-ink">{advice.summary}</p>
          <p className="mt-2 text-[13.5px] leading-[1.5] text-ink-soft">
            <span className="font-semibold text-ink">Likely cause: </span>
            {advice.likelyCause}
          </p>
          <Checklist actions={advice.actions} />
          <p className="mt-3 flex gap-2 text-[13.5px] leading-[1.5] text-ink-soft">
            <Stethoscope size={16} className="mt-0.5 text-forest" aria-hidden="true" />
            <span>
              <span className="font-semibold text-ink">When to call an expert: </span>
              {advice.whenToCallExpert}
            </span>
          </p>
        </section>
      )}

      {notices.length > 0 && (
        <ul className="space-y-1" aria-label="Service notices">
          {notices.map((notice) => (
            <li key={notice} className="flex gap-2 text-[13px] text-clay">
              <TriangleAlert size={14} className="mt-0.5" aria-hidden="true" />
              {notice}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] text-ink-mute">Disease ID powered by Pl@ntNet. Advice by Google Gemini. Confirm with your extension office before treating.</p>
    </div>
  );
}

function Probability({ score, tone }: { score: number; tone: string }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[12.5px] text-ink-mute">
        <span>Probability</span>
        <span className="tabular font-semibold text-ink">{percent(score)}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line-soft">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent(score)}%` }} />
      </div>
    </div>
  );
}

function RunnersUp({ items }: { items: Diagnosis[] }) {
  return (
    <section aria-label="Other possibilities">
      <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute">Other possibilities</p>
      <ul className="mt-1.5 divide-y divide-line-soft">
        {items.map((item, index) => (
          <li key={`${index}-${item.name}`} className="flex justify-between gap-3 py-1.5 text-[13.5px]">
            <span className="min-w-0 text-ink-soft">{item.name}</span>
            <span className="tabular shrink-0 text-ink-mute">{percent(item.score)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WeatherLine({ past, next }: { past: WeatherPeriod; next: WeatherPeriod }) {
  return (
    <p className="flex gap-2 text-[13px] leading-[1.5] text-ink-soft">
      <CloudRain size={16} className="mt-0.5 text-sow" aria-hidden="true" />
      <span>
        Past 7 days: {past.rainMm} mm rain over {past.wetDays} wet day{past.wetDays === 1 ? "" : "s"}, {past.avgHumidity}% humidity, highs
        near {fahrenheit(past.avgHighC)}°F. Next 3 days: {next.rainMm} mm rain, highs near {fahrenheit(next.avgHighC)}°F.
      </span>
    </p>
  );
}

function Checklist({ actions }: { actions: string[] }) {
  const [done, setDone] = useState<ReadonlySet<number>>(new Set());
  const toggle = (index: number) =>
    setDone((current) => {
      const updated = new Set(current);
      if (updated.has(index)) updated.delete(index);
      else updated.add(index);
      return updated;
    });

  return (
    <fieldset className="mt-3">
      <legend className="text-[13px] font-semibold text-ink">This week</legend>
      <ul className="mt-1.5 space-y-1.5">
        {actions.map((action, index) => (
          <li key={`${index}-${action}`}>
            <label className="flex cursor-pointer gap-2.5 text-[13.5px] leading-[1.45] text-ink-soft">
              <input type="checkbox" checked={done.has(index)} onChange={() => toggle(index)} className="mt-0.5 size-4 accent-forest" />
              <span className={done.has(index) ? "text-ink-mute line-through" : ""}>{action}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
