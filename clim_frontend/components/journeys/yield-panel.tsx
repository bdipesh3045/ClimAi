"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Panel, PanelHead, Pill, Segmented, SourceNote } from "@/components/shared/ui-kit";
import { YIELD_CROPS, type JourneyCrop, type YieldCrop } from "@/lib/journeys";
// PLUG-IN: swap mockYieldPredict for the real POST /api/yield-predict call (same input and output types).
import { mockYieldPredict, type YieldPrediction } from "@/lib/journeys-mock";
import { cn } from "@/lib/utils";

const SLIDERS = [
  { key: "rainfallMm", label: "Rainfall", unit: "mm / year", min: 50, max: 3000, step: 10 },
  { key: "tempC", label: "Average temperature", unit: "°C", min: 5, max: 35, step: 0.5 },
  { key: "pesticidesTonnes", label: "Pesticides", unit: "tonnes", min: 0, max: 400_000, step: 1_000 },
] as const;
type SliderKey = (typeof SLIDERS)[number]["key"];

const FEATURE_LABELS = { rainfall: "Rainfall", temperature: "Temperature", pesticides: "Pesticides" } as const;

export function YieldPanel({ initialCrop }: { initialCrop: JourneyCrop }) {
  const covered = (YIELD_CROPS as string[]).includes(initialCrop);
  const [crop, setCrop] = useState<YieldCrop>(covered ? (initialCrop as YieldCrop) : "Soybeans");
  const [values, setValues] = useState<Record<SliderKey, number>>({ rainfallMm: 1150, tempC: 20.5, pesticidesTonnes: 37_000 });
  const [result, setResult] = useState<YieldPrediction | null>(null);

  useEffect(() => {
    let cancelled = false;
    // ---- PLUG-IN POINT: the real /api/yield-predict response replaces this mock ----
    mockYieldPredict({ crop, ...values }).then((prediction) => {
      if (!cancelled) setResult(prediction);
    });
    return () => {
      cancelled = true;
    };
  }, [crop, values]);

  const up = (result?.pctChange ?? 0) >= 0;

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="yield-heading">
      <PanelHead
        id="yield-heading"
        icon={TrendingUp}
        title="Yield prediction"
        description="Move the sliders to see how the season’s conditions change the expected yield."
        action={<Pill tone="warn">Demo data</Pill>}
      />

      {!covered && (
        <p className="mt-4 rounded-[10px] bg-marigold-tint px-3 py-2 text-[13px] leading-[1.5] text-marigold-ink">
          The yield model covers Soybeans and Rice, not {initialCrop.toLowerCase()} yet. Try it with one of those.
        </p>
      )}
      <Segmented<YieldCrop>
        ariaLabel="Crop"
        className="mt-4 w-full"
        value={crop}
        onChange={setCrop}
        options={YIELD_CROPS.map((value) => ({ value, label: value }))}
      />

      <div className="mt-5 rounded-[12px] border border-line bg-paper p-4 text-center" aria-live="polite">
        <p className={cn("font-display text-[44px] leading-none", up ? "text-forest" : "text-clay")}>
          {result ? `${up ? "+" : "−"}${Math.abs(result.pctChange).toFixed(1)}%` : "…"}
        </p>
        <p className="mt-2 text-[13.5px] text-ink-soft">
          {result ? (
            <>
              <span className="tabular font-semibold text-ink">{result.predictedYieldHgHa.toLocaleString("en-US")}</span> hg/ha
              predicted vs <span className="tabular">{result.baselineYieldHgHa.toLocaleString("en-US")}</span> typical (
              {(result.predictedYieldHgHa / 10_000).toFixed(2)} t/ha)
            </>
          ) : (
            "Predicting…"
          )}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {SLIDERS.map((slider) => (
          <div key={slider.key}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`yield-${slider.key}`} className="text-[13px] font-semibold text-ink-soft">
                {slider.label}
              </label>
              <span className="tabular text-[13.5px] font-semibold text-ink">
                {values[slider.key].toLocaleString("en-US")} <span className="font-normal text-ink-mute">{slider.unit}</span>
              </span>
            </div>
            <input
              id={`yield-${slider.key}`}
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={values[slider.key]}
              onChange={(e) => setValues((current) => ({ ...current, [slider.key]: Number(e.target.value) }))}
              className="mt-2 w-full accent-[#1e4a30]"
            />
          </div>
        ))}
      </div>

      {result && (
        <div className="mt-5 border-t border-line-soft pt-4">
          <p className="text-[13px] font-semibold text-ink-soft">Why?</p>
          <ul className="mt-2.5 space-y-2.5">
            {result.why.map((item) => (
              <li key={item.feature} className="grid grid-cols-[96px_minmax(0,1fr)_40px] items-center gap-3 text-[13px]">
                <span className="text-ink-soft">{FEATURE_LABELS[item.feature]}</span>
                <span className="h-2 overflow-hidden rounded-full bg-line-soft">
                  <span className="block h-full rounded-full bg-forest" style={{ width: `${item.importance * 100}%` }} />
                </span>
                <span className="tabular text-right font-semibold text-ink">{Math.round(item.importance * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] font-semibold text-ink-soft">Decision path</p>
          {result.decisionPath.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-ink-soft">
              {result.decisionPath.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="mt-1.5 rounded-[10px] border border-dashed border-line px-3 py-2 text-[12.5px] text-ink-mute">
              The rule the model followed will appear here once the yield model is connected.
            </p>
          )}
          <SourceNote className="mt-3">{result.source}</SourceNote>
        </div>
      )}
    </Panel>
  );
}
