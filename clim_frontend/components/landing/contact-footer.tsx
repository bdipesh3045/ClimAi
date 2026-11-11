import Link from "next/link"
import { ArrowUpRight, Leaf } from "lucide-react"

export function ContactFooter() {
  return (
    <footer id="contact" className="scroll-mt-8 bg-[#172f20] px-6 py-12 text-white sm:px-10 sm:py-14 lg:px-14 xl:px-16">
      <div className="grid gap-10 border-b border-white/15 pb-10 md:grid-cols-[1fr_auto] md:items-end">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-1.5 text-[10px] font-semibold tracking-[0.13em] text-white/75 uppercase">
            <span className="size-1.5 rounded-full bg-[#b8d5a6]" aria-hidden="true" /> Start a conversation
          </p>
          <h2 className="font-heading text-3xl leading-tight font-semibold tracking-[-0.055em] sm:text-5xl">Let&apos;s grow a better future, together.</h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/70">Tell us about your land, your goals, and what you want the next season to make possible.</p>
        </div>
        <Link href="mailto:hello@agfarm.com?subject=AgFarm%20consultation" className="inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#173622] transition-colors hover:bg-[#e9f0e7] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white">
          Get free consultation <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="flex flex-col gap-6 pt-7 sm:flex-row sm:items-center sm:justify-between">
        <Link href="#home" className="inline-flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white"><Leaf size={18} aria-hidden="true" /></span>
          <span className="font-heading text-lg font-extrabold tracking-[-0.06em]">AgFarm</span>
        </Link>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/70">
          <Link href="#about" className="transition-colors hover:text-white">About us</Link>
          <Link href="#solutions" className="transition-colors hover:text-white">Solutions</Link>
          <Link href="#innovation" className="transition-colors hover:text-white">Innovation</Link>
          <Link href="#contact" className="transition-colors hover:text-white">Contact</Link>
        </nav>
        <p className="text-[11px] text-white/50">© 2026 AgFarm. Growing well, growing together.</p>
      </div>
    </footer>
  )
}
