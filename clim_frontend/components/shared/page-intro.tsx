import type { ReactNode } from "react";

/** Page heading: one wide title, one line of purpose, optional action. */
export function PageIntro({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex animate-rise flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-[64ch]">
        <h1 className="font-display text-[clamp(1.75rem,2.6vw,2.4rem)] leading-[1.08] text-balance text-ink">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-ink-soft">{description}</p>
      </div>
      {action}
    </header>
  );
}
