"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5001";
const TIMEOUT_MS = 35_000;

export type CurrentConditions = {
  temperatureF: number;
  temperatureC: number;
  conditions: string;
  rainPast24hIn: number;
  observedAt: string | null;
  timezone: string | null;
  source: string;
};

export type WeatherAlert = {
  id: string;
  event: string;
  severity: string;
  headline: string;
  ends: string | null;
};

type MonthValue = { month: string; tempF?: number; rainIn?: number };

export type ClimateNormal = {
  annualRainIn: number;
  meanTempF: number;
  warmestMonth: MonthValue;
  coolestMonth: MonthValue;
  wettestMonth: MonthValue;
  driestMonth: MonthValue;
  source: string;
};

/** Each part of the overview loads or fails on its own. `alerts` data is null outside the US. */
export type Part<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

export type WeatherOverview = {
  current: Part<CurrentConditions>;
  alerts: Part<WeatherAlert[] | null>;
  normal: Part<ClimateNormal>;
};

const loading: WeatherOverview = {
  current: { status: "loading" },
  alerts: { status: "loading" },
  normal: { status: "loading" },
};

function toPart<T>(raw: unknown): Part<T> {
  if (raw && typeof raw === "object" && "data" in raw) return { status: "ready", data: (raw as { data: T }).data };
  const message =
    raw && typeof raw === "object" && typeof (raw as { error?: unknown }).error === "string"
      ? (raw as { error: string }).error
      : "Unavailable right now.";
  return { status: "error", message };
}

function failed(message: string): WeatherOverview {
  const part = { status: "error" as const, message };
  return { current: part, alerts: part, normal: part };
}

/** GET /api/weather/overview for a point: live conditions, NWS alerts and the NASA 30-year normal. */
export function useWeatherOverview(coordinates: { lat: number; lon: number } | null): WeatherOverview | null {
  const [state, setState] = useState<WeatherOverview | null>(null);
  const lat = coordinates?.lat;
  const lon = coordinates?.lon;

  useEffect(() => {
    if (lat === undefined || lon === undefined) {
      setState(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    setState(loading);
    fetch(`${API_BASE}/api/weather/overview?lat=${lat}&lon=${lon}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (cancelled) return;
        if (!response.ok || !body) {
          setState(failed(typeof body?.error === "string" ? body.error : "Weather is unavailable right now."));
          return;
        }
        setState({
          current: toPart<CurrentConditions>(body.current),
          alerts: toPart<WeatherAlert[] | null>(body.alerts),
          normal: toPart<ClimateNormal>(body.normal),
        });
      })
      .catch(() => {
        if (!cancelled) setState(failed("Weather is unavailable right now."));
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lon]);

  return state;
}
