"use client"

import Link from "next/link"
import { ArrowRight, Check, CircleHelp, ClipboardCheck } from "lucide-react"
import { PageIntro } from "@/components/shared/page-intro"
import { useAppData } from "@/components/providers/app-data-provider"
import { improvementActions } from "@/lib/demo-data"
import { Checkbox } from "@/components/ui/checkbox"

const priorityStyle = {
  "High priority": "bg-[#f6eee7] text-[#98634a]",
  "Worth exploring": "bg-[#edf3e9] text-[#4f7458]",
  "Good to plan": "bg-[#eef4f7] text-[#5f7f8a]",
}

export function ImprovementPlan() {
  const { completedActionIds, toggleAction, location } = useAppData()
  const completed = improvementActions.filter((item) => completedActionIds.includes(item.id)).length
  const progress = Math.round((completed / improvementActions.length) * 100)

  return (
    <div>
      <PageIntro eyebrow="Turn context into action" title="Prepare for a better growing season." description="Use practical next steps to build a clearer picture of your fields. These suggestions are starting points, not guaranteed solutions or individualized agronomic advice." />

      <section className="mb-7 overflow-hidden rounded-2xl bg-[#17452d] p-5 text-white sm:p-7" aria-labelledby="plan-progress-heading">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl"><p className="text-[10px] font-semibold tracking-[0.16em] text-white/60 uppercase">Your season checklist · {location}</p><h2 id="plan-progress-heading" className="mt-2 font-heading text-2xl font-bold tracking-[-0.04em]">Small steps, clearer decisions.</h2><p className="mt-2 text-xs leading-5 text-white/70">Complete the actions that are useful to your farm. Your checklist is saved locally in this browser.</p></div>
          <div className="flex items-center gap-4 sm:min-w-[190px]">
            <div className="relative flex size-[74px] shrink-0 items-center justify-center rounded-full border-[5px] border-white/20" role="img" aria-label={`${progress}% of recommended actions complete`}>
              <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 74 74" aria-hidden="true"><circle cx="37" cy="37" r="32" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="5" /><circle cx="37" cy="37" r="32" fill="none" stroke="#a8c5a5" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(progress / 100) * 201} 201`} /></svg>
              <span className="font-heading text-base font-bold">{progress}%</span>
            </div>
            <div><p className="font-heading text-2xl font-bold">{completed}<span className="text-white/55"> / {improvementActions.length}</span></p><p className="mt-0.5 text-[11px] text-white/65">actions complete</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.7fr)]">
        <section aria-labelledby="recommended-actions-heading">
          <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.15em] text-[#8a9389] uppercase">A flexible checklist</p><h2 id="recommended-actions-heading" className="mt-1 font-heading text-xl font-bold">Recommended actions</h2></div><span className="text-[11px] text-[#8a9389]">{completed} of {improvementActions.length} done</span></div>
          <ul className="flex flex-col gap-3">
            {improvementActions.map((item, index) => {
              const checked = completedActionIds.includes(item.id)
              return (
                <li key={item.id} className={`rounded-2xl border bg-white p-4 transition-colors sm:p-5 ${checked ? "border-[#dce8d9] bg-[#fbfdf9]" : "border-[#e7ebe5]"}`}>
                  <div className="flex gap-4">
                    <Checkbox id={`action-${item.id}`} checked={checked} onCheckedChange={() => toggleAction(item.id)} aria-label={`${checked ? "Mark incomplete" : "Mark complete"}: ${item.title}`} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><label htmlFor={`action-${item.id}`} className={`cursor-pointer font-heading text-base font-bold tracking-[-0.02em] ${checked ? "text-[#6f7d71] line-through" : "text-[#27362a]"}`}>{item.title}</label><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${priorityStyle[item.priority]}`}>{item.priority}</span></div>
                      <p className="mt-2 text-xs leading-5 text-[#69736a]">{item.description}</p>
                      <p className="mt-2 text-[11px] leading-5 text-[#879087]"><span className="font-semibold text-[#657166]">Why it matters: </span>{item.why}</p>
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-[#6f8b73]"><ClipboardCheck size={13} /> Suggested timing: {item.timeframe}</div>
                    </div>
                    {checked && <span className="hidden size-7 shrink-0 items-center justify-center rounded-full bg-[#e8f2e5] text-[#398253] sm:flex"><Check size={15} /></span>}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#e7ebe5] bg-white p-5 sm:p-6">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#f1f6ed] text-[#398253]"><CircleHelp size={17} /></span>
            <h2 className="mt-4 font-heading text-lg font-bold">What we know—and don’t</h2>
            <p className="mt-2 text-xs leading-5 text-[#777f77]">This plan is based on general preparation practices and the information available in the demo. Your soil test, field drainage, and crop history can help make next steps more relevant.</p>
            <Link href="/crop-finder" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#23603b] hover:underline">Add growing conditions <ArrowRight size={14} /></Link>
          </section>
          <section className="rounded-2xl bg-[#eef4eb] p-5 sm:p-6">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-[#64816a] uppercase">A local resource</p>
            <h2 className="mt-2 font-heading text-lg font-bold">Ground your plan in local expertise.</h2>
            <p className="mt-2 text-xs leading-5 text-[#6f7b70]">Your parish extension office can help interpret soil results and planting windows for local conditions.</p>
            <a href="https://www.lsuagcenter.com/" target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#cbd9c8] bg-white px-3 text-sm font-medium text-[#286540] transition-colors hover:bg-[#f8fbf6] focus-visible:ring-2 focus-visible:ring-[#398253] focus-visible:ring-offset-2">Explore LSU AgCenter <ArrowRight size={15} aria-hidden="true" /></a>
          </section>
        </aside>
      </div>
    </div>
  )
}
