import Image from "next/image"
import { Star } from "lucide-react"

const stories = [
  {
    image: "/images/louisiana-farm.png",
    imageAlt: "A farmer walking through green crop rows.",
    title: "Awesome Precision",
    quote: "This platform helped me improve crop yield and manage my farm more efficiently. The hyperlocal rain insights are useful for planning each planting season with less guesswork.",
    name: "John Miller",
    location: "Iowa, USA",
  },
  {
    image: "/images/agfarm-impact.png",
    imageAlt: "Two growers planting young crops together.",
    title: "Transformed Our Village Cooperative",
    quote: "We connected over 350 smallholder women farmers. Soil heat warnings helped us protect our mustard crop. Truly revolutionary support!",
    name: "Minakshi Sinha",
    location: "Gujarat, India",
  },
]

export function ClimateCropTestimonials() {
  return (
    <section id="testimonials" aria-labelledby="testimonials-heading" className="mx-auto max-w-7xl scroll-mt-8 px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto mb-10 max-w-xl text-center">
        <p className="mb-3 text-xs font-bold tracking-[0.14em] text-brand-forest uppercase">Farmer stories</p>
        <h2 id="testimonials-heading" className="font-heading text-3xl font-extrabold tracking-[-0.045em] text-brand-dark sm:text-4xl">What Our Farmers Say</h2>
        <p className="mt-3 text-sm leading-6 text-brand-subtle">Stories from growers using climate intelligence in the field.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {stories.map((story) => (
          <article key={story.name} className="flex flex-col gap-5 rounded-3xl border border-brand-border bg-white p-5 shadow-[0_14px_40px_-12px_rgba(15,38,23,0.08)] sm:flex-row sm:items-stretch sm:gap-6 sm:p-7">
            <div className="relative h-48 shrink-0 overflow-hidden rounded-2xl bg-brand-cream sm:h-auto sm:min-h-52 sm:w-40"><Image src={story.image} alt={story.imageAlt} fill sizes="(max-width: 640px) 100vw, 160px" className="object-cover" /></div>
            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div><div className="mb-2 font-serif text-3xl leading-none text-brand-forest" aria-hidden="true">“</div><h3 className="font-heading text-base font-bold text-brand-dark">{story.title}</h3><p className="mt-2 text-sm leading-6 text-brand-subtle">{story.quote}</p></div>
              <div className="mt-5 flex items-center justify-between gap-4 border-t border-brand-border pt-4">
                <div><p className="text-sm font-bold text-brand-dark">{story.name}</p><p className="mt-0.5 text-xs text-brand-subtle">{story.location}</p></div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600"><Star size={14} fill="currentColor" aria-hidden="true" /> 5.0</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-4 text-center text-[11px] text-brand-subtle">Testimonials shown for demonstration purposes.</p>
    </section>
  )
}
