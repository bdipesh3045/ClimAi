"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, CalendarDays, Cloud, CloudRain, CloudSun, Droplets, Sun, ThermometerSun } from "lucide-react"
import { PageIntro } from "@/components/shared/page-intro"
import { PlantingBrief } from "@/components/weather/planting-brief"
import { useAppData } from "@/components/providers/app-data-provider"
import { plantingWindows } from "@/lib/demo-data"
import { demoClimateService } from "@/lib/climate-service"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

const crops = [
  { value: "rice", label: "Rice" },
  { value: "soybeans", label: "Soybeans" },
  { value: "corn", label: "Corn" },
  { value: "wheat", label: "Wheat" },
  { value: "cotton", label: "Cotton" },
]
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Demo data stores icon keys; the brief and tables should show words. */
function skyLabel(icon: string): string {
  if (icon === "rain") return "Rain"
  if (icon === "sun") return "Sunny"
  return "Sun and cloud"
}

export function PlantingWeather() {
  const { location } = useAppData()
  const snapshot = demoClimateService.getDashboardSnapshot(location)
  const forecastDays = demoClimateService.getSevenDayForecast(location)
  const activeAlerts = demoClimateService.getActiveWeatherAlerts(location)
  const [crop, setCrop] = useState("rice")
  const [year, setYear] = useState(2026)
  const window = plantingWindows[crop]
  const selectedCrop = crops.find((item) => item.value === crop)?.label ?? "Rice"
  const todayMonth = new Date().getMonth()
  const inWindow = todayMonth >= window.start && todayMonth <= window.end
  const windowStatus = inWindow ? "Inside the typical window" : todayMonth < window.start ? "Before the typical window" : "After the typical window"
  const cropTimeline = useMemo(() => months.map((month, index) => ({ month, active: index >= window.start && index <= window.end })), [window])

  // Everything the generated brief may show, copied from the values rendered
  // below. It carries its own provenance so the model cannot dress simulated
  // numbers up as a live forecast.
  const briefContext = useMemo(
    () => ({
      location,
      crop: selectedCrop,
      year,
      typicalWindow: {
        startMonth: months[window.start],
        endMonth: months[window.end],
        months: months.filter((_, index) => index >= window.start && index <= window.end),
        note: window.note,
        status: windowStatus,
      },
      calendar: months.map((month, index) => ({
        month,
        inTypicalWindow: index >= window.start && index <= window.end,
      })),
      currentConditions: {
        temperatureF: snapshot.temperatureF,
        conditions: snapshot.conditions,
        recentRainfallInches: snapshot.recentRainfallInches,
        provenance: "simulated demo values",
      },
      sevenDayOutlook: forecastDays.map((day) => ({
        day: day.day,
        highF: day.high,
        lowF: day.low,
        rainChancePct: day.rain,
        sky: skyLabel(day.icon),
      })),
      alerts: activeAlerts.map((alert) => ({
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
      })),
      disclaimer:
        "Simulated demonstration data. No live weather provider or alert feed is connected, so these values must not guide field decisions.",
    }),
    [
      location,
      selectedCrop,
      year,
      window,
      windowStatus,
      snapshot.temperatureF,
      snapshot.conditions,
      snapshot.recentRainfallInches,
      forecastDays,
      activeAlerts,
    ],
  )

  return (
    <div>
      <PageIntro eyebrow="Plan with the season" title="Know when to plant. Stay ahead of weather." description="Use an at-a-glance planting calendar and forecast-style preview to plan what to check next. Live forecasts and alerts are not connected in this demo." />

      <section className="mb-7 grid gap-4 rounded-2xl border border-[#e7ebe5] bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5">
        <div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#8a9389] uppercase">Plan for</p><p className="mt-1 font-heading text-lg font-bold">{location}</p><p className="mt-1 text-xs text-[#8a9389]">Location is a demonstration selection, not verified farm coordinates.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-[#637064]">Crop<Select value={crop} onValueChange={(value) => value && setCrop(value)}><SelectTrigger aria-label="Planting calendar crop" className="w-full bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{crops.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select></label>
          <div className="flex flex-col gap-1.5"><span className="text-[11px] font-semibold text-[#637064]">Season year</span><div className="flex h-8 items-center justify-between gap-4 rounded-lg border border-[#e7ebe5] px-2"><Button type="button" variant="ghost" size="icon-sm" aria-label="Previous year" onClick={() => setYear((value) => value - 1)}><ArrowLeft /></Button><span className="text-xs font-semibold">{year} · illustrative</span><Button type="button" variant="ghost" size="icon-sm" aria-label="Next year" onClick={() => setYear((value) => value + 1)}><ArrowRight /></Button></div></div>
        </div>
      </section>

      <div className="mb-7">
        <PlantingBrief
          key={`${location}-${crop}-${year}`}
          context={briefContext}
        />
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="rounded-2xl border border-[#e7ebe5] bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#8a9389] uppercase">Typical regional timing · not a forecast</p><h2 className="mt-1 font-heading text-xl font-bold">{selectedCrop} planting window</h2><p className="mt-2 text-xs leading-5 text-[#788278]">{window.note}</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-[#f1f6ed] text-[#398253]"><CalendarDays size={18} /></span></div>
          <div className="mt-8 grid grid-cols-6 gap-2 sm:grid-cols-12 sm:gap-3" aria-label={`${selectedCrop} typical planting calendar for ${year}`}>
            {cropTimeline.map(({ month, active }) => <div key={month} className="flex flex-col items-center gap-2"><span className={`h-2 w-full rounded-full ${active ? "bg-[#398253]" : "bg-[#edf0eb]"}`} aria-hidden="true" /><span className={`text-[10px] ${active ? "font-semibold text-[#286540]" : "text-[#959d95]"}`}>{month}</span></div>)}
          </div>
          <div className="mt-8 flex flex-col gap-3 rounded-xl bg-[#f6f8f3] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#55725a]">{windowStatus}</span><p className="mt-2 text-xs leading-5 text-[#687469]">Actual field readiness depends on soil temperature, moisture, variety, and local advice.</p></div>
            <p className="shrink-0 text-xs font-semibold text-[#315e3b]">{months[window.start]} – {months[window.end]}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-[10px] text-[#7e877e]"><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-[#398253]" />Typical planting period</span><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-[#edf0eb]" />Outside typical period</span></div>
        </div>

        <section className="rounded-2xl bg-[#eaf4f7] p-5 sm:p-6" aria-labelledby="conditions-preview-heading">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#6a8e97] uppercase">Current conditions · demo</p><h2 id="conditions-preview-heading" className="mt-1 font-heading text-lg font-bold">A weather preview</h2><p className="mt-1 text-xs text-[#6d8184]">{location}</p></div><CloudSun size={20} className="text-[#588492]" /></div>
          <div className="mt-5 flex items-end gap-3"><span className="font-heading text-5xl font-semibold tracking-[-0.07em] text-[#25444b]">{snapshot.temperatureF}°</span><div className="pb-1"><p className="text-sm font-medium text-[#365961]">{snapshot.conditions}</p><p className="mt-1 text-[10px] text-[#708589]">Sample conditions only</p></div></div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#d5e6e9] pt-4"><WeatherStat label="Recent rain" value={`${snapshot.recentRainfallInches.toFixed(2)} in`} icon={Droplets} /><WeatherStat label="High / low" value="76° / 58°" icon={ThermometerSun} /></div>
          <p className="mt-5 text-[10px] leading-4 text-[#708589]">No live weather provider is connected. Values below are simulated and should not guide immediate field decisions.</p>
        </section>
      </section>

      <section className="mt-7 rounded-2xl border border-[#e7ebe5] bg-white p-5 sm:p-7" aria-labelledby="forecast-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#8a9389] uppercase">Seven-day preview · simulated</p><h2 id="forecast-heading" className="mt-1 font-heading text-xl font-bold">Forecast outlook</h2></div><span className="rounded-full bg-[#eef4f7] px-3 py-1.5 text-[10px] font-medium text-[#64848c]">Not live weather</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {forecastDays.map((day) => <article key={day.day} className="rounded-xl bg-[#f8faf8] p-3.5 sm:p-4"><p className="text-[10px] font-semibold text-[#5e6b60]">{day.day}</p><ForecastIcon icon={day.icon} /><p className="mt-2 font-heading text-lg font-bold">{day.high}° <span className="text-xs font-medium text-[#969e96]">{day.low}°</span></p><p className="mt-2 flex items-center gap-1.5 text-[10px] text-[#698b96]"><Droplets size={11} />{day.rain}% rain</p></article>)}
        </div>
      </section>

      <section className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-[#d8e2d5] bg-[#fbfcf9] p-5" aria-labelledby="alerts-heading">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e6f5fa] text-[#5c8b97]"><CloudRain size={17} /></span>
        <div><h2 id="alerts-heading" className="text-sm font-semibold">Weather alerts</h2>{activeAlerts.length === 0 ? <p className="mt-1 text-xs leading-5 text-[#777f77]">No active alerts are available to display. A live weather alert feed is not connected, so this page does not infer or fabricate warnings.</p> : <ul className="mt-2 flex flex-col gap-2">{activeAlerts.map((alert) => <li key={alert.id} className="text-xs leading-5 text-[#777f77]"><span className="font-semibold">{alert.severity}: {alert.title}.</span> {alert.description}</li>)}</ul>}</div>
      </section>
    </div>
  )
}

function WeatherStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Droplets }) {
  return <div className="rounded-xl bg-white/70 p-3"><p className="flex items-center gap-1.5 text-[10px] text-[#759097]"><Icon size={12} />{label}</p><p className="mt-1.5 font-heading text-sm font-bold text-[#34545c]">{value}</p></div>
}

function ForecastIcon({ icon }: { icon: string }) {
  const Icon = icon === "rain" ? CloudRain : icon === "sun" ? Sun : Cloud
  return <span className="mt-3 flex size-8 items-center justify-center rounded-full bg-[#eaf4f7] text-[#648d97]"><Icon size={16} aria-hidden="true" /></span>
}
