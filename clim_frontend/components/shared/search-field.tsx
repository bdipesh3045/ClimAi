"use client";

import type { KeyboardEvent } from "react";
import { Loader2, Search, X } from "lucide-react";
import { buttonClass } from "@/components/shared/ui-kit";
import { cn } from "@/lib/utils";

/**
 * Search input used for every location and crop lookup. Purely
 * presentational: callers own the query, the request and the results.
 */
export function SearchField({
  id,
  name,
  value,
  onChange,
  onSubmit,
  placeholder,
  loading = false,
  submitLabel = "Search",
  onClear,
  required,
  ariaDescribedBy,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  /** When set, Enter and the button run this search. */
  onSubmit?: () => void;
  placeholder: string;
  loading?: boolean;
  submitLabel?: string;
  onClear?: () => void;
  required?: boolean;
  ariaDescribedBy?: string;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div
      className={cn(
        "flex h-12 items-center gap-2 rounded-[12px] border border-input bg-panel pl-3.5 pr-1.5 shadow-[0_1px_0_rgb(18_48_31/0.03)] transition-colors",
        "focus-within:border-forest-mid focus-within:ring-3 focus-within:ring-forest-mid/15 hover:border-[#b9c2b2]",
      )}
    >
      {loading && !onSubmit ? (
        <Loader2 size={17} className="shrink-0 animate-spin text-forest-mid" aria-hidden="true" />
      ) : (
        <Search size={17} className="shrink-0 text-ink-mute" aria-hidden="true" />
      )}
      <input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        required={required}
        aria-describedby={ariaDescribedBy}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className="h-full w-full min-w-0 border-0 bg-transparent text-[15px] text-ink placeholder:text-ink-mute focus:outline-none"
      />
      {onClear && value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="flex size-9 shrink-0 items-center justify-center rounded-[8px] text-ink-mute transition-colors hover:bg-line-soft hover:text-ink"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
      {onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className={buttonClass({ size: "sm", className: "min-w-[92px]" })}
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Searching
            </>
          ) : (
            submitLabel
          )}
        </button>
      )}
    </div>
  );
}
