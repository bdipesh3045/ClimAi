import Link from "next/link"
import { ArrowUpRight, Leaf, Menu } from "lucide-react"

const navigation = [
  { label: "Home", href: "#home" },
  { label: "About us", href: "#about" },
  { label: "Solutions", href: "#solutions" },
  { label: "Innovation", href: "#innovation" },
  { label: "Our approach", href: "#projects" },
  { label: "Contact", href: "#contact" },
]

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      {navigation.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          className={mobile
            ? "block rounded-lg px-3 py-2.5 text-sm font-medium text-[#26362b] transition-colors hover:bg-[#f0f4ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174f35]"
            : "text-[13px] font-medium text-white/85 transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-white"
          }
        >
          {label}
        </Link>
      ))}
    </>
  )
}

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 px-5 pt-5 sm:px-8 sm:pt-7 lg:px-12 xl:px-16">
      <div className="mx-auto flex max-w-[1370px] items-center justify-between gap-5">
        <Link href="#home" aria-label="AgFarm home" className="inline-flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm">
            <Leaf size={19} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="font-heading text-[22px] font-extrabold tracking-[-0.06em] text-white">AgFarm</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 xl:flex 2xl:gap-7">
          <NavigationLinks />
        </nav>

        <div className="hidden items-center gap-5 xl:flex">
          <Link href="#contact" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-5 text-xs font-semibold text-[#17231b] transition-colors hover:bg-[#eaf1e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Get free consultation <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <details className="group relative xl:hidden">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-white/50 bg-[#183d29]/25 px-4 text-sm font-medium text-white backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
            <Menu size={17} aria-hidden="true" /> Menu
          </summary>
          <nav aria-label="Mobile navigation" className="absolute right-0 top-[calc(100%+0.75rem)] flex w-56 flex-col gap-0.5 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5">
            <NavigationLinks mobile />
            <Link href="#contact" className="mt-1 flex items-center justify-between rounded-lg bg-[#174f35] px-3 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174f35]">
              Get free consultation <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </nav>
        </details>
      </div>
    </header>
  )
}
