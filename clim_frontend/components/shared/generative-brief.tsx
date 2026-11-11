"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Renderer } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";

/**
 * Generative presentation of data the page already has.
 *
 * The numbers stay authoritative in the deterministic sections below; this only
 * asks the model to lay the same payload out as a dashboard via OpenUI Lang.
 * The payload never leaves the browser except through this app's own route.
 *
 * Generations are cached per canonical payload below: remounting the panel, or
 * flipping a control back to an already-seen payload, reuses the stored program
 * instead of paying for another model call. `generatedAt` is excluded from the
 * key because a refetch stamps a new one on otherwise identical data.
 */
const BRIEF_CACHE_LIMIT = 8;
const briefCache = new Map<string, string>();

function withoutVolatileFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutVolatileFields);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      if (key === "generatedAt") continue;
      sorted[key] = withoutVolatileFields((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function canonicalBriefKey(payload: unknown): string {
  return JSON.stringify(withoutVolatileFields(payload));
}

function cacheKeyFor(namespace: string, payload: unknown): string {
  return `${namespace}:${canonicalBriefKey(payload)}`;
}

function readCachedBrief(key: string): string | null {
  const program = briefCache.get(key);
  if (program === undefined) return null;
  // Refresh the entry so the limit evicts the least-recently-used first.
  briefCache.delete(key);
  briefCache.set(key, program);
  return program;
}

function writeCachedBrief(key: string, program: string): void {
  briefCache.set(key, program);
  while (briefCache.size > BRIEF_CACHE_LIMIT) {
    const oldest = briefCache.keys().next();
    if (oldest.done) break;
    briefCache.delete(oldest.value);
  }
}

type GenerativeBriefProps = {
  /** Same-origin route that turns the payload into an OpenUI program. */
  endpoint: string;
  /** JSON field name the route expects: `comparison`, `context`, … */
  bodyKey: string;
  payload: unknown;
  /** Cache partition, so two pages can never collide on a payload shape. */
  cacheNamespace: string;
  label: string;
  title: string;
};

export function GenerativeBrief({
  endpoint,
  bodyKey,
  payload,
  cacheNamespace,
  label,
  title,
}: GenerativeBriefProps) {
  const [program, setProgram] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasRenderErrors, setHasRenderErrors] = useState(false);
  const requestRef = useRef(0);

  // Callers rebuild their payload object on every render, so the effect below
  // must key on the canonical payload value, never on object identity: an
  // identity change would re-run the effect and its cleanup would invalidate
  // the request that is still in flight.
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const payloadKey = cacheKeyFor(cacheNamespace, payload);

  const generate = useCallback(
    async ({ refresh = false }: { refresh?: boolean } = {}) => {
      const current = payloadRef.current;
      const key = cacheKeyFor(cacheNamespace, current);

      // Serve identical payloads from memory first: remounts and control
      // changes back to a seen payload never reach the model.
      if (!refresh) {
        const cached = readCachedBrief(key);
        if (cached !== null) {
          setHasRenderErrors(false);
          setProgram(cached);
          setStatus("ready");
          return;
        }
      }

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setStatus("loading");
      setErrorMessage("");

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [bodyKey]: current }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          program?: unknown;
          error?: unknown;
        };

        // A newer request (or unmount) superseded this one.
        if (requestRef.current !== requestId) return;

        setHasRenderErrors(false);

        if (!response.ok || typeof data.program !== "string") {
          setErrorMessage(
            typeof data.error === "string"
              ? data.error
              : "The brief could not be generated right now.",
          );
          setStatus("error");
          return;
        }

        setProgram(data.program);
        writeCachedBrief(key, data.program);
        setStatus("ready");
      } catch {
        if (requestRef.current !== requestId) return;
        setErrorMessage("The brief could not be generated right now.");
        setStatus("error");
      }
    },
    // `payloadKey` stands in for the payload: this callback only changes when
    // the canonical payload value changes.
    [bodyKey, cacheNamespace, endpoint, payloadKey],
  );

  useEffect(() => {
    void generate();
    return () => {
      // Invalidate the in-flight request so it cannot set state after unmount
      // or after the payload changes underneath it.
      requestRef.current += 1;
    };
  }, [generate]);

  // The OpenUI stylesheet switches to dark tokens when the OS prefers dark.
  // These pages are always light, so pin the theme while the brief is mounted.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-openui-theme");
    root.setAttribute("data-openui-theme", "light");
    return () => {
      if (previous === null) root.removeAttribute("data-openui-theme");
      else root.setAttribute("data-openui-theme", previous);
    };
  }, []);

  return (
    <section
      aria-label="Generated brief"
      aria-busy={status === "loading"}
      className="overflow-hidden rounded-2xl border border-[#dfe8df] bg-[#fbfcf9]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e7ebe5] bg-white px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#e9f2eb] text-[#1d4d31]">
            <Sparkles size={15} />
          </span>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] text-[#8a9389] uppercase">
              {label}
            </p>
            <h2 className="mt-0.5 font-heading text-base font-bold text-[#2c3a30]">{title}</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void generate({ refresh: true })}
          disabled={status === "loading"}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8df] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d4d31] transition hover:border-[#739a7e] disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw size={12} className={status === "loading" ? "animate-spin" : undefined} />
          {status === "loading" ? "Generating…" : "Regenerate"}
        </button>
      </div>

      <div className="px-4 py-4 sm:px-5" data-openui-theme="light">
        {status === "loading" && (
          <div role="status" aria-live="polite" className="space-y-2.5">
            <div className="h-4 w-2/5 animate-pulse rounded bg-[#e7ece6]" />
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="h-16 animate-pulse rounded-xl bg-[#eef2ec]" />
              ))}
            </div>
            <div className="h-40 animate-pulse rounded-xl bg-[#eef2ec]" />
            <p className="pt-1 text-[11px] text-[#7e877e]">
              Laying out the values already computed below — no new data is added.
            </p>
          </div>
        )}

        {status === "error" && (
          <div role="alert" className="rounded-xl border border-[#f0cfc6] bg-[#fdf0ed] px-4 py-3">
            <p className="text-xs font-semibold text-[#a33c32]">The generated brief is unavailable</p>
            <p className="mt-1 text-[11px] leading-5 text-[#8a4a42]">{errorMessage}</p>
            <p className="mt-1.5 text-[11px] leading-5 text-[#8a4a42]">
              The sections below are unaffected — they do not depend on the model.
            </p>
            <button
              type="button"
              onClick={() => void generate({ refresh: true })}
              className="mt-2.5 rounded-full bg-[#a33c32] px-3.5 py-1.5 text-[11px] font-semibold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {status === "ready" && program && (
          <>
            <Renderer
              response={program}
              library={openuiLibrary}
              isStreaming={false}
              // `severity` is only set for warnings; it is absent on real errors.
              onError={(errors) =>
                setHasRenderErrors(errors.some((error) => error.severity !== "warning"))
              }
            />
            {hasRenderErrors && (
              <p className="mt-3 rounded-lg bg-[#fdf3e3] px-3 py-2 text-[11px] leading-5 text-[#9a6a1c]">
                Part of the generated layout could not be rendered. The content below is
                unaffected — regenerate to try a different layout.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default GenerativeBrief;
