"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  CloudSun,
  ListChecks,
  MapPin,
  Menu,
  MessageCircle,
  Route,
  ScanLine,
  Search,
  Sprout,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react"
import { SowChart, Spec, SpecGrid, buttonClass, type SowState } from "@/components/shared/ui-kit"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------
   Real example, captured from this app's own backend
   (POST /api/planting/plan · Baton Rouge, LA · Glycine max · 2023–2025 NASA
   POWER monthly normals · generated 2026-11-12). Nothing here is invented;
   refresh it by running the planting tool again.
------------------------------------------------------------------------- */
const example = {
  crop: "Soybean",
  scientificName: "Glycine max",
  place: "Baton Rouge, Louisiana",
  baseline: "2023–2025 NASA POWER normals",
  window: "Apr–Oct",
  suitable: "7 of 12",
  annualRain: "56.0 in",
  optimum: "68–91°F",
  months: [
    ["off", "49.6°F, 7.2 in"],
    ["off", "57.2°F, 3.5 in"],
    ["off", "62.7°F, 5.0 in"],
    ["window", "68.8°F, 4.8 in"],
    ["window", "76.0°F, 6.5 in"],
    ["window", "82.6°F, 4.4 in"],
    ["window", "84.5°F, 6.1 in"],
    ["window", "86.2°F, 3.3 in"],
    ["window", "80.8°F, 3.5 in"],
    ["window", "72.2°F, 2.2 in"],
    ["off", "62.9°F, 3.6 in"],
    ["off", "53.7°F, 5.9 in"],
  ] as Array<[SowState, string]>,
}

const tools: Array<{ title: string; href: string; icon: LucideIcon; body: string; data: string }> = [
  {
    title: "Crop Journeys",
    href: "/journeys",
    icon: Route,
    body: "Follow one crop from sowing to harvest. A crop expert says what to do at each stage and why, warns about frost, heat, rain or dry spells, and reacts to everything you log.",
    data: "Open-Meteo forecast · NASA POWER · FAO ECOCROP · Gemini",
  },
  {
    title: "Plant Health",
    href: "/plant-health",
    icon: ScanLine,
    body: "Photograph a leaf to check it for disease, with a probability on every result and this week's actions tied to the weather.",
    data: "Pl@ntNet · Gemini · Open-Meteo",
  },
  {
    title: "Season Comparison",
    href: "/season-comparison",
    icon: Wheat,
    body: "Set a past season’s observed weather against the coming seasonal outlook, then see whether each crop you grew still fits.",
    data: "NASA POWER · Open-Meteo seasonal · FAO ECOCROP",
  },
  {
    title: "Planting & Weather",
    href: "/planting-weather",
    icon: CloudSun,
    body: "A month-by-month planting window for any crop in the ECOCROP catalog, from local climate normals.",
    data: "NASA POWER · FAO ECOCROP",
  },
  {
    title: "Crop Finder",
    href: "/crop-finder",
    icon: Sprout,
    body: "Describe your farm and get 30 crops ranked against its 30-year climate, soil and water, with the reasons for each score.",
    data: "NASA POWER · FAO ECOCROP",
  },
  {
    title: "Improvement Plan",
    href: "/improvement-plan",
    icon: ListChecks,
    body: "A month-by-month season plan for your farm and crop, with a reason on every task. Ticks and field notes save to your account.",
    data: "Your farm profile · NASA POWER",
  },
  {
    title: "AI Assistant",
    href: "/assistant",
    icon: MessageCircle,
    body: "Plain-language answers about crops, seasons and next steps, from your farm profile, or from a crop journey when you ask from one.",
    data: "Gemini · your farm profile",
  },
]

