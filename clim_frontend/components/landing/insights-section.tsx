import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

const insights = [
  {
    category: "Water wise",
    title: "Working with water, not against it",
    description: "Small irrigation choices can add up to a healthier field and a more resilient season.",
    image: "/images/rice-field.png",
    alt: "A green rice field reflecting the soft evening sky.",
  },
  {
    category: "Soil health",
    title: "A stronger harvest starts below the surface",
    description: "Healthy soil is a living foundation for productive fields and future generations.",
    image: "/images/soybean-field.png",
    alt: "Healthy soybean plants growing in neat field rows.",
  },
  {
    category: "Season planning",
    title: "Make room for a more resilient season",
    description: "Thoughtful planning gives farmers more options when conditions change.",
    image: "/images/corn-field.png",
    alt: "A sunlit corn field at the edge of a working farm.",
  },
]

export function InsightsSection() {
  return (
    <section aria-labelledby="insights-heading" className="scroll-mt-8 px-6 pb-16 sm:px-10 sm:pb-20 lg:px-14 lg:pb-24 xl:px-16">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dce6dc] px-3 py-1.5 text-[10px] font-semibold tracking-[0.13em] text-[#53745c] uppercase">
            <span className="size-1.5 rounded-full bg-[#32804e]" aria-hidden="true" /> Field notes
          </p>
          <h2 id="insights-heading" className="font-heading text-3xl font-semibold tracking-[-0.055em] text-[#17231b] sm:text-5xl">Ideas for what comes next</h2>
        </div>
        <p className="max-w-[350px] text-sm leading-6 text-[#748075]">Fresh perspectives on sustainable farming, healthy soil, and practical innovation.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {insights.map((insight) => (
          <article key={insight.title} className="group overflow-hidden rounded-2xl border border-[#e5ebe4] bg-white transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(28,55,34,0.08)]">
            <div className="relative aspect-[1.52] overflow-hidden bg-[#e3ebe1]">
              <Image src={insight.image} alt={insight.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-[10px] font-semibold tracking-[0.13em] text-[#63816a] uppercase">{insight.category}</p>
              <h3 className="mt-3 font-heading text-lg leading-snug font-semibold tracking-[-0.035em] text-[#1b2b20]">{insight.title}</h3>
              <p className="mt-2 min-h-[3.2rem] text-xs leading-5 text-[#768176]">{insight.description}</p>
              <Link href="#contact" aria-label={`Ask AgFarm about ${insight.category.toLowerCase()}`} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#174f35] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#174f35]">
                Talk with our team <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
