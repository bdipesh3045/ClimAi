"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SEASON_DAYS, type Journey, type JourneyCrop, type JourneyEntry } from "@/lib/journeys";
import { MOCK_DONE_STEPS, buildMockJourneys } from "@/lib/journeys-mock";

// In-memory journeys, seeded from the mock file. A refresh returns to the clean demo state.
// PLUG-IN: load and save journeys through the backend here when real storage exists.

type JourneyStore = {
  /** null until mounted: dates depend on the viewer's clock, so nothing renders on the server. */
  journeys: Journey[] | null;
  addEntry: (journeyId: string, entry: Omit<JourneyEntry, "id">) => void;
  addJourney: (input: { crop: JourneyCrop; sownOn: string; location: string }) => string;
  /** Expert-guide steps marked done, per journey. */
  doneSteps: Record<string, string[]>;
  setStepDone: (journeyId: string, stepId: string, done: boolean) => void;
};

const JourneyContext = createContext<JourneyStore | null>(null);

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter += 1)}`;

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  const [doneSteps, setDoneSteps] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setJourneys(buildMockJourneys());
    setDoneSteps(MOCK_DONE_STEPS);
  }, []);

  const setStepDone = useCallback<JourneyStore["setStepDone"]>((journeyId, stepId, done) => {
    setDoneSteps((current) => {
      const steps = new Set(current[journeyId] ?? []);
      if (done) steps.add(stepId);
      else steps.delete(stepId);
      return { ...current, [journeyId]: [...steps] };
    });
  }, []);

  const addEntry = useCallback<JourneyStore["addEntry"]>((journeyId, entry) => {
    setJourneys((current) =>
      current?.map((journey) =>
        journey.id === journeyId ? { ...journey, entries: [...journey.entries, { ...entry, id: newId("e") }] } : journey,
      ) ?? current,
    );
  }, []);

  const addJourney = useCallback<JourneyStore["addJourney"]>(({ crop, sownOn, location }) => {
    const id = newId(crop.toLowerCase());
    const journey: Journey = {
      id,
      crop,
      location,
      sownOn,
      seasonDays: SEASON_DAYS[crop],
      sample: false,
      entries: [{ id: newId("e"), date: sownOn, type: "sowing", details: `${crop} sown. Journey started.` }],
    };
    setJourneys((current) => [journey, ...(current ?? [])]);
    return id;
  }, []);

  const value = useMemo(
    () => ({ journeys, addEntry, addJourney, doneSteps, setStepDone }),
    [journeys, addEntry, addJourney, doneSteps, setStepDone],
  );
  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourneys() {
  const store = useContext(JourneyContext);
  if (!store) throw new Error("useJourneys must be used inside JourneyProvider");
  return store;
}
