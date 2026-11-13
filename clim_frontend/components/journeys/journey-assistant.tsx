"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ClimateChat } from "@/components/assistant/climate-chat";
import type { JourneyContext } from "@/lib/assistant";
import { cn } from "@/lib/utils";

/**
 * The AI Assistant in a side panel on the journey page, so the farmer never leaves the page.
 * It mounts on first open and then stays mounted while hidden, so the conversation survives
 * closing and reopening the panel.
 */
export function JourneyAssistant({
  open,
  onClose,
  journey,
  suggestions,
}: {
  open: boolean;
  onClose: () => void;
  journey: JourneyContext;
  suggestions: string[];
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    returnFocus.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Focus the question box once the panel has rendered.
    const timer = window.setTimeout(() => panelRef.current?.querySelector("textarea")?.focus(), 50);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
      returnFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className={cn("fixed inset-0 z-[1100]", !open && "pointer-events-none")} aria-hidden={!open}>
      <div
        className={cn("absolute inset-0 bg-[#17201a]/35 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`AI Assistant: ${journey.crop}`}
        hidden={!open}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col bg-paper p-3 shadow-[-12px_0_32px_-12px_rgb(18_48_31/0.25)] sm:w-[460px]",
          open && "animate-[slide-in_200ms_ease-out]",
        )}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[14px] font-semibold text-ink">AI Assistant</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the assistant"
            className="flex size-9 items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-line-soft hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <ClimateChat journey={journey} suggestions={suggestions} />
        </div>
      </div>
    </div>
  );
}
