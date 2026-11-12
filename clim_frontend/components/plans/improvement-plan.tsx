"use client"

import Link from "next/link"
import { ArrowRight, ArrowUpRight, CalendarClock, CircleHelp } from "lucide-react"
import { PageIntro } from "@/components/shared/page-intro"
import { useAppData } from "@/components/providers/app-data-provider"
import { improvementActions } from "@/lib/demo-data"
import { Checkbox } from "@/components/ui/checkbox"
import { Panel, PanelHead, Pill, buttonClass, type Tone } from "@/components/shared/ui-kit"
import { cn } from "@/lib/utils"

const priorityTone: Record<string, Tone> = {
  "High priority": "bad",
  "Worth exploring": "good",
  "Good to plan": "info",
}

export function ImprovementPlan() {
  const { completedActionIds, toggleAction, location } = useAppData()
  const completed = improvementActions.filter((item) => completedActionIds.includes(item.id)).length
  const progress = Math.round((completed / improvementActions.length) * 100)

  return (
    <div>
      <PageIntro
        title="Prepare for a better growing season."
        description="Practical next steps to build a clearer picture of your fields. These are starting points, not guaranteed solutions or individual agronomic advice."
      />

      <Panel tone="readout" className="mb-6 animate-rise p-5 sm:p-6" aria-labelledby="plan-progress-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="plan-progress-heading" className="font-heading text-[18px] font-bold text-ink">
              Season checklist{location ? ` · ${location.split(",")[0]}` : ""}
            </h2>
            <p className="mt-1 text-[14px] text-ink-mute">Saved in this browser. Tick what is useful for your farm.</p>
          </div>
          <p className="tabular font-display text-[32px] leading-none text-forest">
            {completed}
            <span className="text-[18px] text-ink-mute"> / {improvementActions.length} done</span>
          </p>
        </div>
        <div
          className="mt-5 h-3 overflow-hidden rounded-full bg-line-soft"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={`${progress}% of recommended actions complete`}
        >
          <div
            className="h-full rounded-full bg-forest transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <Panel className="overflow-hidden" aria-labelledby="recommended-actions-heading">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <h2 id="recommended-actions-heading" className="font-heading text-[17px] font-bold text-ink">
              Recommended actions
            </h2>
          </div>
          <ul className="divide-y divide-line-soft">
            {improvementActions.map((item) => {
              const checked = completedActionIds.includes(item.id)
              return (
                <li key={item.id} className={cn("px-5 py-5 transition-colors sm:px-6", checked && "bg-paper")}>
                  <div className="flex gap-4">
                    <Checkbox
                      id={`action-${item.id}`}
                      checked={checked}
                      onCheckedChange={() => toggleAction(item.id)}
                      aria-label={`${checked ? "Mark incomplete" : "Mark complete"}: ${item.title}`}
                      className="mt-1 size-5 rounded-[6px]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          htmlFor={`action-${item.id}`}
                          className={cn(
                            "cursor-pointer font-heading text-[16px] font-bold",
                            checked ? "text-ink-mute line-through decoration-ink-mute/50" : "text-ink",
                          )}
                        >
                          {item.title}
                        </label>
                        <Pill tone={priorityTone[item.priority] ?? "neutral"}>{item.priority}</Pill>
                      </div>
                      <p className="mt-2 text-[14.5px] leading-[1.6] text-ink-soft">{item.description}</p>
                      <p className="mt-2 text-[14px] leading-[1.6] text-ink-mute">
                        <span className="font-semibold text-ink-soft">Why it matters: </span>
                        {item.why}
                      </p>
                      <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-forest-mid">
                        <CalendarClock size={15} aria-hidden="true" /> Suggested timing: {item.timeframe}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-[88px]">
          <Panel className="p-5 sm:p-6" aria-labelledby="know-heading">
            <PanelHead id="know-heading" icon={CircleHelp} title="What we know, and don’t" />
            <p className="mt-3 text-[14px] leading-[1.6] text-ink-soft">
              This plan uses general preparation practices and the information in the demo. Your soil test,
              field drainage and crop history make the next steps more relevant.
            </p>
            <Link
              href="/crop-finder"
              className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-forest hover:underline"
            >
              Add your farm details <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Panel>
          <Panel tone="quiet" className="border border-forest/10 bg-forest-tint/60 p-5 sm:p-6" aria-labelledby="local-heading">
            <h2 id="local-heading" className="font-heading text-[17px] font-bold text-ink">
              Ground your plan in local expertise.
            </h2>
            <p className="mt-2 text-[14px] leading-[1.6] text-ink-soft">
              Your parish extension office can help interpret soil results and planting windows for local
              conditions.
            </p>
            <a
              href="https://www.lsuagcenter.com/"
              target="_blank"
              rel="noreferrer"
              className={buttonClass({ variant: "secondary", size: "md", className: "mt-4" })}
            >
              Explore LSU AgCenter <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
