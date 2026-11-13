"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Field, HelpText, Panel, buttonClass, inputClass, selectClass, textareaClass } from "@/components/shared/ui-kit";
import { useJourneys } from "@/components/journeys/journey-store";
import { ACTION_LABELS, todayIso, type ActionType, type Journey } from "@/lib/journeys";

const TYPES = Object.keys(ACTION_LABELS) as ActionType[];

/** Inline form above the timeline. Saving adds the entry to the top straight away. */
export function AddEntryForm({ journey, onClose }: { journey: Journey; onClose: () => void }) {
  const { addEntry } = useJourneys();
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<ActionType>("watering");
  const [details, setDetails] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const kept = useRef(false);

  // Release a picked photo if the form closes without saving it.
  useEffect(() => () => {
    if (photo && !kept.current) URL.revokeObjectURL(photo);
  }, [photo]);

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    setError("");
    setPhoto(URL.createObjectURL(file));
    setPhotoFile(file);
    if (type === "note") setType("photo");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!details.trim() && !photo) return setError("Add a short note or a photo.");
    if (date < journey.sownOn) return setError("The date can't be before sowing.");
    if (date > todayIso()) return setError("The date can't be in the future.");
    kept.current = true;
    addEntry(journey.id, {
      date,
      type: photo && type !== "photo" && !details.trim() ? "photo" : type,
      details: details.trim() || "Photo added.",
      photoUrl: photo ?? undefined,
      photo: photoFile ?? undefined, // uploaded (shrunk, location data removed) once the entry is saved
    });
    onClose();
  }

  return (
    <Panel tone="quiet" className="mt-4 border border-line p-4 sm:p-5" aria-label="Add a journey entry">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="entry-date">
          <input
            id="entry-date"
            type="date"
            value={date}
            min={journey.sownOn}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Action" htmlFor="entry-type">
          <select id="entry-type" value={type} onChange={(e) => setType(e.target.value as ActionType)} className={selectClass}>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {ACTION_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Details" htmlFor="entry-details" className="sm:col-span-2">
          <textarea
            id="entry-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g. Irrigated about 1 inch after a dry week."
            className={textareaClass}
            maxLength={500}
          />
        </Field>
        <div className="sm:col-span-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="sr-only" id="entry-photo" />
          {photo ? (
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={photo} alt="Selected photo preview" className="h-24 w-36 rounded-[10px] border border-line object-cover" />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(photo);
                  setPhoto(null);
                  setPhotoFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className={buttonClass({ variant: "ghost", size: "sm" })}
              >
                <X size={14} aria-hidden="true" />
                Remove photo
              </button>
            </div>
          ) : (
            <label htmlFor="entry-photo" className={buttonClass({ variant: "secondary", size: "sm", className: "cursor-pointer" })}>
              <ImagePlus size={15} aria-hidden="true" />
              Add a photo (optional)
            </label>
          )}
        </div>
        <div className="flex gap-3 sm:col-span-2">
          <button type="submit" className={buttonClass()}>
            Save entry
          </button>
          <button type="button" onClick={onClose} className={buttonClass({ variant: "ghost" })}>
            Cancel
          </button>
        </div>
      </form>
      {error && <HelpText tone="error">{error}</HelpText>}
    </Panel>
  );
}
