import Image from "next/image"
import Link from "next/link"
import {
  ArrowUpRight,
  BookOpen,
  Droplets,
  PackageCheck,
  ShieldCheck,
  UsersRound,
  Waves,
  Monitor,
} from "lucide-react"

export function ClimateCropAbout() {
  return (
    <section id="about" className="mx-auto max-w-7xl scroll-mt-8 px-4 py-16 sm:px-8 sm:py-20">
      <div className="max-w-5xl">
        <p className="mb-4 text-xs font-bold tracking-[0.14em] text-brand-forest uppercase">About ClimateCrop</p>
        <h2 className="font-heading text-3xl leading-[1.22] font-bold tracking-[-0.045em] text-brand-dark sm:text-5xl sm:leading-[1.2]">
          We help farmers <span className="inline-flex -translate-y-1 align-middle"><InlineImage src="/images/louisiana-farm.png" alt="" className="size-10" /></span> improve productivity and sustainability through innovative <span className="inline-flex -translate-y-1 align-middle"><InlineImage src="/images/agfarm-impact.png" alt="" className="h-9 w-14" /></span> agricultural <span className="inline-flex -translate-y-1 align-middle"><InlineImage src="/images/soybean-field.png" alt="" className="size-10" /></span> solutions.
        </h2>
      </div>
    </section>
  )
}

function InlineImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  return <span className={`relative mx-1 inline-block overflow-hidden rounded-full border-2 border-white shadow-sm ${className}`}><Image src={src} alt={alt} fill sizes="56px" className="object-cover" /></span>
}

export function ClimateCropSolutions() {
  return (
    <section id="solutions" aria-labelledby="solutions-heading" className="mx-auto max-w-7xl scroll-mt-8 px-4 py-10 sm:px-8 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-brand-forest uppercase">What we do</p>
          <h2 id="solutions-heading" className="font-heading text-3xl font-extrabold tracking-[-0.045em] text-brand-dark sm:text-4xl">Solutions for agriculture</h2>
        </div>
        <Link href="#services" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-border bg-white px-5 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest">
          See all services <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        <article className="flex items-center justify-between gap-4 rounded-2xl border border-brand-border bg-white p-5 transition-colors hover:border-emerald-300 sm:px-8 sm:py-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-cream text-brand-forest"><Droplets size={23} aria-hidden="true" /></span>
            <div><h3 className="font-heading text-lg font-bold text-brand-dark sm:text-xl">Smart Irrigation</h3><p className="mt-1 text-sm text-brand-subtle">Precision watering for healthier crops and less waste.</p></div>
          </div>
          <Link href="#location-finder" aria-label="Explore smart irrigation telemetry" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand-dark transition-colors hover:bg-brand-forest hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest"><ArrowUpRight size={16} aria-hidden="true" /></Link>
        </article>

        <article className="rounded-3xl border border-brand-border bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-border pb-5">
            <div className="flex items-center gap-4 sm:gap-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-brand-forest"><Monitor size={23} aria-hidden="true" /></span>
              <div><h3 className="font-heading text-lg font-bold text-brand-forest sm:text-xl">Farming Methods</h3><p className="mt-1 text-sm text-brand-subtle">Modern techniques for efficient and sustainable agriculture.</p></div>
            </div>
            <Link href="#services" className="inline-flex min-h-9 items-center gap-2 rounded-full bg-brand-forest px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest">Read More <ArrowUpRight size={13} aria-hidden="true" /></Link>
          </div>
          <div className="mt-6 grid items-center gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="relative h-48 overflow-hidden rounded-2xl border border-brand-border bg-emerald-950 sm:h-56 lg:col-span-4"><Image src="/images/soybean-field.png" alt="Healthy crops growing in orderly field rows." fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" /></div>
            <div className="lg:col-span-8">
              <p className="text-sm leading-7 text-brand-subtle sm:text-base">Precision agriculture uses technology to manage field inputs with care. Data analytics, GPS mapping, and soil monitoring can help growers make informed decisions about water, nutrients, and planting.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-brand-dark"><span className="rounded-full bg-brand-cream px-3 py-1.5">Drone mapping</span><span className="rounded-full bg-brand-cream px-3 py-1.5">Nutrient planning</span><span className="rounded-full bg-brand-cream px-3 py-1.5">Variable-rate seeding</span></div>
            </div>
          </div>
        </article>

        <article className="flex items-center justify-between gap-4 rounded-2xl border border-brand-border bg-white p-5 transition-colors hover:border-emerald-300 sm:px-8 sm:py-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-cream text-brand-forest"><Waves size={23} aria-hidden="true" /></span>
            <div><h3 className="font-heading text-lg font-bold text-brand-dark sm:text-xl">Water Conservation</h3><p className="mt-1 text-sm text-brand-subtle">Smarter ways to save every drop in agriculture.</p></div>
          </div>
          <Link href="#location-finder" aria-label="Explore water conservation telemetry" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand-dark transition-colors hover:bg-brand-forest hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest"><ArrowUpRight size={16} aria-hidden="true" /></Link>
        </article>
      </div>
    </section>
  )
}

