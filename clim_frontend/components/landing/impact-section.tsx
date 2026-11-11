import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Droplets, Leaf, Sun } from "lucide-react"

const commitments = [
  { icon: Leaf, label: "Healthier soil" },
  { icon: Droplets, label: "Smarter water" },
  { icon: Sun, label: "Stronger seasons" },
]

export function ImpactSection() {
  return (
    <section id="innovation" aria-labelledby="innovation-heading" className="scroll-mt-8 px-6 pb-16 sm:px-10 sm:pb-20 lg:px-14 lg:pb-24 xl:px-16">
      <div className="relative isolate min-h-[490px] overflow-hidden rounded-[1.75rem] bg-[#294432] sm:min-h-[540px]">
        <Image
          src="/images/agfarm-impact.png"
          alt="Two farmers planting young crops together in a field."
          fill
          sizes="(max-width: 768px) 100vw, 1400px"
          className="-z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,32,19,0.82)_0%,rgba(11,32,19,0.55)_48%,rgba(11,32,19,0.04)_100%)]" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(11,32,19,0.42)_0%,transparent_56%)]" aria-hidden="true" />
        <div className="flex min-h-[490px] flex-col justify-end p-6 sm:min-h-[540px] sm:p-9 lg:p-12">
          <div className="max-w-[600px]">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/90 uppercase backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-[#c3dcae]" aria-hidden="true" /> Innovation in the field
            </p>
            <h2 id="innovation-heading" className="font-heading text-3xl leading-[1.05] font-semibold tracking-[-0.055em] text-white sm:text-5xl">
              Growing impact, one thoughtful choice at a time.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/80 sm:text-base sm:leading-7">
              Lasting change starts with people. We bring practical knowledge and a respect for nature to the work farmers do every day.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {commitments.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-[11px] font-medium text-white backdrop-blur-sm">
                  <Icon size={14} aria-hidden="true" /> {label}
                </span>
              ))}
            </div>
          </div>
          <Link href="#contact" className="mt-7 inline-flex w-fit items-center gap-2 text-xs font-semibold text-white transition-colors hover:text-[#d9e7d2] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            Build a better season with us <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="absolute top-5 right-5 hidden max-w-[260px] rounded-2xl border border-white/45 bg-white/85 p-4 text-[#1b2d21] shadow-xl backdrop-blur-md sm:block lg:top-8 lg:right-8">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#e8f0e7] text-[#174f35]"><Droplets size={17} aria-hidden="true" /></span>
          <p className="mt-3 font-heading text-sm font-semibold tracking-[-0.02em]">Water conservation</p>
          <p className="mt-1 text-[11px] leading-5 text-[#718073]">Make every drop work harder, without asking more of the land.</p>
        </div>
      </div>
    </section>
  )
}
