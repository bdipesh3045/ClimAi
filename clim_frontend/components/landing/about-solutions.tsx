import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChartNoAxesCombined, Droplets, Leaf, Sprout } from "lucide-react"

const services = [
  {
    icon: Sprout,
    number: "01",
    title: "Crop cultivation",
    description: "Field-ready guidance that helps every acre reach its potential.",
  },
  {
    icon: Droplets,
    number: "02",
    title: "Smart irrigation",
    description: "Use water thoughtfully with practices designed for your land.",
  },
  {
    icon: ChartNoAxesCombined,
    number: "03",
    title: "Farm advisory",
    description: "Make clearer plans with practical insight for each season.",
  },
  {
    icon: Leaf,
    number: "04",
    title: "Soil stewardship",
    description: "Protect the ground beneath your feet and grow for the long term.",
  },
]

export function AboutSection() {
  return (
    <section id="about" className="scroll-mt-8 px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24 xl:px-16">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-16">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dce6dc] px-3 py-1.5 text-[10px] font-semibold tracking-[0.13em] text-[#53745c] uppercase">
            <span className="size-1.5 rounded-full bg-[#32804e]" aria-hidden="true" /> About AgFarm
          </p>
          <h2 className="font-heading max-w-[650px] text-3xl leading-[1.08] font-semibold tracking-[-0.055em] text-[#17231b] sm:text-5xl">
            Helping farmers grow with <span className="relative inline-flex size-9 -translate-y-1 items-center overflow-hidden rounded-full border-2 border-[#f1f5f1] align-middle sm:size-12"><Image src="/images/soybean-field.png" alt="" fill sizes="48px" className="object-cover" /></span> confidence, care, and a little more clarity.
          </h2>
        </div>
        <div className="max-w-[520px] lg:justify-self-end">
          <p className="text-sm leading-7 text-[#69776b] sm:text-base">
            Great farming has always blended observation with instinct. AgFarm brings helpful tools and sustainable practices together, so the next decision feels grounded in your goals and your land.
          </p>
          <Link href="#projects" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#174f35] transition-colors hover:text-[#0d3924] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#174f35]">
            See what guides us <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export function ServicesSection() {
  return (
    <section id="solutions" aria-labelledby="services-heading" className="scroll-mt-8 px-6 pb-16 sm:px-10 sm:pb-20 lg:px-14 lg:pb-24 xl:px-16">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dce6dc] px-3 py-1.5 text-[10px] font-semibold tracking-[0.13em] text-[#53745c] uppercase">
            <span className="size-1.5 rounded-full bg-[#32804e]" aria-hidden="true" /> Our services
          </p>
          <h2 id="services-heading" className="font-heading text-3xl font-semibold tracking-[-0.055em] text-[#17231b] sm:text-5xl">Solutions for agriculture</h2>
        </div>
        <p className="max-w-[330px] text-sm leading-6 text-[#748075]">Thoughtful support for a more resilient farm, from the soil up.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {services.map(({ icon: Icon, number, title, description }) => (
          <article key={number} className="group flex min-h-[245px] flex-col rounded-2xl border border-[#e7ece6] bg-white p-5 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(28,55,34,0.08)] sm:p-6">
            <div className="flex items-start justify-between">
              <span className="flex size-12 items-center justify-center rounded-full bg-[#edf3ed] text-[#174f35] transition-colors group-hover:bg-[#174f35] group-hover:text-white">
                <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="text-[10px] font-semibold tracking-[0.15em] text-[#a0aca1]">{number}</span>
            </div>
            <div className="mt-auto pt-8">
              <h3 className="font-heading text-lg font-semibold tracking-[-0.035em] text-[#1e2d22]">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#748075]">{description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
