import Link from "next/link"
import { Activity, Leaf } from "lucide-react"

const footerGroups = [
  {
    heading: "Solutions",
    links: [
      { label: "Hyperlocal search", href: "#location-finder" },
      { label: "Smart irrigation", href: "#solutions" },
      { label: "Precision soil", href: "#solutions" },
      { label: "Yield telemetry", href: "#location-finder" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "#about" },
      { label: "Farmer stories", href: "#testimonials" },
      { label: "Sustainability", href: "#services" },
      { label: "Contact", href: "mailto:contact@climatecrop.ai" },
    ],
  },
]

export function ClimateCropFooter() {
  return (
    <footer className="mt-12 border-t border-brand-border bg-white pt-12 pb-8 sm:mt-16 sm:pt-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid gap-10 border-b border-brand-border pb-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="#hero" aria-label="ClimateCrop AI home" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-forest">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-forest text-emerald-300"><Leaf size={19} aria-hidden="true" /></span>
              <span className="font-heading text-xl font-extrabold tracking-[-0.055em] text-brand-dark">Climate<span className="text-brand-forest">Crop</span></span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-brand-subtle">Pioneering digital climate telemetry and AI-driven agronomic insight to support sustainable food systems and growing communities.</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-cream px-3 py-2 text-xs font-semibold text-emerald-900"><Activity size={14} aria-hidden="true" /> Demo sensor status: operational</div>
          </div>
          {footerGroups.map((group) => (
            <div key={group.heading}>
              <h2 className="mb-4 text-xs font-bold tracking-[0.12em] text-brand-dark uppercase">{group.heading}</h2>
              <ul className="flex flex-col gap-2.5 text-sm text-brand-subtle">
                {group.links.map((link) => <li key={link.label}><Link className="transition-colors hover:text-brand-forest focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-brand-forest" href={link.href}>{link.label}</Link></li>)}
              </ul>
            </div>
          ))}
          <div>
            <h2 className="mb-4 text-xs font-bold tracking-[0.12em] text-brand-dark uppercase">Contact & Support</h2>
            <ul className="flex flex-col gap-2.5 text-sm text-brand-subtle">
              <li><a className="hover:text-brand-forest" href="mailto:contact@climatecrop.ai">contact@climatecrop.ai</a></li>
              <li>AgriTech Plaza, Floor 8</li>
              <li>Jakarta &amp; San Francisco</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-6 text-xs text-brand-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ClimateCrop AI. All rights reserved.</p>
          <p>Climate intelligence for resilient agriculture.</p>
        </div>
      </div>
    </footer>
  )
}
