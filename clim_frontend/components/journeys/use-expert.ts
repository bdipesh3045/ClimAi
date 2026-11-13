"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { ApiError, apiFetch, errorText } from "@/lib/api";
import { daysSinceSowing, sortedEntries, stageFor, stageRanges, type Journey } from "@/lib/journeys";
import { expertGuideFor, mockExpertReaction, type ExpertStage } from "@/lib/journeys-mock";

// The crop expert for one journey.
// Saved journeys: GET /backend/journeys/<id>/expert (clim_backend/journeys.py + services/expert.py),
//   where Gemini writes the playbook from real data and rules raise the field alerts.
// Sample journeys: the mock playbook in lib/journeys-mock.ts, labelled as demo data.

const EXPERT_TIMEOUT_MS = 60_000; // a first playbook waits on weather, climate and the AI

export type ExpertAlert = {
  kind: "frost" | "heat" | "rain" | "dry" | "overdue";
  level: "warning" | "watch" | "info";
  title: string;
  detail: string;
  source: string;
};

export type ExpertData = {
  /** ai: written by Gemini for this field. general: fallback playbook. sample: demo data. */
  source: "ai" | "general" | "sample";
  stage: string;
  day: number;
  stages: Array<ExpertStage & { fromDay: number; toDay: number }>;
  alerts: ExpertAlert[];
  /** The expert's reaction to one entry; `entryId` says which. */
  reaction: { entryId: string; text: string; source: "ai" | "general" } | null;
  basedOn: string[];
  warnings: string[];
  generatedAt: string | null;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ExpertData };

function sampleExpert(journey: Journey): ExpertData {
  const ranges = Object.fromEntries(stageRanges(journey).map((r) => [r.name, r]));
  const latest = sortedEntries(journey)[0];
  return {
    source: "sample",
    stage: stageFor(journey),
    day: daysSinceSowing(journey),
    stages: expertGuideFor(journey.crop).stages.map((s) => ({
      ...s,
      fromDay: ranges[s.stage]?.fromDay ?? 0,
      toDay: ranges[s.stage]?.toDay ?? journey.seasonDays,
    })),
    alerts: [],
    reaction: latest ? { entryId: latest.id, text: mockExpertReaction(latest.type, journey.crop), source: "general" } : null,
    basedOn: ["Sample playbook"],
    warnings: [],
    generatedAt: null,
  };
}

export function useExpert(journey: Journey) {
  const { expireSession } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Reload when a newly saved entry arrives, so the expert reacts to it. Temporary ids
  // (entries still saving) are ignored until the server confirms them.
  const latest = sortedEntries(journey)[0];
  const latestSavedId = latest && !latest.id.startsWith("tmp-") ? latest.id : null;

  const sample = useMemo(() => (journey.sample ? sampleExpert(journey) : null), [journey]);

  useEffect(() => {
    if (journey.sample) return;
    let cancelled = false;
    setState((current) => (current.status === "ready" ? current : { status: "loading" }));
    apiFetch(`/journeys/${journey.id}/expert`, { timeoutMs: EXPERT_TIMEOUT_MS })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data: data as ExpertData });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) return expireSession();
        setState({ status: "error", message: errorText(error, "The crop expert is unavailable right now.") });
      });
    return () => {
      cancelled = true;
    };
  }, [journey.id, journey.sample, latestSavedId, attempt, expireSession]);

  /** Ask the AI to write the playbook again (rate-limited on the server). */
  const refresh = useCallback(async () => {
    if (journey.sample) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const data = await apiFetch(`/journeys/${journey.id}/expert/refresh`, {
        method: "POST",
        timeoutMs: EXPERT_TIMEOUT_MS,
      });
      setState({ status: "ready", data: data as ExpertData });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) expireSession();
      setRefreshError(errorText(error, "The advice could not be refreshed."));
    } finally {
      setRefreshing(false);
    }
  }, [journey.id, journey.sample, expireSession]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    state: sample ? ({ status: "ready", data: sample } as State) : state,
    refresh,
    refreshing,
    refreshError,
    retry,
  };
}
