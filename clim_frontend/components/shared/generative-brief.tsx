"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Renderer } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { Skeleton, StateBlock, buttonClass } from "@/components/shared/ui-kit";

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
      className="overflow-hidden rounded-[14px] border border-line bg-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-marigold-tint text-marigold-ink">
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-[17px] font-bold text-ink">{title}</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-mute">{label} · AI-generated layout of the values on this page</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void generate({ refresh: true })}
          disabled={status === "loading"}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          <RefreshCw size={14} className={status === "loading" ? "animate-spin" : undefined} aria-hidden="true" />
          {status === "loading" ? "Generating…" : "Regenerate"}
        </button>
      </div>

      <div className="px-5 py-5 sm:px-6" data-openui-theme="light">
        {status === "loading" && (
          <div role="status" aria-live="polite" className="space-y-3">
            <Skeleton className="h-4 w-2/5" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-16" />
              ))}
            </div>
            <Skeleton className="h-40" />
            <p className="pt-1 text-[13px] text-ink-mute">
              Laying out the values already computed on this page. No new data is added.
            </p>
          </div>
        )}

        {status === "error" && (
          <StateBlock
            kind="error"
            title="The generated brief is unavailable"
            action={
              <button
                type="button"
                onClick={() => void generate({ refresh: true })}
                className={buttonClass({ variant: "danger", size: "sm" })}
              >
                Try again
              </button>
            }
          >
            {errorMessage} The rest of this page is unaffected; it does not depend on the model.
          </StateBlock>
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
              <p className="mt-3 rounded-[10px] bg-marigold-tint px-3.5 py-2.5 text-[13px] leading-[1.5] text-marigold-ink">
                Part of the generated layout could not be rendered. The rest of this page is
                unaffected. Regenerate to try a different layout.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default GenerativeBrief;
