"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Droplets,
  Layers,
  ListChecks,
  MessageCircle,
  NotebookPen,
  Printer,
  Sprout,
  Timer,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { PageIntro } from "@/components/shared/page-intro"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  HelpText,
  Panel,
  PanelHead,
  Pill,
  Segmented,
  Skeleton,
  SourceNote,
  SowChart,
  Spec,
  SpecGrid,
  StateBlock,
  buttonClass,
  inputClass,
  selectClass,
  textareaClass,
  type Tone,
} from "@/components/shared/ui-kit"
import { CropIcon, LEVEL_TONE } from "@/components/crops/results/parts"
import { useAuth } from "@/components/providers/auth-provider"
import { ApiError, apiFetch, errorText } from "@/lib/api"
import { capitalize, shortMonth } from "@/lib/crop-insights"
import {
  parseNote,
  parseNotes,
  type FieldNote,
  type PlanTask,
  type SeasonPlan,
  type TaskCategory,
  type TaskPriority,
} from "@/lib/plan"
import { cn } from "@/lib/utils"
import { useSeasonPlan } from "./use-season-plan"

const CHALLENGES = ["Drought", "Flooding", "Excessive rainfall", "Extreme heat", "Pests", "Crop diseases", "Poor harvest", "Other"]

const CATEGORY_ICON: Record<TaskCategory, LucideIcon> = {
  Soil: Layers,
  Water: Droplets,
  Crop: Sprout,
  Timing: CalendarClock,
  Advice: MessageCircle,
}
const PRIORITY_TONE: Record<TaskPriority, Tone> = { High: "bad", Medium: "warn", Low: "neutral" }
type Filter = "todo" | "done" | "all"


/* ------------------------------------------------------------------ page */

export function ImprovementPlan() {
  const { state, crop, setCrop, setTaskDone, retry } = useSeasonPlan()

  if (state.status === "loading") {
    return (
      <div role="status" aria-live="polite" className="space-y-6">
        <span className="sr-only">Building your season plan from your farm profile…</span>
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-[300px]" />
        <p className="text-[13.5px] text-ink-mute">
          Building your plan from your farm profile and the NASA 30-year climate for your location…
        </p>
      </div>
    )
  }

  if (state.status === "missing") {
    return (
      <div>
        <PageIntro
          title="Your season plan"
          description="A month-by-month plan for your farm, built from your own land and climate."
        />
        <StateBlock
          kind="empty"
          icon={ClipboardList}
          title="Add your farm to build a plan"
          action={
            <Link href="/profile" className={buttonClass({ size: "sm" })}>
              Complete farm profile
            </Link>
          }
        >
          Save your location, farm size, soil and irrigation once. The plan then picks your best-fitting crop, its
          planting and harvest months, and the tasks your land needs.
        </StateBlock>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div>
        <PageIntro title="Your season plan" description="A month-by-month plan for your farm." />
        <StateBlock
          kind="error"
          title="Could not build your plan"
          action={
            <button type="button" onClick={retry} className={buttonClass({ variant: "danger", size: "sm" })}>
              Try again
            </button>
          }
        >
          {state.message}
        </StateBlock>
      </div>
    )
  }

  return (
    <PlanView
      plan={state.plan}
      choosing={crop !== null && crop !== state.plan.focus.crop}
      onChooseCrop={setCrop}
      onToggle={setTaskDone}
    />
  )
}

/* ------------------------------------------------------------- plan view */

