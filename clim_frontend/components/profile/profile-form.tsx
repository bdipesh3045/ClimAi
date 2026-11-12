"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowRight, LoaderCircle, Save } from "lucide-react"
import { useAccount, useAuth } from "@/components/providers/auth-provider"
import { FarmLocationSearch, type FarmLocation } from "@/components/shared/farm-location-search"
import { ChoiceCard, SectionShell, fieldClass } from "@/components/shared/form-parts"
import { ApiError, apiFetch, errorText } from "@/lib/api"
import {
  CROP_OPTIONS,
  IRRIGATION_CHOICES,
  IRRIGATION_METHODS,
  SOIL_OPTIONS,
  type IrrigationChoice,
} from "@/lib/farm-options"
import { parseProfile, type FarmSizeUnit, type ProfileInput } from "@/lib/session"

// Same limits as clim_backend/accounts.py, so the browser catches most mistakes first.
const MAX_NAME_LENGTH = 100
const MAX_PHONE_LENGTH = 30
const PHONE_PATTERN = "[0-9 +\\(\\)\\-]{5,30}"
const MIN_FARM_SIZE = 0.01

const labelClass = "mb-2 block text-[12px] font-bold tracking-[0.12em] text-[#5d7267] uppercase"

type SaveState = { status: "idle" | "saved" | "error"; message: string }

function textField(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim()
}

function readProfileForm(form: FormData, location: FarmLocation, irrigation: IrrigationChoice): ProfileInput {
  const sizeUnit: FarmSizeUnit = form.get("farmSizeUnit") === "hectares" ? "hectares" : "acres"
  const hasIrrigation = irrigation === "yes"
  return {
    fullName: textField(form, "fullName"),
    phone: textField(form, "phone") || null,
    farmName: textField(form, "farmName") || null,
    location: location.label,
    coordinates: { lat: location.lat, lon: location.lon },
    farm: { size: Number(form.get("farmSize")), sizeUnit },
    soilType: textField(form, "soilType") || null,
    irrigation: { available: hasIrrigation, method: hasIrrigation ? textField(form, "irrigationMethod") || null : null },
    currentCrops: form.getAll("currentCrops").map(String),
  }
}

