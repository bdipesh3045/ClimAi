import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Satellite } from "lucide-react";

export function ClimateCropHero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative isolate mx-auto min-h-[590px] max-w-7xl overflow-hidden rounded-[2rem] border border-emerald-950 bg-brand-forest text-white sm:min-h-[640px]"
    >
      <Image
        src="/images/agfarm-hero.png"
        alt=""
        fill
        priority
        sizes="(max-width: 1280px) 100vw, 1280px"
        className="-z-20 object-cover object-[59%_center]"
      />
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(9,28,17,0.9)_0%,rgba(10,31,18,0.67)_48%,rgba(10,31,18,0.2)_100%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(9,28,17,0.72)_0%,transparent_65%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-[590px] flex-col justify-between p-6 sm:min-h-[640px] sm:p-12 lg:p-16">
        <div className="mt-10 max-w-3xl sm:mt-12">
          {/* <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[10px] font-semibold tracking-[0.16em] text-white/90 uppercase backdrop-blur-sm sm:text-xs">
            <Satellite size={14} aria-hidden="true" /> Climate intelligence for resilient agriculture
          </p> */}
          <h1
            id="hero-title"
            className="mt-6 max-w-3xl font-heading text-4xl leading-[1.03] font-extrabold tracking-[-0.065em] text-white sm:text-6xl lg:text-7xl"
          >
            Smart Agriculture for a <span className="">Greener Future</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/85 sm:text-xl sm:leading-8">
            We help farmers and agricultural enterprises improve productivity
            and climate resilience through satellite telemetry, predictive
            microclimate models, and adaptive soil intelligence.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-10">
            <Link
              href="#solutions"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-brand-dark shadow-lg transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white sm:text-base"
            >
              Explore Solutions <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="#location-finder"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/30 bg-white/15 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white sm:text-base"
            >
              Free Consultation <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* <div className="mt-12 flex items-center gap-3 border-t border-white/20 pt-5 text-xs text-white/80 sm:w-fit sm:border-0 sm:pt-0">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 text-emerald-300">
            <Satellite size={17} aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold text-white">
              Field-ready climate insight
            </span>
            <span className="mt-0.5 block text-white/70">
              Built around the conditions growers face.
            </span>
          </span>
        </div> */}
      </div>
    </section>
  );
}