const sources = [
  {
    name: "NASA POWER",
    role: "Observed daily and monthly temperature and rainfall for any point, used for past seasons and climate normals.",
  },
  {
    name: "Open-Meteo",
    role: "Current conditions and the 7-day forecast behind field alerts, plus the ECMWF SEAS5 seasonal outlook, always labelled as an outlook.",
  },
  {
    name: "FAO ECOCROP",
    role: "Optimal temperature and annual rainfall ranges for thousands of crop species.",
  },
  {
    name: "Pl@ntNet",
    role: "Plant and disease identification from a leaf photo, each result with its probability.",
  },
  {
    name: "Google Gemini",
    role: "Writes the crop expert's advice and the assistant's answers from the facts above. Its answers are checked and labelled as AI.",
  },
  {
    name: "OpenStreetMap",
    role: "Place search (Nominatim) and the maps that show where an answer applies.",
  },
]

const nav = [
  { label: "How it works", href: "#how" },
  { label: "Tools", href: "#tools" },
  { label: "Data", href: "#data" },
]

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-marigold text-forest-deep">
        <Sprout size={19} strokeWidth={2.1} aria-hidden="true" />
      </span>
      <span className={cn("font-display text-[18px] leading-none", light ? "text-white" : "text-ink")}>
        ClimateCrop <span className={light ? "text-marigold" : "text-forest-mid"}>AI</span>
      </span>
    </span>
  )
}

