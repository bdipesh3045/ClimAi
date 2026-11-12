import type { ReactNode } from "react";
import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared surfaces and controls for every data screen.
 * One radius (12–14px), one hairline, one elevation (the readout only), and
 * spot inks that each mean one thing — so a new section never invents a
 * dialect of its own.
 */

/* ------------------------------------------------------------------ panels */

export function Panel({
  children,
  className,
  as: Tag = "section",
  tone = "plain",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
  /** `readout` is the one elevated surface on a page: the answer. */
  tone?: "plain" | "readout" | "quiet";
} & Record<string, unknown>) {
  return (
    <Tag
      {...rest}
      className={cn(
        "rounded-[14px]",
        tone === "plain" && "border border-line bg-panel",
        tone === "readout" &&
          "bg-panel shadow-[0_1px_2px_rgb(18_48_31/0.06),0_12px_32px_-12px_rgb(18_48_31/0.18)]",
        tone === "quiet" && "bg-paper",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function PanelHead({
  title,
  description,
  action,
  icon: Icon,
  as: Heading = "h2",
  id,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  as?: "h2" | "h3";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-forest-tint text-forest">
            <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <Heading
            id={id}
            className="font-heading text-[17px] leading-snug font-bold tracking-[-0.01em] text-ink"
          >
            {title}
          </Heading>
          {description && (
            <p className="mt-1 max-w-[68ch] text-[13.5px] leading-[1.55] text-ink-mute">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------- spec cells */

/**
 * Labelled segments with tabular figures, like the facts block on the back of
 * a seed packet. Children are <Spec> cells; hairlines divide them.
 */
export function SpecGrid({
  children,
  className,
  columns = 4,
}: {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  return (
    <dl
      className={cn(
        "grid gap-px overflow-hidden rounded-[12px] border border-line bg-line",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function Spec({
  label,
  value,
  note,
  icon: Icon,
  tone = "ink",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  icon?: LucideIcon;
  tone?: "ink" | "forest" | "sow" | "clay" | "marigold";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 bg-panel px-4 py-3.5", className)}>
      <dt className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-mute">
        {Icon && <Icon size={14} strokeWidth={1.9} aria-hidden="true" />}
        {label}
      </dt>
      <dd
        className={cn(
          "tabular mt-1.5 font-display text-[21px] leading-[1.15]",
          tone === "ink" && "text-ink",
          tone === "forest" && "text-forest",
          tone === "sow" && "text-sow",
          tone === "clay" && "text-clay",
          tone === "marigold" && "text-marigold-ink",
        )}
      >
        {value}
      </dd>
      {note && <dd className="mt-1.5 text-[12.5px] leading-[1.45] text-ink-mute">{note}</dd>}
    </div>
  );
}

/* ---------------------------------------------------------------- pills */

const toneStyles = {
  neutral: "bg-line-soft text-ink-soft",
  good: "bg-forest-tint text-forest",
  warn: "bg-marigold-tint text-marigold-ink",
  bad: "bg-clay-tint text-clay",
  info: "bg-sow-tint text-sow",
  solid: "bg-forest text-white",
} as const;

export type Tone = keyof typeof toneStyles;

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold whitespace-nowrap",
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- buttons */

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-mid [&_svg]:shrink-0";

const buttonVariants = {
  primary:
    "bg-forest text-white shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_1px_2px_rgb(18_48_31/0.25)] hover:bg-forest-deep",
  secondary: "border border-line bg-panel text-forest hover:border-forest-mid/50 hover:bg-forest-tint/60",
  ghost: "text-ink-soft hover:bg-line-soft hover:text-ink",
  danger: "bg-clay text-white hover:bg-[#8f3420]",
  marigold: "bg-marigold text-ink hover:bg-[#d39320]",
} as const;

const buttonSizes = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-4 text-[14px]",
  lg: "h-12 px-5 text-[15px]",
} as const;

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  className?: string;
} = {}) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

/* ---------------------------------------------------------------- fields */

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[12.5px] leading-[1.45] text-ink-mute">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-[10px] border border-input bg-panel px-3 text-[14.5px] text-ink shadow-[0_1px_0_rgb(18_48_31/0.03)] transition-colors placeholder:text-ink-mute hover:border-[#b9c2b2] focus:border-forest-mid focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-forest-mid/15 disabled:cursor-not-allowed disabled:bg-line-soft disabled:text-ink-mute";

export const textareaClass = `${inputClass} h-auto min-h-24 py-2.5 leading-[1.5]`;

export const selectClass = `${inputClass} appearance-none pr-9 bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2346514a' stroke-width='1.6'%3E%3Cpath d='M4 6.5 8 10l4-3.5'/%3E%3C/svg%3E")] bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat`;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-11 items-stretch rounded-[10px] border border-input bg-panel p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-[7px] px-3 text-[13px] font-semibold whitespace-nowrap transition-colors",
              active ? "bg-forest text-white" : "text-ink-soft hover:bg-forest-tint hover:text-forest",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- states */

export function StateBlock({
  kind,
  title,
  children,
  action,
  icon: Icon,
  className,
}: {
  kind: "empty" | "loading" | "error";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const Glyph = kind === "loading" ? Loader2 : kind === "error" ? AlertTriangle : Icon;
  return (
    <div
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
      aria-live={kind === "loading" ? "polite" : undefined}
      className={cn(
        "flex flex-col items-start gap-3 rounded-[14px] px-5 py-6 sm:flex-row sm:items-center sm:gap-4 sm:px-6",
        kind === "empty" && "border border-dashed border-[#c8cfc0] bg-paper",
        kind === "loading" && "border border-line bg-panel",
        kind === "error" && "bg-clay-tint",
        className,
      )}
    >
      {Glyph && (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            kind === "empty" && "bg-forest-tint text-forest",
            kind === "loading" && "bg-forest-tint text-forest",
            kind === "error" && "bg-white/70 text-clay",
          )}
        >
          <Glyph size={18} className={kind === "loading" ? "animate-spin" : undefined} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("font-heading text-[15.5px] font-bold", kind === "error" ? "text-clay" : "text-ink")}>
          {title}
        </p>
        {children && (
          <div
            className={cn(
              "mt-1 max-w-[70ch] text-[13.5px] leading-[1.55]",
              kind === "error" ? "text-clay-ink" : "text-ink-mute",
            )}
          >
            {children}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton rounded-[10px]", className)} />;
}

/* ------------------------------------------------------------- sow chart */

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type SowState = "window" | "suitable" | "off" | "unknown";

/**
 * The "When to sow" strip from the back of a seed packet: twelve months, each
 * stamped by what the data says about it. Every cell comes from a real field
 * in an API response; nothing is drawn for a month the data does not cover.
 */
export function SowChart({
  months,
  legend,
  title = "When to sow",
  className,
  animate = true,
}: {
  months: Array<{ state: SowState; detail?: string }>;
  legend: Partial<Record<SowState, string>>;
  title?: string;
  className?: string;
  animate?: boolean;
}) {
  return (
    <figure className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <figcaption className="font-display text-[13px] tracking-[0.04em] text-ink uppercase">
          {title}
        </figcaption>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-mute">
          {(Object.keys(legend) as SowState[]).map((state) => (
            <li key={state} className="flex items-center gap-1.5">
              <SowSwatch state={state} />
              {legend[state]}
            </li>
          ))}
        </ul>
      </div>
      <ol className="mt-3 grid grid-cols-12 gap-1 sm:gap-1.5" aria-label={title}>
        {months.slice(0, 12).map((month, index) => (
          <li
            key={index}
            className="min-w-0"
            title={month.detail ? `${MONTH_NAMES[index]}: ${month.detail}` : MONTH_NAMES[index]}
          >
            <span className="sr-only">
              {MONTH_NAMES[index]}: {legend[month.state] ?? month.state}
              {month.detail ? `, ${month.detail}` : ""}
            </span>
            <div
              aria-hidden="true"
              style={animate ? { animationDelay: `${index * 35}ms` } : undefined}
              className={cn(
                "h-11 origin-bottom rounded-[6px] sm:h-14",
                animate && "animate-sow",
                sowCellClass(month.state),
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                "mt-1.5 block text-center text-[12px] font-semibold",
                month.state === "window" ? "text-forest" : "text-ink-mute",
              )}
            >
              {MONTH_LETTERS[index]}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function sowCellClass(state: SowState) {
  if (state === "window") return "bg-forest";
  if (state === "suitable") return "bg-marigold";
  if (state === "unknown")
    return "border border-dashed border-[#c3cabd] bg-transparent";
  return "bg-line-soft";
}

function SowSwatch({ state }: { state: SowState }) {
  return (
    <span aria-hidden="true" className={cn("inline-block size-3 rounded-[3px]", sowCellClass(state))} />
  );
}

/* ---------------------------------------------------------- result lists */

/** A dropdown-style list of search results under a search input. */
export function ResultList({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        "mt-2 flex max-h-56 flex-col overflow-y-auto rounded-[12px] border border-line bg-panel p-1 shadow-[0_12px_28px_-14px_rgb(18_48_31/0.25)]",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function ResultItem({
  onSelect,
  primary,
  secondary,
  meta,
}: {
  onSelect: () => void;
  primary: ReactNode;
  secondary?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full rounded-[8px] px-3 py-2 text-left transition-colors hover:bg-forest-tint focus-visible:bg-forest-tint focus-visible:outline-none"
      >
        <span className="block text-[14px] font-semibold text-ink">
          {primary}
          {secondary && <span className="font-normal text-ink-mute"> · {secondary}</span>}
        </span>
        {meta && <span className="mt-0.5 block text-[12.5px] text-ink-mute">{meta}</span>}
      </button>
    </li>
  );
}

/** Quiet helper line under a control; colour follows the state it reports. */
export function HelpText({
  children,
  tone = "mute",
  className,
}: {
  children: ReactNode;
  tone?: "mute" | "error" | "good";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mt-2 text-[13px] leading-[1.5]",
        tone === "mute" && "text-ink-mute",
        tone === "error" && "text-clay",
        tone === "good" && "text-forest",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Source line: where a number came from. Small, but always readable. */
export function SourceNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[12.5px] leading-[1.55] text-ink-mute", className)}>{children}</p>;
}
