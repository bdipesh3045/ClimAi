import { ClimateCropAbout, ClimateCropImpact, ClimateCropServices, ClimateCropSolutions } from "@/components/landing/climatecrop-content-sections"
import { ClimateCropFooter } from "@/components/landing/climatecrop-footer"
import { ClimateCropHero } from "@/components/landing/climatecrop-hero"
import { ClimateCropSiteHeader } from "@/components/landing/climatecrop-site-header"
import { ClimateCropTelemetry } from "@/components/landing/climatecrop-telemetry"
import { ClimateCropTestimonials } from "@/components/landing/climatecrop-testimonials"

export function LandingPage() {
  return (
    <div className="climate-landing min-h-screen bg-brand-cream text-brand-dark antialiased">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-forest focus:shadow-lg">
        Skip to content
      </a>
      <ClimateCropSiteHeader />
      <main id="main-content" className="outline-none">
        <ClimateCropHero />
        <ClimateCropTelemetry />
        <ClimateCropAbout />
        <ClimateCropSolutions />
        <ClimateCropServices />
        <ClimateCropImpact />
        <ClimateCropTestimonials />
      </main>
      <ClimateCropFooter />
    </div>
  )
}
