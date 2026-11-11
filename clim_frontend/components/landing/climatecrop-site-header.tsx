import Link from "next/link"
import { ArrowUpRight, Leaf, Menu, Sprout } from "lucide-react"

const navigation = [
  { label: "Home", href: "#hero" },
  { label: "About Us", href: "#about" },
  { label: "Solutions", href: "#solutions" },
  { label: "Plot Telemetry", href: "#location-finder" },
  { label: "Services", href: "#services" },
  { label: "Stories", href: "#testimonials" },
]

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  return navigation.map(({ label, href }) => (
    <Link
      key={href}
      href={href}
      className={mobile
        ? "block rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest"
        : "text-sm font-semibold text-brand-subtle transition-colors hover:text-brand-forest focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-brand-forest"}
    >
      {label}
    </Link>
  ))
}

export function ClimateCropSiteHeader() {
  return (
    <header className="mx-auto w-full max-w-7xl px-4 pt-5 pb-4 sm:px-8">
      <div className="flex items-center justify-between gap-4 rounded-full border border-brand-border bg-white/90 px-5 py-3.5 shadow-sm backdrop-blur-md sm:px-6">
        <Link href="#hero" aria-label="ClimateCrop AI home" className="inline-flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-forest">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-forest text-emerald-300">
            <Sprout size={20} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="font-heading text-xl font-extrabold tracking-[-0.055em] text-brand-dark">Climate<span className="text-brand-forest">Crop</span></span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
          <NavigationLinks />
        </nav>

        <div className="hidden items-center lg:flex">
          <Link href="#location-finder" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest">
            Analyze Plot Free <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <details className="group relative lg:hidden">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-brand-border bg-brand-cream px-4 text-sm font-semibold text-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest [&::-webkit-details-marker]:hidden">
            <Menu size={16} aria-hidden="true" /> Menu
          </summary>
          <nav aria-label="Mobile navigation" className="absolute top-[calc(100%+0.75rem)] right-0 z-30 flex w-56 flex-col gap-0.5 rounded-2xl border border-brand-border bg-white p-2 shadow-xl">
            <NavigationLinks mobile />
            <Link href="#location-finder" className="mt-1 flex items-center justify-between rounded-lg bg-brand-forest px-3 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest">
              Analyze Plot Free <Leaf size={15} aria-hidden="true" />
            </Link>
          </nav>
        </details>
      </div>
    </header>
  )
}
