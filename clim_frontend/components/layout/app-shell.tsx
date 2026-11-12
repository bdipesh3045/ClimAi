"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloudSun,
  LayoutGrid,
  ListChecks,
  MapPin,
  Menu,
  MessageCircle,
  Sprout,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppDataProvider, useAppData } from "@/components/providers/app-data-provider";
import { cn } from "@/lib/utils";

type NavItem = { title: string; href: string; icon: LucideIcon };

const navigation: Array<{ label: string | null; items: NavItem[] }> = [
  { label: null, items: [{ title: "Overview", href: "/dashboard", icon: LayoutGrid }] },
  {
    label: "Analyze",
    items: [
      { title: "Season Comparison", href: "/season-comparison", icon: Wheat },
      { title: "Planting & Weather", href: "/planting-weather", icon: CloudSun },
      { title: "Crop Finder", href: "/crop-finder", icon: Sprout },
    ],
  },
  {
    label: "Act",
    items: [
      { title: "Improvement Plan", href: "/improvement-plan", icon: ListChecks },
      { title: "AI Assistant", href: "/assistant", icon: MessageCircle },
    ],
  },
];

const pageTitles: Record<string, string> = Object.fromEntries(
  navigation.flatMap((group) => group.items.map((item) => [item.href, item.title])),
);

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <ShellContent>{children}</ShellContent>
    </AppDataProvider>
  );
}

function Wordmark({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      aria-label="ClimateCrop AI home"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-[10px] px-2 py-1 focus-visible:outline-marigold"
    >
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-marigold text-forest-deep">
        <Sprout size={19} strokeWidth={2.1} aria-hidden="true" />
      </span>
      <span className="font-display text-[17px] leading-none text-white">
        ClimateCrop
        <span className="ml-1 text-marigold">AI</span>
      </span>
    </Link>
  );
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { location } = useAppData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAssistantPage = pathname === "/assistant";

  // Close the drawer on route change and on Escape.
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  if (pathname === "/") {
    return <>{children}</>;
  }

  const rail = (
    <div className="flex h-full flex-col px-3 py-5">
      <div className="px-1">
        <Wordmark onNavigate={() => setMobileOpen(false)} />
      </div>

      <nav aria-label="Main navigation" className="mt-8 flex flex-col gap-6">
        {navigation.map((group) => (
          <div key={group.label ?? "home"}>
            {group.label && (
              <p className="px-3 pb-2 text-[12px] font-semibold text-white/80">{group.label}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ title, href, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition-colors focus-visible:outline-marigold",
                        isActive
                          ? "bg-white text-forest-deep"
                          : "text-white/85 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.9}
                        aria-hidden="true"
                        className={isActive ? "text-forest" : "text-white/70 group-hover:text-white"}
                      />
                      {title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/12 px-3 pt-4">
        <p className="text-[12.5px] leading-[1.55] text-white/85">
          Data: NASA POWER, Open-Meteo, FAO ECOCROP and OpenStreetMap.
        </p>
        <p className="mt-2 text-[12px] text-white/75">ClimateCrop AI · TechXpo 2026</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ground text-ink lg:flex lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1000] focus:rounded-[10px] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-forest focus:shadow-lg"
      >
        Skip to main content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 bg-forest lg:block">{rail}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[900] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 animate-in bg-forest-deep/45 fade-in-0"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(84vw,290px)] animate-in bg-forest shadow-2xl duration-200 slide-in-from-left">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 z-10 flex size-10 items-center justify-center rounded-[10px] text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X size={20} aria-hidden="true" />
            </button>
            {rail}
          </aside>
        </div>
      )}

      <div className="min-h-0 min-w-0 flex-1 lg:h-dvh lg:overflow-y-auto lg:overscroll-contain">
        <header className="sticky top-0 z-[800] flex h-16 items-center justify-between gap-3 border-b border-line bg-ground/92 px-4 backdrop-blur-md sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="-ml-1 flex size-10 items-center justify-center rounded-[10px] text-ink-soft hover:bg-line-soft lg:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <p className="truncate font-heading text-[15px] font-bold text-ink">
              {pageTitles[pathname] ?? "ClimateCrop AI"}
            </p>
          </div>
          <Link
            href="/dashboard#location"
            className="flex max-w-[55%] min-w-0 items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[13px] text-ink-soft transition-colors hover:border-forest-mid/40 hover:text-forest"
            title={location ? `Saved location: ${location}` : "Set a location on the Overview page"}
          >
            <MapPin size={14} className="shrink-0 text-forest-mid" aria-hidden="true" />
            <span className="truncate">{location ? location.split(",").slice(0, 2).join(",") : "Set location"}</span>
          </Link>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "mx-auto w-full max-w-[1320px] px-4 focus:outline-none sm:px-7 lg:px-10",
            isAssistantPage ? "h-[calc(100dvh-64px)] overflow-hidden py-3 sm:py-4" : "py-7 sm:py-9 lg:py-10",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
