"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  CloudSun,
  Leaf,
  ListChecks,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  Sprout,
  UserRound,
  Wheat,
  X,
} from "lucide-react";
import { AppDataProvider } from "@/components/providers/app-data-provider";
import {
  AuthProvider,
  useAuth,
  type AuthState,
} from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/api";
import { cn } from "@/lib/utils";

// Drawn without the app sidebar and open to guests. Every other page needs a signed-in farmer.
const PUBLIC_PATHS = new Set(["/", "/login", "/signup"]);

const navigation = [
  { title: "Overview", href: "/dashboard", icon: ChartNoAxesCombined },
  { title: "Crop Finder", href: "/crop-finder", icon: Sprout },
  { title: "Season Comparison", href: "/season-comparison", icon: Wheat },
  { title: "Improvement Plan", href: "/improvement-plan", icon: ListChecks },
  { title: "Planting & Weather", href: "/planting-weather", icon: CloudSun },
  { title: "AI Assistant", href: "/assistant", icon: MessageCircle },
  { title: "Farm Profile", href: "/profile", icon: UserRound },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/crop-finder": "Crop Finder",
  "/crop-finder/results": "Crop Results",
  "/season-comparison": "Season Comparison",
  "/improvement-plan": "Improvement Plan",
  "/planting-weather": "Planting & Weather",
  "/assistant": "AI Assistant",
  "/profile": "Farm Profile",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppDataProvider>
        <ShellContent>{children}</ShellContent>
      </AppDataProvider>
    </AuthProvider>
  );
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAssistantPage = pathname === "/assistant";
  const isPublicPage = PUBLIC_PATHS.has(pathname);

  // A guest who opens an app page signs in first, then comes back to it.
  useEffect(() => {
    if (!isPublicPage && state.status === "guest") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isPublicPage, pathname, router, state.status]);

  if (isPublicPage) {
    return <>{children}</>;
  }
  if (state.status !== "signed-in") {
    return <AuthGate state={state} />;
  }
  const { account } = state;

  const sidebar = (
    <div className="flex h-full flex-col px-4 py-6">
      <Link
        href="/"
        aria-label="ClimateAI home"
        className="mb-10 flex items-center gap-3 px-3"
        onClick={() => setMobileOpen(false)}
      >
        <span className="flex size-10 items-center justify-center rounded-2xl bg-[#17452d] text-white">
          <Leaf size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="font-heading text-[19px] font-extrabold tracking-[-0.04em] text-[#17452d]">
          Climate<span className="text-[#398253]">AI</span>
        </span>
      </Link>

      <p className="px-3 pb-3 text-[10px] font-bold tracking-[0.17em] text-[#9aa39a] uppercase">
        Your workspace
      </p>
      <nav aria-label="Main navigation" className="flex flex-col gap-1">
        {navigation.map(({ title, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#398253] focus-visible:ring-offset-2",
                isActive
                  ? "bg-[#eaf1e8] text-[#17452d]"
                  : "text-[#69726a] hover:bg-[#f1f6ed] hover:text-[#17452d]",
              )}
            >
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              {title}
              {isActive && (
                <span
                  className="ml-auto size-1.5 rounded-full bg-[#398253]"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-[#e4eae1] bg-[#f7faf4] p-4">
        <span className="mb-3 flex size-8 items-center justify-center rounded-xl bg-white text-[#398253]">
          <Sprout size={16} aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold text-[#27362a]">
          A clearer growing season
        </p>
        <p className="mt-1 text-[11px] leading-5 text-[#7b857b]">
          Bring climate context and your own field notes together.
        </p>
        <Link
          href="/improvement-plan"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#23603b] hover:underline"
        >
          View your plan <ArrowUpRight size={13} aria-hidden="true" />
        </Link>
      </div>
      <AccountMenu
        email={account.user.email}
        name={account.profile?.fullName ?? null}
      />
      <p className="px-3 pt-5 text-[10px] text-[#9aa39a]">
        ClimateAI · TechXpo 2026
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8faf6] text-[#202720] lg:flex lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#17452d] focus:shadow-lg"
      >
        Skip to main content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 border-r border-[#e7ebe5] bg-[#fcfcf8] lg:flex">
        {sidebar}
      </aside>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-[#10291b]/35 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[min(82vw,300px)] border-r border-[#e7ebe5] bg-[#fcfcf8] shadow-xl lg:hidden">
            <div className="absolute top-5 right-4">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <X />
              </Button>
            </div>
            {sidebar}
          </aside>
        </>
      )}

      <div className="min-h-0 min-w-0 flex-1 lg:h-dvh lg:overflow-y-auto lg:overscroll-contain">
        <header className="sticky top-0 z-30 flex h-[74px] items-center justify-between border-b border-[#e7ebe5] bg-[#fcfcf8]/95 px-4 backdrop-blur-sm sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>
            <div>
              <p className="hidden text-[10px] font-semibold tracking-[0.15em] text-[#869087] uppercase sm:block">
                Climate intelligence
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[#28352b]">
                {pageTitles[pathname] ?? "ClimateAI"}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[11px] text-[#858d85] sm:flex">
            <span
              className="size-1.5 rounded-full bg-[#a8c5a5]"
              aria-hidden="true"
            />
            Demo workspace
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "mx-auto w-full max-w-[1440px] px-4 focus:outline-none sm:px-7 lg:px-10",
            isAssistantPage
              ? "h-[calc(100dvh-74px)] overflow-hidden py-3 sm:py-4"
              : "py-7 sm:py-9 lg:py-10",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/** Shown on app pages until the server says who is signed in. */
function AuthGate({ state }: { state: Exclude<AuthState, { status: "signed-in" }> }) {
  const { reload } = useAuth();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f8faf6] px-4 text-[#202720]">
      {state.status === "error" ? (
        <div
          role="alert"
          className="max-w-sm rounded-2xl border border-[#e4eae1] bg-white p-6 text-center"
        >
          <p className="text-sm font-semibold text-[#27362a]">
            We could not load your workspace
          </p>
          <p className="mt-2 text-[13px] leading-5 text-[#6b7a6e]">
            {state.message}
          </p>
          <Button className="mt-4" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-[#6b7a6e]"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Loading your workspace...
        </p>
      )}
    </main>
  );
}

function AccountMenu({ email, name }: { email: string; name: string | null }) {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setIsSigningOut(true);
    setError("");
    try {
      await signOut(); // AppShell then sends the guest to the sign-in page
    } catch (signOutError) {
      setError(errorText(signOutError, "Could not sign out. Please try again."));
      setIsSigningOut(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#e4eae1] bg-white p-3">
      <p className="truncate text-xs font-semibold text-[#27362a]">
        {name ?? "Signed in"}
      </p>
      <p className="truncate text-[11px] text-[#7b857b]" title={email}>
        {email}
      </p>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={isSigningOut}
        className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-[#23603b] hover:bg-[#f1f6ed] focus-visible:ring-2 focus-visible:ring-[#398253] disabled:opacity-60"
      >
        <LogOut size={14} aria-hidden="true" />
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-[11px] text-[#a33c32]">
          {error}
        </p>
      )}
    </div>
  );
}
