"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { ApiError, apiFetch, errorText, readErrorMessage } from "@/lib/api";
import { shrinkPhoto } from "@/lib/plant-check-client";
import type { Journey, JourneyCrop, JourneyEntry } from "@/lib/journeys";
import { MOCK_DONE_STEPS, buildMockJourneys } from "@/lib/journeys-mock";

// Journeys the farmer creates are saved in the Flask database (clim_backend/journeys.py,
// reached through the /backend proxy). The two sample journeys stay in the browser only.
// Photos are kept for this browser session; the server stores each entry's text.

type ServerJourney = Journey & { doneSteps: string[] };

type JourneyStore = {
  /** null until loaded: dates depend on the viewer's clock, so nothing renders on the server. */
  journeys: Journey[] | null;
  /** Saved journeys could not be loaded; the samples still show. */
  loadError: string | null;
  retryLoad: () => void;
  /** A save that failed and was undone. */
  syncError: string | null;
  clearSyncError: () => void;
  /** Adds an entry; `photo` (the picked file or a prepared blob) is uploaded once the entry is saved. */
  addEntry: (journeyId: string, entry: Omit<JourneyEntry, "id"> & { photo?: Blob }) => void;
  /** Saves the journey and resolves to its id; throws with a message the form can show. */
  addJourney: (input: {
    crop: JourneyCrop;
    sownOn: string;
    location: string;
    coordinates?: { lat: number; lon: number } | null;
  }) => Promise<string>;
  /** Expert-guide steps marked done, per journey. */
  doneSteps: Record<string, string[]>;
  setStepDone: (journeyId: string, stepId: string, done: boolean) => void;
};

const JourneyContext = createContext<JourneyStore | null>(null);

let counter = 0;
const tempId = () => `tmp-${Date.now().toString(36)}-${(counter += 1)}`;

function isServerJourney(value: unknown): value is ServerJourney {
  if (typeof value !== "object" || value === null) return false;
  const j = value as Record<string, unknown>;
  return (
    typeof j.id === "string" &&
    typeof j.crop === "string" &&
    typeof j.location === "string" &&
    typeof j.sownOn === "string" &&
    typeof j.seasonDays === "number" &&
    Array.isArray(j.entries) &&
    Array.isArray(j.doneSteps)
  );
}

/** Where a saved entry's photo is served (through the /backend proxy, with the sign-in cookie). */
function photoPath(journeyId: string, entryId: string) {
  return `/backend/journeys/${journeyId}/entries/${entryId.replace(/^e/, "")}/photo`;
}

function readJourney(value: unknown): ServerJourney {
  if (!isServerJourney(value)) throw new ApiError("The server sent an unexpected journey.", 500);
  const entries = value.entries.map((entry) => {
    const { hasPhoto, ...rest } = entry as JourneyEntry & { hasPhoto?: boolean };
    return hasPhoto ? { ...rest, photoUrl: photoPath(value.id, rest.id) } : rest;
  });
  return { ...value, entries, sample: false };
}

