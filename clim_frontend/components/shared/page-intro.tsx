import type { ReactNode } from "react"

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 border-b border-[#e7ebe5] pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e7ebe5] bg-white px-3 py-1 text-[11px] font-semibold tracking-[0.13em] text-[#398253] uppercase">
          <span className="size-1.5 rounded-full bg-[#398253]" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="font-heading text-3xl leading-tight font-bold tracking-[-0.04em] text-[#202720] sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#777f77] sm:text-base">{description}</p>
      </div>
      {action}
    </div>
  )
}