function PlanView({
  plan,
  choosing,
  onChooseCrop,
  onToggle,
}: {
  plan: SeasonPlan
  choosing: boolean
  onChooseCrop: (crop: string) => void
  onToggle: (taskId: string, done: boolean) => Promise<void>
}) {
  const [filter, setFilter] = useState<Filter>("todo")
  const [saveError, setSaveError] = useState("")
  const { focus, tasks, progress } = plan
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const visible = tasks.filter((task) => filter === "all" || (filter === "done" ? task.done : !task.done))
  const place = plan.location.split(",").slice(0, 2).join(",")

  async function toggle(task: PlanTask) {
    setSaveError("")
    try {
      await onToggle(task.id, !task.done)
    } catch (error) {
      setSaveError(errorText(error, "Could not save that change. Please try again."))
    }
  }

  return (
    <div>
      <PageIntro
        title={plan.farmName ? `${plan.farmName} season plan` : "Your season plan"}
        description={
          <>
            For {place}. Built from your farm profile and the {plan.climateSource}. Progress and notes are saved to
            your account.
          </>
        }
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={() => window.print()} className={buttonClass({ variant: "secondary" })}>
              <Printer size={16} aria-hidden="true" /> Print plan
            </button>
            <Link href="/profile" className={buttonClass({ variant: "ghost" })}>
              Edit farm profile
            </Link>
          </div>
        }
      />

      {/* --------------------------------------------------- overview */}
      <Panel
        tone="readout"
        aria-busy={choosing}
        className={cn("mb-6 animate-rise p-5 transition-opacity sm:p-6", choosing && "opacity-60")}
        aria-labelledby="plan-focus-heading"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <CropIcon category={focus.category} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 id="plan-focus-heading" className="font-display text-[30px] leading-[1.05] text-ink">
                  {focus.crop}
                </h2>
                <Pill tone={LEVEL_TONE[focus.level]}>{focus.level}</Pill>
              </div>
              <p className="mt-1.5 text-[14.5px] text-ink-mute">
                {focus.grown ? "A crop you grow" : "A top match for your land"} · {focus.score}/100 match
              </p>
            </div>
          </div>
          <div className="w-full shrink-0 lg:w-[270px] print:hidden">
            <Field label="Plan for" htmlFor="plan-focus">
              <select
                id="plan-focus"
                value={focus.crop}
                disabled={choosing}
                onChange={(event) => onChooseCrop(event.target.value)}
                className={selectClass}
              >
                {plan.options.map((option) => (
                  <option key={option.crop} value={option.crop}>
                    {option.crop} · {option.score}/100{option.grown ? " · you grow this" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <SpecGrid className="mt-5">
          <Spec
            label="Plant"
            icon={CalendarClock}
            tone="forest"
            value={focus.plantMonth ?? "Year-round"}
            note={
              focus.monthsToPlanting === null
                ? undefined
                : focus.monthsToPlanting === 0
                  ? "This month"
                  : `In ${focus.monthsToPlanting} month${focus.monthsToPlanting === 1 ? "" : "s"}`
            }
          />
          <Spec label="Harvest" icon={Timer} value={focus.harvestMonth ?? "Ongoing"} note={`~${focus.seasonDays} days to harvest`} />
          <Spec
            label="Weakest point"
            tone={focus.allChecksPass ? "forest" : "marigold"}
            value={focus.allChecksPass ? "None" : capitalize(focus.weakestPoint)}
            note={focus.allChecksPass ? "Every check passes" : `${focus.weakestPercent}% match`}
          />
          <Spec label="Plan progress" icon={ListChecks} value={`${progress.done} of ${progress.total}`} note={`${percent}% done`} />
        </SpecGrid>

        <SowChart
          className="mt-6"
          title="Season calendar"
          legend={
            focus.plantMonth && focus.harvestMonth
              ? { window: `${shortMonth(focus.plantMonth)} to ${shortMonth(focus.harvestMonth)}`, off: "Off season" }
              : { window: "Year-round" }
          }
          months={focus.seasonMonths.map((inSeason, index) => ({
            state: inSeason ? "window" : "off",
            detail: index === plan.today.month ? "this month" : undefined,
          }))}
        />
        <p className="mt-2 text-[13px] text-ink-mute">
          We are in <span className="font-semibold text-ink">{plan.today.monthName}</span>.
        </p>

        <div
          className="mt-5 h-2.5 overflow-hidden rounded-full bg-line-soft"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`${percent}% of plan tasks done`}
        >
          <div className="h-full rounded-full bg-forest transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
        </div>
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        {/* ------------------------------------------------- tasks */}
        <Panel className="overflow-hidden" aria-labelledby="tasks-heading">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h2 id="tasks-heading" className="font-heading text-[17px] font-bold text-ink">
              Tasks for {focus.crop.toLowerCase()}
            </h2>
            <Segmented<Filter>
              ariaLabel="Show tasks"
              className="h-10 print:hidden"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "todo", label: `To do (${progress.total - progress.done})` },
                { value: "done", label: `Done (${progress.done})` },
                { value: "all", label: "All" },
              ]}
            />
          </div>
          {saveError && (
            <p role="alert" className="border-b border-line bg-clay-tint px-5 py-2.5 text-[13.5px] text-clay-ink sm:px-6">
              {saveError}
            </p>
          )}

          {visible.length === 0 ? (
            <p className="px-5 py-8 text-center text-[14.5px] text-ink-mute sm:px-6">
              {filter === "todo" ? "Every task is done. Nice work." : "No tasks ticked yet."}
            </p>
          ) : (
            plan.groups.map((group) => {
              const items = visible.filter((task) => task.group === group.id)
              if (items.length === 0) return null
              return (
                <section key={group.id} aria-labelledby={`group-${group.id}`} className="border-b border-line last:border-b-0">
                  <h3
                    id={`group-${group.id}`}
                    className="flex items-center justify-between bg-paper px-5 py-2.5 text-[13px] font-semibold text-ink-soft sm:px-6"
                  >
                    {group.title}
                    <span className="tabular font-normal text-ink-mute">{items.length}</span>
                  </h3>
                  <ul className="divide-y divide-line-soft">
                    {items.map((task) => (
                      <TaskRow key={task.id} task={task} onToggle={() => void toggle(task)} />
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </Panel>

        {/* ------------------------------------------------- aside */}
        <aside className="flex flex-col gap-6 xl:sticky xl:top-[88px]">
          <YourCrops plan={plan} />
          <FieldNotes cropNames={plan.options.map((option) => option.crop)} defaultCrop={focus.crop} />
        </aside>
      </div>

      <SourceNote className="mt-8 border-t border-line pt-5">
        Tasks are generated by the ClimateCrop AI server from your farm profile, the {plan.climateSource} and FAO
        ECOCROP crop ranges. They are a starting point, not individual agronomic advice. Check with your local
        extension office.
      </SourceNote>
    </div>
  )
}

/* -------------------------------------------------------------- task row */

function TaskRow({ task, onToggle }: { task: PlanTask; onToggle: () => void }) {
  const Icon = CATEGORY_ICON[task.category] ?? Sprout
  const id = `task-${task.id.replace(/[^a-z0-9-]/g, "-")}`
  return (
    <li className={cn("px-5 py-4 transition-colors sm:px-6", task.done && "bg-paper/70")}>
      <div className="flex gap-4">
        <Checkbox
          id={id}
          checked={task.done}
          onCheckedChange={onToggle}
          aria-label={`${task.done ? "Mark not done" : "Mark done"}: ${task.title}`}
          className="mt-1 size-5 rounded-[6px]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <label
              htmlFor={id}
              className={cn(
                "cursor-pointer font-heading text-[15.5px] font-bold",
                task.done ? "text-ink-mute line-through decoration-ink-mute/50" : "text-ink",
              )}
            >
              {task.title}
            </label>
            {!task.done && <Pill tone={PRIORITY_TONE[task.priority] ?? "neutral"}>{task.priority} priority</Pill>}
          </div>
          <p className={cn("mt-1.5 text-[14px] leading-[1.6]", task.done ? "text-ink-mute" : "text-ink-soft")}>{task.why}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
            <span className="flex items-center gap-1.5 font-semibold text-forest-mid">
              <CalendarClock size={14} aria-hidden="true" /> {task.dueLabel}
            </span>
            <span className="flex items-center gap-1.5 text-ink-mute">
              <Icon size={14} aria-hidden="true" /> {task.category}
            </span>
            {task.link && (
              <Link
                href={task.link.href}
                className="inline-flex items-center gap-1 font-semibold text-forest hover:underline print:hidden"
              >
                {task.link.label} <ArrowRight size={13} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------ your crops */

function YourCrops({ plan }: { plan: SeasonPlan }) {
  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="your-crops-heading">
      <PanelHead id="your-crops-heading" icon={Sprout} title="Crops you grow" />
      {plan.currentCrops.length === 0 ? (
        <HelpText className="mt-3">
          No crops on your profile yet.{" "}
          <Link href="/profile" className="font-semibold text-forest hover:underline">
            Add them
          </Link>{" "}
          to see how each fits.
        </HelpText>
      ) : (
        <ul className="mt-4 divide-y divide-line-soft">
          {plan.currentCrops.map((crop) => (
            <li key={crop.name} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold text-ink">{crop.name}</p>
                <p className="mt-0.5 text-[13px] text-ink-mute">
                  {crop.score === null
                    ? "Not in our crop list, so not scored"
                    : crop.allChecksPass
                      ? "Every check passes"
                      : `Weakest: ${crop.weakestPoint}`}
                </p>
              </div>
              {crop.score !== null && crop.level ? (
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular text-[14px] font-bold text-ink">{crop.score}</span>
                  <Pill tone={LEVEL_TONE[crop.level]}>{crop.level}</Pill>
                </span>
              ) : (
                <Pill>Not scored</Pill>
              )}
            </li>
          ))}
        </ul>
      )}
      {plan.topMatch && (
        <p className="mt-4 border-t border-line-soft pt-3 text-[13.5px] text-ink-mute">
          Top match for your land: <span className="font-semibold text-ink">{plan.topMatch.crop}</span> (
          {plan.topMatch.score}/100).
        </p>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------ field notes */

function FieldNotes({ cropNames, defaultCrop }: { cropNames: string[]; defaultCrop: string }) {
  const { expireSession } = useAuth()
  const [notes, setNotes] = useState<FieldNote[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [crop, setCrop] = useState(defaultCrop)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [challenge, setChallenge] = useState("")
  const [text, setText] = useState("")
  const [status, setStatus] = useState<{ tone: "good" | "error"; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => setCrop(defaultCrop), [defaultCrop])

  useEffect(() => {
    let cancelled = false
    apiFetch("/notes")
      .then((data) => !cancelled && setNotes(parseNotes(data)))
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) return expireSession()
        setLoadError(errorText(error, "Could not load your notes."))
      })
    return () => {
      cancelled = true
    }
  }, [expireSession])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!text.trim()) {
      setStatus({ tone: "error", message: "Write a short note first." })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const note = parseNote(
        await apiFetch("/notes", { method: "POST", body: { crop, date, challenge: challenge || null, notes: text } }),
      )
      setNotes((current) => [note, ...(current ?? [])])
      setText("")
      setChallenge("")
      setStatus({ tone: "good", message: "Note saved." })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return expireSession()
      setStatus({ tone: "error", message: errorText(error, "Could not save the note.") })
    } finally {
      setSaving(false)
    }
  }

  async function remove(note: FieldNote) {
    try {
      await apiFetch(`/notes/${note.id}`, { method: "DELETE" })
      setNotes((current) => (current ?? []).filter((item) => item.id !== note.id))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return expireSession()
      setStatus({ tone: "error", message: errorText(error, "Could not delete the note.") })
    }
  }

  return (
    <Panel className="p-5 sm:p-6" aria-labelledby="notes-heading">
      <PanelHead
        id="notes-heading"
        icon={NotebookPen}
        title="Field notes"
        description="What you see in the field. Saved to your account."
      />
      <form onSubmit={submit} className="mt-4 space-y-3 print:hidden">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Crop" htmlFor="note-crop">
            <select id="note-crop" value={crop} onChange={(event) => setCrop(event.target.value)} className={selectClass}>
              {cropNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date" htmlFor="note-date">
            <input id="note-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Issue (optional)" htmlFor="note-challenge">
          <select id="note-challenge" value={challenge} onChange={(event) => setChallenge(event.target.value)} className={selectClass}>
            <option value="">No issue</option>
            {CHALLENGES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note" htmlFor="note-text">
          <textarea
            id="note-text"
            rows={3}
            maxLength={1000}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              if (status) setStatus(null)
            }}
            placeholder="e.g. Standing water in the north field after Tuesday's storm"
            className={textareaClass}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <p
            role="status"
            aria-live="polite"
            className={cn("text-[13px]", status?.tone === "error" ? "text-clay" : "text-forest")}
          >
            {status?.message}
          </p>
          <button type="submit" disabled={saving} className={buttonClass({ size: "sm" })}>
            {saving ? "Saving…" : "Save note"}
          </button>
        </div>
      </form>

      {loadError ? (
        <HelpText tone="error" className="mt-4">
          {loadError}
        </HelpText>
      ) : notes === null ? (
        <div className="mt-5 space-y-2" aria-hidden="true">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10" />
        </div>
      ) : notes.length > 0 ? (
        <ul className="mt-5 divide-y divide-line-soft border-t border-line pt-1">
          {notes.map((note) => (
            <li key={note.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] text-ink-mute">
                  <span className="font-semibold text-ink">{note.crop}</span>
                  {note.date &&
                    ` · ${new Date(`${note.date}T00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`}
                  {note.challenge && (
                    <>
                      {" · "}
                      <span className="text-clay">{note.challenge}</span>
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void remove(note)}
                  aria-label={`Delete note: ${note.notes.slice(0, 40)}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-ink-mute transition-colors hover:bg-clay-tint hover:text-clay print:hidden"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1 text-[14px] leading-[1.55] whitespace-pre-wrap text-ink-soft">{note.notes}</p>
            </li>
          ))}
        </ul>
      ) : (
        <HelpText className="mt-4">No notes yet.</HelpText>
      )}
    </Panel>
  )
}