export function ProfileForm() {
  const account = useAccount()
  const { expireSession, updateProfile } = useAuth()
  const profile = account?.profile ?? null
  const [location, setLocation] = useState<FarmLocation | null>(() =>
    profile ? { label: profile.location, ...profile.coordinates } : null,
  )
  const [irrigation, setIrrigation] = useState<IrrigationChoice>(() =>
    profile ? (profile.irrigation.available ? "yes" : "no") : "",
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "" })

  if (!account) return null // AppShell shows a loading screen until the account is known

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (location === null) {
      setSaveState({ status: "error", message: "Search for your farm location and pick a result from the list." })
      return
    }

    setIsSaving(true)
    setSaveState({ status: "idle", message: "" })
    try {
      const body = readProfileForm(new FormData(event.currentTarget), location, irrigation)
      updateProfile(parseProfile(await apiFetch("/profile", { method: "PUT", body })))
      setSaveState({ status: "saved", message: "Profile saved." })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expireSession() // AppShell sends the farmer to sign in, then back here
        return
      }
      setSaveState({ status: "error", message: errorText(error, "Could not save your profile. Please try again.") })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-6 text-[#1d2a22]">
      <div>
        <h1 className="font-heading text-[34px] leading-[1.05] font-extrabold tracking-[-0.06em] text-[#172720] sm:text-[44px]">
          {profile ? "Your farm profile" : "Tell us about your farm"}
        </h1>
        <p className="mt-3 max-w-[680px] text-[15px] leading-7 text-[#5d6a60]">
          {profile
            ? "Keep these details current. The Crop Finder starts from them."
            : "Save these details once. The Crop Finder will fill them in for you every time."}
        </p>
        <p className="mt-2 text-[13px] text-[#6b7a6e]">
          Signed in as <span className="font-semibold text-[#27362a]">{account.user.email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <SectionShell step={1} title="About You" required>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className={labelClass}>Full name</span>
              <input
                name="fullName"
                type="text"
                required
                autoComplete="name"
                maxLength={MAX_NAME_LENGTH}
                defaultValue={profile?.fullName}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Phone (optional)</span>
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={MAX_PHONE_LENGTH}
                pattern={PHONE_PATTERN}
                title="Digits, spaces, and + - ( ) only"
                placeholder="e.g. +1 515 555 0100"
                defaultValue={profile?.phone ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Farm name (optional)</span>
              <input
                name="farmName"
                type="text"
                maxLength={MAX_NAME_LENGTH}
                placeholder="e.g. Prairie Creek Farm"
                defaultValue={profile?.farmName ?? ""}
                className={fieldClass}
              />
            </label>
          </div>
        </SectionShell>

        <SectionShell step={2} title="Farm Location" required>
          <FarmLocationSearch value={location} onChange={setLocation} />
        </SectionShell>

        <SectionShell step={3} title="Farm Details" required>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Farm size</span>
              <div className="flex gap-2">
                <input
                  name="farmSize"
                  type="number"
                  min={MIN_FARM_SIZE}
                  step="any"
                  required
                  placeholder="e.g. 24.5"
                  defaultValue={profile?.farm.size}
                  className={fieldClass}
                />
                <select
                  name="farmSizeUnit"
                  aria-label="Farm size unit"
                  defaultValue={profile?.farm.sizeUnit ?? "acres"}
                  className={`${fieldClass} max-w-36`}
                >
                  <option value="acres">Acres</option>
                  <option value="hectares">Hectares</option>
                </select>
              </div>
            </label>
            <label className="block">
              <span className={labelClass}>Soil type (optional)</span>
              <select name="soilType" defaultValue={profile?.soilType ?? ""} className={fieldClass}>
                <option value="">Select soil type</option>
                {SOIL_OPTIONS.map((soil) => (
                  <option key={soil} value={soil}>{soil}</option>
                ))}
              </select>
            </label>
          </div>
        </SectionShell>

        <SectionShell step={4} title="Water & Crops" rightLabel="Irrigation required, crops optional">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <fieldset>
                <legend className={labelClass}>Irrigation available</legend>
                <div className="flex gap-4 rounded-[12px] border border-[#dfe8df] bg-[#f9fbf9] px-3 py-3">
                  {IRRIGATION_CHOICES.map(({ label, value }) => (
                    <ChoiceCard
                      key={value}
                      name="irrigationAvailable"
                      value={value}
                      label={label}
                      type="radio"
                      variant="chip"
                      required
                      checked={irrigation === value}
                      onChange={() => setIrrigation(value)}
                    />
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className={labelClass}>Irrigation method</span>
                <select
                  name="irrigationMethod"
                  defaultValue={profile?.irrigation.method ?? ""}
                  disabled={irrigation !== "yes"}
                  required={irrigation === "yes"}
                  className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <option value="">Select a method</option>
                  {IRRIGATION_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset>
              <legend className={labelClass}>Crops you grow now</legend>
              <div className="flex flex-wrap gap-2">
                {CROP_OPTIONS.map((crop) => (
                  <ChoiceCard
                    key={crop}
                    name="currentCrops"
                    value={crop}
                    label={crop}
                    type="checkbox"
                    variant="chip"
                    defaultChecked={profile?.currentCrops.includes(crop)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        </SectionShell>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite" className="text-[13px]">
            {saveState.status === "saved" && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-[#1d4d31]">
                {saveState.message}
                <Link href="/crop-finder" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                  Find crops for this farm <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </p>
            )}
            {saveState.status === "error" && <p role="alert" className="text-[#a33c32]">{saveState.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1b4d35] px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_22px_rgba(27,77,53,0.2)] transition hover:bg-[#123d2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b4d35] disabled:cursor-wait disabled:opacity-70"
          >
            {isSaving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {isSaving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  )
}