/** Plays the sow chart once, when it scrolls into view: the page's one dealt moment. */
function SowMoment() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className="min-h-[120px]">
      {visible ? (
        <SowChart
          legend={{ window: "Planting window", off: "Outside the crop’s optimum" }}
          months={example.months.map(([state, detail]) => ({ state, detail }))}
        />
      ) : (
        <SowChart
          animate={false}
          legend={{ window: "Planting window", off: "Outside the crop’s optimum" }}
          months={example.months.map(() => ({ state: "off" as SowState }))}
        />
      )}
    </div>
  )
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-ground text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-[10px] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-forest focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* ------------------------------------------------------------ hero */}
      <header className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-forest-deep text-white">
        <Image
          src="/images/agfarm-hero.webp"
          alt="A tractor spraying long rows of young soybean plants at sunset"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[62%_center]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(18_48_31/0.8)_0%,transparent_22%),linear-gradient(90deg,rgb(18_48_31/0.92)_0%,rgb(18_48_31/0.72)_42%,rgb(18_48_31/0.1)_78%),linear-gradient(0deg,rgb(18_48_31/0.75)_0%,transparent_45%)]"
        />

        <nav
          aria-label="Main navigation"
          className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-5 py-5 sm:px-8"
        >
          <Link href="/" aria-label="ClimateCrop AI home" className="rounded-[10px] focus-visible:outline-marigold">
            <Wordmark light />
          </Link>
          <ul className="hidden items-center gap-8 md:flex">
            {nav.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="relative text-[15px] font-medium text-white/85 transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-marigold after:transition-transform after:duration-300 hover:text-white hover:after:scale-x-100"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className={buttonClass({ variant: "marigold", size: "sm", className: "hidden sm:inline-flex" })}>
              Open the workspace <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-[10px] text-white hover:bg-white/10 md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </nav>
        {menuOpen && (
          <div className="mx-5 animate-in rounded-[14px] bg-panel p-2 text-ink shadow-xl fade-in-0 slide-in-from-top-2 md:hidden">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-[10px] px-3 py-3 text-[15px] font-semibold hover:bg-forest-tint"
              >
                {item.label}
              </a>
            ))}
            <Link href="/dashboard" className={buttonClass({ className: "mt-1 w-full" })}>
              Open the workspace
            </Link>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-5 pt-10 pb-16 sm:px-8">
          <div className="max-w-[880px]">
            <h1 className="animate-rise font-display text-[clamp(2.5rem,5.4vw,4.6rem)] leading-[1.03] text-balance">
              Climate records, turned into planting decisions.
            </h1>
            <p
              className="mt-6 max-w-[54ch] animate-rise text-[18px] leading-[1.6] text-white/85"
              style={{ animationDelay: "120ms" }}
            >
              Pick a place and a crop. ClimateCrop AI finds the months it fits, follows it from sowing to
              harvest with an expert at your side, and explains every answer in plain language.
            </p>
            <div className="mt-9 flex animate-rise flex-wrap gap-3" style={{ animationDelay: "220ms" }}>
              <Link href="/dashboard" className={buttonClass({ variant: "marigold", size: "lg" })}>
                Open the workspace <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a
                href="#how"
                className={buttonClass({
                  variant: "ghost",
                  size: "lg",
                  className: "border border-white/35 text-white hover:bg-white/10 hover:text-white",
                })}
              >
                See how it works
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/15 bg-forest-deep/40 backdrop-blur-sm">
          <p className="mx-auto max-w-[1240px] px-5 py-4 text-[14px] text-white/75 sm:px-8">
            Built on NASA POWER, Open-Meteo, FAO ECOCROP, Pl@ntNet and OpenStreetMap.
          </p>
        </div>
      </header>

      <main id="main-content">
        {/* ------------------------------------------------ the answer */}
        <section id="how" aria-labelledby="how-heading" className="scroll-mt-4 py-20 sm:py-28">
          <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div>
              <h2 id="how-heading" className="font-display text-[clamp(2rem,3.6vw,3rem)] leading-[1.06] text-balance">
                One location, three questions answered.
              </h2>
              <ol className="mt-8 space-y-6">
                {[
                  ["Choose where you grow", "Search any city, parish or address. Every tool starts from that point on the map."],
                  ["Pick crops and a season", "Search thousands of species in the FAO ECOCROP catalog and set the months you care about."],
                  ["Read the answer", "See what changed, when a crop fits, and what to check next, with every source named."],
                ].map(([title, body], index) => (
                  <li key={title} className="flex gap-4">
                    <span className="tabular flex size-9 shrink-0 items-center justify-center rounded-full bg-forest text-[14px] font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-heading text-[18px] font-bold">{title}</h3>
                      <p className="mt-1 text-[16px] leading-[1.6] text-ink-soft">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <figure
              aria-labelledby="example-heading"
              className="rounded-[18px] bg-panel p-5 shadow-[0_1px_2px_rgb(18_48_31/0.06),0_30px_60px_-30px_rgb(18_48_31/0.35)] sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p id="example-heading" className="font-display text-[28px] leading-tight">
                    {example.crop}
                  </p>
                  <p className="mt-1 text-[14px] text-ink-mute">
                    <em>{example.scientificName}</em> · {example.place}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-tint px-3 py-1.5 text-[13px] font-semibold text-forest">
                  <MapPin size={14} aria-hidden="true" /> Real result
                </span>
              </div>
              <SpecGrid columns={4} className="mt-5">
                <Spec label="Window" tone="forest" value={example.window} />
                <Spec label="Suitable" value={example.suitable} />
                <Spec label="Rainfall" tone="sow" value={example.annualRain} />
                <Spec label="Optimum" tone="clay" value={example.optimum} />
              </SpecGrid>
              <div className="mt-6">
                <SowMoment />
              </div>
              <p className="mt-5 border-t border-line-soft pt-4 text-[13px] leading-[1.55] text-ink-mute">
                Output of the Planting &amp; Weather tool from {example.baseline} and the FAO ECOCROP
                optimum, generated November 12, 2026.
              </p>
            </figure>
          </div>
        </section>

        {/* ------------------------------------------------------ tools */}
        <section id="tools" aria-labelledby="tools-heading" className="scroll-mt-4 bg-panel py-20 sm:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="lg:sticky lg:top-10 lg:self-start">
              <h2 id="tools-heading" className="font-display text-[clamp(2rem,3.6vw,3rem)] leading-[1.06] text-balance">
                Seven tools, one workspace.
              </h2>
              <p className="mt-5 max-w-[46ch] text-[17px] leading-[1.6] text-ink-soft">
                Each one starts from your exact location and public climate records. Crop Journeys ties
                them together for one crop, from sowing to harvest.
              </p>
              <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[16px]">
                <Image
                  src="/images/rice-field.webp"
                  alt="Flooded rice rows reflecting a pink sunrise, with a tree line behind"
                  fill
                  sizes="(max-width: 1024px) 100vw, 480px"
                  className="object-cover transition-transform duration-700 ease-out hover:scale-[1.03]"
                />
              </div>
            </div>
            <ul className="divide-y divide-line border-y border-line">
              {tools.map(({ title, href, icon: Icon, body, data }) => (
                <li key={href}>
                  <Link href={href} className="group flex gap-5 py-7 transition-colors">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-forest text-marigold transition-transform duration-200 group-hover:-translate-y-0.5">
                      <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-display text-[21px] leading-tight text-ink">
                        {title}
                        <ArrowRight
                          size={18}
                          className="text-forest-mid transition-transform duration-200 group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-2 block text-[16px] leading-[1.6] text-ink-soft">{body}</span>
                      <span className="mt-2 block text-[13.5px] font-semibold text-ink-mute">{data}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------- data */}
        <section id="data" aria-labelledby="data-heading" className="scroll-mt-4 py-20 sm:py-28">
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <div className="max-w-[680px]">
              <h2 id="data-heading" className="font-display text-[clamp(2rem,3.6vw,3rem)] leading-[1.06] text-balance">
                Every number has a source.
              </h2>
              <p className="mt-5 text-[17px] leading-[1.6] text-ink-soft">
                Results name the dataset they came from, and missing values stay marked as unavailable
                rather than filled in.
              </p>
            </div>
            <dl className="mt-12 grid gap-px overflow-hidden rounded-[16px] border border-line bg-line sm:grid-cols-2">
              {sources.map((source) => (
                <div key={source.name} className="bg-panel p-6 sm:p-8">
                  <dt className="font-display text-[22px] text-forest">{source.name}</dt>
                  <dd className="mt-2 text-[16px] leading-[1.6] text-ink-soft">{source.role}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* -------------------------------------------------------- close */}
        <section aria-labelledby="start-heading" className="relative isolate overflow-hidden bg-forest-deep text-white">
          <Image
            src="/images/louisiana-farm.webp"
            alt="A farmer walking between green crop rows in morning light"
            fill
            sizes="100vw"
            className="-z-20 object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-forest-deep/75" />
          <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-8 px-5 py-24 sm:px-8 sm:py-32 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[620px]">
              <h2 id="start-heading" className="font-display text-[clamp(2rem,4vw,3.4rem)] leading-[1.05] text-balance">
                Start with where you grow.
              </h2>
              <p className="mt-4 text-[17px] leading-[1.6] text-white/80">
                Search your location once. Season comparison and planting windows pick it up from there.
              </p>
            </div>
            <Link href="/dashboard" className={buttonClass({ variant: "marigold", size: "lg" })}>
              <Search size={17} aria-hidden="true" /> Find my location
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-forest-deep text-white/75">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Wordmark light />
            <p className="mt-4 text-[14px] leading-[1.6]">
              Climate records turned into planting decisions. A TechXpo 2026 project. Not a substitute
              for advice from your local extension office.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-[14.5px]">
            {tools.map((tool) => (
              <Link key={tool.href} href={tool.href} className="hover:text-white hover:underline">
                {tool.title}
              </Link>
            ))}
            <Link href="/dashboard" className="hover:text-white hover:underline">
              Overview
            </Link>
          </nav>
        </div>
        <p className="mx-auto max-w-[1240px] border-t border-white/10 px-5 py-5 text-[13px] text-white/55 sm:px-8">
          Data: NASA POWER, Open-Meteo, FAO ECOCROP. Maps and place search © OpenStreetMap contributors.
        </p>
      </footer>
    </div>
  )
}
