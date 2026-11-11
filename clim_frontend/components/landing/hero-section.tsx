import Image from "next/image"
import Link from "next/link"
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react"
import { SiteHeader } from "@/components/landing/site-header"

export function HeroSection() {
  return (
    <section id="home" className="relative isolate min-h-[700px] overflow-hidden bg-[#243d2b] text-white sm:min-h-[690px] lg:min-h-[740px]">
      <Image
        src="/images/agfarm-hero.png"
        alt="A tractor tending green crop rows at sunset."
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[59%_center]"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(10,30,18,0.76)_0%,rgba(12,32,19,0.5)_45%,rgba(12,32,19,0.08)_100%)]" aria-hidden="true" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(9,26,16,0.77)_0%,rgba(9,26,16,0.05)_69%)]" aria-hidden="true" />
      <SiteHeader />

      <div className="relative mx-auto flex min-h-[700px] max-w-[1370px] flex-col justify-end px-6 pb-12 pt-32 sm:min-h-[690px] sm:px-10 sm:pb-14 lg:min-h-[740px] lg:px-14 lg:pb-[4.5rem] xl:px-16">
        <div className="max-w-[850px]">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3.5 py-2 text-[10px] font-semibold tracking-[0.17em] text-white/90 uppercase backdrop-blur-sm sm:text-xs">
            <span className="size-1.5 rounded-full bg-[#b8d5a6]" aria-hidden="true" />
            Growing well, growing together
          </p>
          <h1 className="font-heading max-w-[1000px] text-[clamp(3.25rem,6.3vw,6.25rem)] leading-[0.94] font-bold tracking-[-0.075em] text-white">
            Smart agriculture for a greener future.
          </h1>
          <p className="mt-5 max-w-[570px] text-sm leading-6 text-white/85 sm:mt-6 sm:text-base sm:leading-7">
            Practical ideas for healthier soil, wiser water use, and stronger growing seasons—built around the people who know the land best.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
            <Link href="#solutions" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#173622] shadow-lg shadow-black/10 transition-colors hover:bg-[#edf3ed] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white">
              Explore solutions <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="#contact" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/70 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white">
              Free consultation <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <Link href="#about" className="mt-10 inline-flex w-fit items-center gap-3 text-[11px] font-medium tracking-[0.12em] text-white/75 uppercase transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-white lg:absolute lg:right-14 lg:bottom-[4.5rem] lg:mt-0 xl:right-16">
          Discover AgFarm <ArrowDownRight size={15} aria-hidden="true" />
        </Link>

        <Link href="#solutions" className="absolute right-6 bottom-6 hidden w-[290px] items-center gap-3 rounded-2xl bg-white p-3 text-[#17231b] shadow-[0_16px_50px_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:flex lg:right-14 lg:bottom-[8rem] xl:right-16">
          <span className="relative size-[66px] shrink-0 overflow-hidden rounded-xl bg-[#e5ece3]">
            <Image src="/images/louisiana-farm.png" alt="" fill sizes="66px" className="object-cover" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold tracking-[0.12em] text-[#78907d] uppercase">Made for real fields</span>
            <span className="mt-1 block font-heading text-sm font-bold tracking-[-0.02em]">A more thoughtful way to grow</span>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#174f35]">See our approach <ArrowRight size={12} aria-hidden="true" /></span>
          </span>
        </Link>
      </div>
    </section>
  )
}
