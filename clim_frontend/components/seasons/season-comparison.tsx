"use client"

import { useState } from "react"
import { ArrowDownRight, ArrowUpRight, CalendarDays, Plus, ThermometerSun } from "lucide-react"
import { PageIntro } from "@/components/shared/page-intro"
import { TemperatureComparisonChart, RainfallComparisonChart } from "@/components/charts/season-charts"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAppData } from "@/components/providers/app-data-provider"
import { seasonalSummary } from "@/lib/demo-data"
import { demoClimateService } from "@/lib/climate-service"

const seasonPairs = [
  { value: "2025-2026", label: "2025 vs 2026" },
  { value: "2024-2025", label: "2024 vs 2025" },
]
const challenges = ["Flooding", "Drought", "Pest problems", "Other"]

export function SeasonComparison() {
  const { location, observations, addObservation } = useAppData()
  const [crop, setCrop] = useState("Soybeans")
  const [seasonPair, setSeasonPair] = useState("2025-2026")
  const [formCrop, setFormCrop] = useState("Soybeans")
  const [plantingDate, setPlantingDate] = useState("")
  const [challenge, setChallenge] = useState("Other")
  const [notes, setNotes] = useState("")
  const [saved, setSaved] = useState(false)

  const isEarlierPair = seasonPair === "2024-2025"
  const chartData = demoClimateService.getSeasonComparison(seasonPair)
  const temperatureChange = chartData.reduce((total, item) => total + item.currentTemp - item.previousTemp, 0) / chartData.length
  const rainfallChange = chartData.reduce((total, item) => total + item.currentRain - item.previousRain, 0)

  function saveObservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    addObservation({ crop: formCrop, plantingDate, challenge, notes: notes.trim() })
    setPlantingDate("")
    setNotes("")
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2600)
  }

  const displayPreviousYear = isEarlierPair ? 2024 : seasonalSummary.previousYear
  const displayCurrentYear = isEarlierPair ? 2025 : seasonalSummary.currentYear

  return (
    <div>
      <PageIntro eyebrow="Learn from each season" title="What changed since last season?" description="Compare climate conditions across growing seasons to understand environmental changes. Keep measured-style demo data separate from notes you record about your own farm." />

      <section className="mb-6 rounded-2xl border border-[#e7ebe5] bg-white p-4 sm:p-5" aria-label="Comparison settings">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field><FieldLabel>Location</FieldLabel><Input value={location} readOnly aria-label="Comparison location" /></Field>
          <Field><FieldLabel>Crop</FieldLabel><Select value={crop} onValueChange={(value) => value && setCrop(value)}><SelectTrigger aria-label="Comparison crop" className="w-full bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{["Rice", "Corn", "Soybeans", "Wheat", "Cotton"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
          <Field><FieldLabel>Season pair</FieldLabel><Select value={seasonPair} onValueChange={(value) => value && setSeasonPair(value)}><SelectTrigger aria-label="Comparison season pair" className="w-full bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{seasonPairs.map((item) => <SelectItem key={item.value} value={item.value}>{item.label} · demo</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#758075]">
        <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-[#a8c5a5]" />Earlier season · {displayPreviousYear}</span>
        <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-[#398253]" />Later season · {displayCurrentYear}</span>
        <span className="rounded-full bg-[#f1f6ed] px-2.5 py-1 font-medium text-[#52745a]">Simulated climate data · not observations</span>
      </div>

      <section className="grid gap-5 xl:grid-cols-2" aria-label="Seasonal charts">
        <div className="rounded-2xl border border-[#e7ebe5] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold tracking-[0.13em] text-[#8a9389] uppercase">Monthly average</p><h2 className="mt-1 font-heading text-lg font-bold">Temperature comparison</h2><p className="mt-1 text-xs text-[#7e877e]">Monthly mean · °F</p></div><span className="flex size-9 items-center justify-center rounded-xl bg-[#eef5f7] text-[#5e8a96]"><ThermometerSun size={17} /></span></div>
          <div className="mt-4"><TemperatureComparisonChart data={chartData.map(({ month, previousTemp, currentTemp }) => ({ month, previous: previousTemp, current: currentTemp }))} /></div>
        </div>
        <div className="rounded-2xl border border-[#e7ebe5] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold tracking-[0.13em] text-[#8a9389] uppercase">Monthly total</p><h2 className="mt-1 font-heading text-lg font-bold">Rainfall comparison</h2><p className="mt-1 text-xs text-[#7e877e]">Monthly total · inches</p></div><span className="flex size-9 items-center justify-center rounded-xl bg-[#eef5f7] text-[#5e8a96]"><CalendarDays size={17} /></span></div>
          <div className="mt-4"><RainfallComparisonChart data={chartData.map(({ month, previousRain, currentRain }) => ({ month, previous: previousRain, current: currentRain }))} /></div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl bg-[#edf4ea] p-5 sm:p-6">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-[#64816a] uppercase">Season summary · simulated</p>
          <h2 className="mt-2 font-heading text-xl font-bold tracking-[-0.03em]">What changed for {crop.toLowerCase()}?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f6d60]">In this illustrative comparison for {location}, the later season averages {Math.abs(temperatureChange).toFixed(1)}° F {temperatureChange >= 0 ? "warmer" : "cooler"} than the earlier season, with simulated rainfall {rainfallChange >= 0 ? "up" : "down"} {Math.abs(rainfallChange).toFixed(1)} inches. These values are demonstration data—not measured observations or a climate record for your farm.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ComparisonStat label="Avg. temperature" value={`${temperatureChange >= 0 ? "+" : "−"}${Math.abs(temperatureChange).toFixed(1)}° F`} icon={temperatureChange >= 0 ? "up" : "down"} />
            <ComparisonStat label="Total rainfall" value={`${rainfallChange >= 0 ? "+" : "−"}${Math.abs(rainfallChange).toFixed(1)} in`} icon={rainfallChange >= 0 ? "up" : "down"} />
            <ComparisonStat label="Wet periods" value={`${seasonalSummary.wetPeriods}`} icon="down" />
            <ComparisonStat label="Dry periods" value={`${seasonalSummary.dryPeriods}`} icon="down" />
          </div>
          <p className="mt-4 text-[11px] leading-5 text-[#6f7b70]"><span className="font-semibold">Unusual weather:</span> Event-level records are not available in this demo, so no unusual conditions are inferred.</p>
        </div>

        <section className="rounded-2xl border border-[#e7ebe5] bg-white p-5 sm:p-6" aria-labelledby="farmer-history-heading">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-[#8a9389] uppercase">Your field history</p>
          <h2 id="farmer-history-heading" className="mt-2 font-heading text-xl font-bold tracking-[-0.03em]">Record an observation</h2>
          <p className="mt-2 text-xs leading-5 text-[#7e877e]">Your notes are saved in this browser for the demo. They are not climate measurements.</p>
          <form onSubmit={saveObservation} className="mt-5">
            <FieldSet>
              <FieldLegend className="sr-only">Farmer observation details</FieldLegend>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel>Crop planted</FieldLabel><Select value={formCrop} onValueChange={(value) => value && setFormCrop(value)}><SelectTrigger aria-label="Crop planted" className="w-full bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{["Rice", "Corn", "Soybeans", "Wheat", "Cotton", "Other"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
                <Field><FieldLabel htmlFor="planting-date">Approx. planting date</FieldLabel><Input id="planting-date" type="date" value={plantingDate} onChange={(event) => setPlantingDate(event.target.value)} /></Field>
                <Field className="sm:col-span-2"><FieldLabel>Challenge experienced</FieldLabel><Select value={challenge} onValueChange={(value) => value && setChallenge(value)}><SelectTrigger aria-label="Challenge experienced" className="w-full bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{challenges.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
                <Field className="sm:col-span-2"><FieldLabel htmlFor="field-notes">What did you notice?</FieldLabel><Textarea id="field-notes" maxLength={600} placeholder="Add a short note about timing, field conditions, or what you observed…" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
              </FieldGroup>
            </FieldSet>
            <Button type="submit" className="mt-4 rounded-full"><Plus data-icon="inline-start" />Save observation</Button>
            {saved && <p role="status" className="mt-3 text-xs font-medium text-[#286540]">Observation saved in this browser.</p>}
          </form>
        </section>
      </section>

      <section className="mt-7" aria-labelledby="observation-list-heading">
        <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.15em] text-[#8a9389] uppercase">Farmer-entered · browser saved</p><h2 id="observation-list-heading" className="mt-1 font-heading text-xl font-bold">Your season notes</h2></div><span className="rounded-full border border-[#e7ebe5] bg-white px-3 py-1.5 text-[10px] text-[#777f77]">{observations.length} {observations.length === 1 ? "note" : "notes"}</span></div>
        {observations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8e2d5] bg-[#fbfcf9] px-5 py-8 text-center"><p className="font-heading text-sm font-bold">No field notes yet</p><p className="mt-2 text-xs text-[#7e877e]">Saved observations will appear here, separate from the simulated climate charts.</p></div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">{observations.map((item) => <article key={item.id} className="rounded-2xl border border-[#e7ebe5] bg-white p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#f1f6ed] px-2.5 py-1 text-[10px] font-semibold text-[#286540]">{item.crop}</span><span className="text-[10px] text-[#899289]">{item.challenge}</span>{item.plantingDate && <span className="ml-auto text-[10px] text-[#899289]">Planted {item.plantingDate}</span>}</div><p className="mt-3 text-sm leading-6 text-[#465248]">{item.notes || "No additional details recorded."}</p><p className="mt-2 text-[10px] text-[#9aa39a]">Added {new Date(item.createdAt).toLocaleDateString()}</p></article>)}</div>
        )}
      </section>
    </div>
  )
}

function ComparisonStat({ label, value, icon }: { label: string; value: string; icon: "up" | "down" }) {
  const Icon = icon === "up" ? ArrowUpRight : ArrowDownRight
  return <div className="rounded-xl bg-white/80 p-3"><span className="flex items-center gap-1 text-[10px] font-medium text-[#69806b]"><Icon size={12} />{label}</span><p className="mt-1.5 font-heading text-lg font-bold text-[#2c5a3a]">{value}</p></div>
}
