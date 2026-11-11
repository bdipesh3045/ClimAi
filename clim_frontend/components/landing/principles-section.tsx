import Image from "next/image"
import { ArrowRight, Compass, HandHeart, ShieldCheck } from "lucide-react"

const principles = [
  {
    icon: Compass,
    title: "Advice with context",
    description: "Recommendations should make sense for your crops, your soil, and your season.",
  },
  {
    icon: HandHeart,
    title: "Respect for the land",
    description: "Good progress protects the resources every farm depends on.",
  },
  {
    icon: ShieldCheck,
    title: "Confidence to act",
    description: "Clear next steps make new ideas easier to put into practice.",
  },
]

export function PrinciplesSection() {
  return (
    <section id="projects" aria-labelledby="principles-heading" className="scroll-mt-8 px-6 pb-16 sm:px-10 sm:pb-20 lg:px-14 lg:pb-24 xl:px-16">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14">
        <div className="relative min-h-[360px] overflow-hidden rounded-[1.6rem] bg-[#dfe9dd] sm:min-h-[440px]">
          <Image src="/images/louisiana-farm.png" alt="A farmer walking through healthy crop rows at the start of the day." fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12291b]/75 via-transparent to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-white/75 uppercase">A promise to every grower</p>
            <blockquote className="mt-3 max-w-md font-heading text-xl leading-snug font-semibold tracking-[-0.035em] sm:text-2xl">
              “The best next step is the one that works for your land.”
            </blockquote>
          </div>
        </div>
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dce6dc] px-3 py-1.5 text-[10px] font-semibold tracking-[0.13em] text-[#53745c] uppercase">
            <span className="size-1.5 rounded-full bg-[#32804e]" aria-hidden="true" /> Our approach
          </p>
          <h2 id="principles-heading" className="font-heading max-w-[560px] text-3xl leading-[1.08] font-semibold tracking-[-0.055em] text-[#17231b] sm:text-5xl">Rooted in what matters most.</h2>
          <p className="mt-4 max-w-[520px] text-sm leading-6 text-[#748075]">Farming is personal. Our principles keep the work grounded, practical, and focused on what comes next.</p>
          <div className="mt-7 flex flex-col divide-y divide-[#e2e9e1]">
            {principles.map(({ icon: Icon, title, description }, index) => (
              <article key={title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#174f35] shadow-sm">
                  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-heading text-base font-semibold tracking-[-0.025em] text-[#243329]">{title}</h3>
                    <span className="text-[10px] font-semibold tracking-[0.12em] text-[#a0aca1]">0{index + 1}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#748075]">{description}</p>
                </div>
                <ArrowRight className="mt-3 shrink-0 text-[#55745b]" size={15} aria-hidden="true" />
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