/** Shrink (a picked file) and upload one entry's photo. Throws with a message to show. */
async function uploadPhoto(journeyId: string, entryId: string, photo: Blob) {
  const prepared = photo instanceof File ? await shrinkPhoto(photo) : photo;
  const form = new FormData();
  form.append("image", prepared, "photo.jpg");
  let response: Response;
  try {
    response = await fetch(photoPath(journeyId, entryId), {
      method: "PUT",
      body: form,
      credentials: "same-origin",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ApiError("The photo could not be uploaded. Check your connection.", 0);
  }
  if (!response.ok) throw new ApiError(await readErrorMessage(response), response.status);
}

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const { state: auth, expireSession } = useAuth();
  const signedIn = auth.status === "signed-in";
  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  const [doneSteps, setDoneSteps] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const journeysRef = useRef<Journey[] | null>(null);
  journeysRef.current = journeys;

  const handleFailure = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof ApiError && error.status === 401) expireSession();
      setSyncError(errorText(error, fallback));
    },
    [expireSession],
  );

  // Saved journeys from the database, newest first, then the two samples.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const samples = buildMockJourneys();
    apiFetch("/journeys")
      .then((data) => {
        if (cancelled) return;
        const list = ((data as { journeys?: unknown[] } | null)?.journeys ?? []).map(readJourney);
        setJourneys([...list, ...samples]);
        setDoneSteps({ ...MOCK_DONE_STEPS, ...Object.fromEntries(list.map((j) => [j.id, j.doneSteps])) });
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) return expireSession();
        setJourneys(samples);
        setDoneSteps(MOCK_DONE_STEPS);
        setLoadError(errorText(error, "Your saved journeys could not be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, attempt, expireSession]);

  const isSaved = (journeyId: string) => journeysRef.current?.find((j) => j.id === journeyId)?.sample === false;

  const addJourney = useCallback<JourneyStore["addJourney"]>(async ({ crop, sownOn, location, coordinates }) => {
    try {
      const body = coordinates ? { crop, sownOn, location, coordinates } : { crop, sownOn, location };
      const data = await apiFetch("/journeys", { method: "POST", body });
      const journey = readJourney((data as { journey?: unknown } | null)?.journey);
      setJourneys((current) => [journey, ...(current ?? [])]);
      setDoneSteps((current) => ({ ...current, [journey.id]: journey.doneSteps }));
      return journey.id;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) expireSession();
      throw error;
    }
  }, [expireSession]);

  const addEntry = useCallback<JourneyStore["addEntry"]>(
    (journeyId, { photo, ...entry }) => {
      const id = tempId();
      const replace = (update: (entries: JourneyEntry[]) => JourneyEntry[]) =>
        setJourneys((current) => current?.map((j) => (j.id === journeyId ? { ...j, entries: update(j.entries) } : j)) ?? current);
      // Shown at once; saved journeys then confirm with the server or roll back.
      replace((entries) => [...entries, { ...entry, id }]);
      if (!isSaved(journeyId)) return;
      apiFetch(`/journeys/${journeyId}/entries`, {
        method: "POST",
        body: { date: entry.date, type: entry.type, details: entry.details },
      })
        .then((data) => {
          const saved = (data as { entry?: { id?: unknown } } | null)?.entry;
          if (typeof saved?.id !== "string") return;
          const savedId = saved.id;
          replace((entries) => entries.map((e) => (e.id === id ? { ...e, id: savedId } : e)));
          // The entry is saved; now its photo. The local preview stays on screen meanwhile.
          if (photo) {
            uploadPhoto(journeyId, savedId, photo).catch((error: unknown) =>
              handleFailure(error, "The photo could not be saved; the entry text was kept."),
            );
          }
        })
        .catch((error: unknown) => {
          replace((entries) => entries.filter((e) => e.id !== id));
          handleFailure(error, "That entry could not be saved, so it was removed.");
        });
    },
    [handleFailure],
  );

  const setStepDone = useCallback<JourneyStore["setStepDone"]>(
    (journeyId, stepId, done) => {
      const apply = (value: boolean) =>
        setDoneSteps((current) => {
          const steps = new Set(current[journeyId] ?? []);
          if (value) steps.add(stepId);
          else steps.delete(stepId);
          return { ...current, [journeyId]: [...steps] };
        });
      apply(done);
      if (!isSaved(journeyId)) return;
      apiFetch(`/journeys/${journeyId}/steps/${encodeURIComponent(stepId)}`, { method: "PUT", body: { done } }).catch(
        (error: unknown) => {
          apply(!done);
          handleFailure(error, "That step could not be saved, so the tick was undone.");
        },
      );
    },
    [handleFailure],
  );

  const retryLoad = useCallback(() => setAttempt((n) => n + 1), []);
  const clearSyncError = useCallback(() => setSyncError(null), []);

  const value = useMemo(
    () => ({ journeys, loadError, retryLoad, syncError, clearSyncError, addEntry, addJourney, doneSteps, setStepDone }),
    [journeys, loadError, retryLoad, syncError, clearSyncError, addEntry, addJourney, doneSteps, setStepDone],
  );
  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourneys() {
  const store = useContext(JourneyContext);
  if (!store) throw new Error("useJourneys must be used inside JourneyProvider");
  return store;
}