const services = [
  { icon: BookOpen, title: "Crop Cultivation", description: "Regional guidance shaped around your soil, crop, and growing season." },
  { icon: UsersRound, title: "Consulting Advisory", description: "Practical advice for planning seasonal yield and ecological resilience." },
  { icon: ShieldCheck, title: "Supply Chain", description: "Cold-storage routing, grain-loss reduction, and direct buyer connections." },
  { icon: PackageCheck, title: "Agricultural Products", description: "Drought-ready seeds, bio-inputs, and thoughtful soil amendments." },
]

export function ClimateCropServices() {
  return (
    <section id="services" aria-labelledby="services-heading" className="mx-auto max-w-7xl scroll-mt-8 px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto mb-10 max-w-xl text-center">
        <p className="mb-3 text-xs font-bold tracking-[0.14em] text-brand-forest uppercase">How we help</p>
        <h2 id="services-heading" className="font-heading text-3xl font-extrabold tracking-[-0.045em] text-brand-dark sm:text-4xl">Our Services</h2>
        <p className="mt-3 text-sm leading-6 text-brand-subtle">Dedicated to sustainable farming, useful technology, and empowering local growers.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map(({ icon: Icon, title, description }, index) => (
          <article key={title} className="flex min-h-60 flex-col justify-between rounded-3xl border border-brand-border bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-[0_14px_36px_-16px_rgba(15,38,23,0.2)] sm:p-7">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800"><Icon size={22} aria-hidden="true" /></span>
            <div><p className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-brand-subtle">0{index + 1}</p><h3 className="font-heading text-lg font-bold text-brand-dark">{title}</h3><p className="mt-2 text-xs leading-5 text-brand-subtle">{description}</p></div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ClimateCropImpact() {
  return (
    <section aria-labelledby="impact-heading" className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="relative isolate flex min-h-[430px] flex-col justify-between overflow-hidden rounded-3xl border border-emerald-950 bg-brand-forest p-7 text-white sm:min-h-[490px] sm:p-10 lg:p-14">
        <Image src="/images/agfarm-impact.png" alt="Two growers planting young crops together in a field." fill sizes="(max-width: 1280px) 100vw, 1280px" className="-z-20 object-cover object-center opacity-50" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(9,28,17,0.88)_0%,rgba(9,28,17,0.72)_55%,rgba(9,28,17,0.3)_100%)]" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl"><p className="mb-4 text-xs font-bold tracking-[0.15em] text-emerald-200 uppercase">Our impact</p><h2 id="impact-heading" className="font-heading text-3xl leading-tight font-extrabold tracking-[-0.045em] sm:text-4xl">Growing Impact,<br />Harvesting Success</h2><p className="mt-4 text-sm leading-6 text-white/80">Through dedication, smart innovation, and respect for nature, we help farms thrive and show that sustainability and success can grow together.</p></div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-semibold text-emerald-100 backdrop-blur-sm"><span className="size-2 rounded-full bg-emerald-300" aria-hidden="true" /> Growing with farmers</div>
        </div>
        <div className="relative z-10 mt-10 grid gap-6 border-t border-white/20 pt-7 sm:grid-cols-3 sm:gap-8 sm:pt-8">
          <ImpactMetric value="3.2M" description="Acres supported through climate-informed growing." />
          <ImpactMetric value="$75M" description="In financial support connected directly to farmers." />
          <ImpactMetric value="10+" description="Agro-climatic biomes in our growing network." />
        </div>
      </div>
    </section>
  )
}

function ImpactMetric({ value, description }: { value: string; description: string }) {
  return <div><p className="font-heading text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{value}</p><p className="mt-2 max-w-xs text-xs leading-5 text-white/75">{description}</p></div>
}
